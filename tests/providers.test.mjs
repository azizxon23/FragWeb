import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,Response} from 'miniflare';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const hash=x=>createHash('sha256').update(x).digest('hex');
test('optional providers fail closed, OAuth verifies identity and linking, SMS verifies once without duplicates',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fragweb-providers-'));let mf,disabled;
 try{
  await build({entryPoints:['tests/fixtures/api-worker.ts'],outfile:join(dir,'worker.mjs'),bundle:true,format:'esm',platform:'browser',external:['cloudflare:workers'],logLevel:'silent'});
  const base={modules:true,modulesRoot:dir,rootPath:dir,scriptPath:join(dir,'worker.mjs'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET']};
  disabled=new Miniflare({...base,bindings:{}});
  const availability=await (await disabled.dispatchFetch('https://fragweb.test/api/auth/providers')).json();assert.deepEqual(availability,{google:false,telegram:false,phone:false,linked:[]});
  assert.equal((await disabled.dispatchFetch('https://fragweb.test/api/auth/phone',{method:'POST',headers:{origin:'https://fragweb.test'},body:'{}'})).status,503);
  assert.equal((await disabled.dispatchFetch('https://fragweb.test/api/auth/google/start',{method:'POST',headers:{origin:'https://fragweb.test'},body:''})).status,503);
  const {privateKey,publicKey}=await generateKeyPair('RS256'),jwk=await exportJWK(publicKey);jwk.kid='provider-test';jwk.alg='RS256';jwk.use='sig';
  const tokens=new Map(),sms=new Map(),network=[];let smsCounter=0;
  const service='VA'+'a'.repeat(32);
  mf=new Miniflare({...base,bindings:{GOOGLE_CLIENT_ID:'google-test',GOOGLE_CLIENT_SECRET:'google-secret-test',TELEGRAM_CLIENT_ID:'123456',TELEGRAM_CLIENT_SECRET:'telegram-secret-test',TWILIO_ACCOUNT_SID:'AC'+'a'.repeat(32),TWILIO_AUTH_TOKEN:'twilio-secret-test',TWILIO_VERIFY_SERVICE_SID:service},outboundService:async request=>{
   const url=new URL(request.url);network.push(url.hostname+url.pathname);
   if(url.pathname.endsWith('/certs')||url.pathname.endsWith('/jwks.json'))return Response.json({keys:[jwk]});
   if(url.hostname==='oauth2.googleapis.com'||url.hostname==='oauth.telegram.org'){
    const body=new URLSearchParams(await request.text());assert.equal(body.get('grant_type'),'authorization_code');assert.equal(body.get('code_verifier')?.length,64);
    if(url.hostname==='oauth.telegram.org')assert.ok(request.headers.get('authorization')?.startsWith('Basic '));
    return Response.json({id_token:tokens.get(body.get('code'))||'invalid'});
   }
   if(url.hostname==='verify.twilio.com'){
    const body=new URLSearchParams(await request.text());
    if(url.pathname.endsWith('/Verifications')){assert.equal(body.get('Channel'),'sms');const sid='VE'+(++smsCounter).toString(16).padStart(32,'0');sms.set(sid,body.get('To'));return Response.json({sid,to:body.get('To'),status:'pending',service_sid:service});}
    const sid=body.get('VerificationSid');return Response.json({sid,to:body.get('Code')==='222222'?'+998900000000':sms.get(sid),service_sid:service,status:['123456','222222'].includes(body.get('Code'))?'approved':'pending'});
   }
   throw Error('Unexpected external request: '+url.hostname);
  }});
  const db=await mf.getD1Database('DB');
  for(const name of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())for(const statement of (await readFile(join('drizzle',name),'utf8')).split('--> statement-breakpoint').flatMap(x=>x.split(';')).map(x=>x.trim()).filter(Boolean))await db.prepare(statement).run();
  const jars={};
  async function call(path,method='GET',body,client='browser',identity){
   const headers={};if(method!=='GET')headers.origin='https://fragweb.test';if(jars[client])headers.cookie=jars[client];if(identity){headers['oai-authenticated-user-id']=identity;headers['oai-authenticated-user-email']=identity+'@example.test';}
   if(body!==undefined){if(body instanceof URLSearchParams){headers['content-type']='application/x-www-form-urlencoded';body=body.toString();}else{headers['content-type']='application/json';body=JSON.stringify(body);}}
   const response=await mf.dispatchFetch('https://fragweb.test'+path,{method,headers,body,redirect:'manual'});
   for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0],key=pair.split('=')[0];jars[client]=[...(jars[client]||'').split('; ').filter(x=>x&&!x.startsWith(key+'=')),pair].join('; ');}
   return response;
  }
  async function start(provider,intent='signup',client='browser'){
   const response=await call('/api/auth/'+provider+'/start','POST',new URLSearchParams({intent,returnTo:'//evil.test'}),client);assert.equal(response.status,303);
   const url=new URL(response.headers.get('location')),state=url.searchParams.get('state');const flow=await db.prepare('SELECT * FROM oauth_flows WHERE state_hash = ?').bind(hash(state)).first();
   assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('code_challenge'),createHash('sha256').update(flow.verifier).digest('base64url'));
   assert.equal(flow.return_to,'/?profile=1');if(provider==='telegram')assert.equal(url.searchParams.get('scope'),'openid profile','Telegram never requests a mandatory phone number');
   return {state,flow,path:'/api/auth/'+provider+'/callback'};
  }
  async function signed(provider,flow,claims={}){return new SignJWT({nonce:flow.nonce,name:'Provider User',...(provider==='google'?{email:'social@example.test',email_verified:true}:{}),...claims}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setIssuer(claims.iss||(provider==='google'?'https://accounts.google.com':'https://oauth.telegram.org')).setAudience(claims.aud||(provider==='google'?'google-test':'123456')).setSubject(claims.sub||'subject-'+provider).setIssuedAt(claims.iat||Math.floor(Date.now()/1000)).setExpirationTime(claims.exp||'5m').sign(privateKey);}
  async function finish(provider,flow,claims={},client='browser',code='test-code'){tokens.set(code,await signed(provider,flow.flow,claims));return call(flow.path+'?state='+flow.state+'&code='+code,'GET',undefined,client);}
  let flow=await start('google');let response=await finish('google',flow);assert.equal(response.headers.get('location'),'https://fragweb.test/?profile=1');
  let profile=(await (await call('/api/profile')).json()).profile;assert.equal(profile.email,'social@example.test');assert.equal(profile.phone,'','Google signup has no required phone');
  const socialOwner=(await db.prepare('SELECT owner_id FROM profiles WHERE id = ?').bind(profile.id).first()).owner_id;
  assert.equal((await call('/api/admin')).status,401,'social login never grants admin');
  assert.equal((await call(flow.path+'?state='+flow.state+'&code=test-code')).headers.get('location').includes('providerAuthFailed'),true,'callback replay rejected');
  const profilesBefore=(await db.prepare('SELECT count(*) AS n FROM profiles').first()).n;
  flow=await start('google','signup','collision');response=await finish('google',flow,{},'collision');assert.match(response.headers.get('location'),/accountExists/);
  flow=await start('google','login','returning');response=await finish('google',flow,{},'returning');assert.equal(response.headers.get('location'),'https://fragweb.test/?profile=1');
  assert.equal((await (await call('/api/profile','GET',undefined,'returning')).json()).profile.id,profile.id);jars.browser=jars.returning;
  flow=await start('google','signup','email-collision');response=await finish('google',flow,{sub:'different-subject'},'email-collision');assert.match(response.headers.get('location'),/accountLinkRequired/);assert.equal((await db.prepare('SELECT count(*) AS n FROM profiles').first()).n,profilesBefore);
  for(const [name,claims] of [['nonce',{nonce:'wrong'}],['unverified',{email_verified:false}],['audience',{aud:'wrong'}],['issuer',{iss:'https://evil.test'}],['expiry',{exp:1}]]){
   flow=await start('google','signup',name);let token=await signed('google',flow.flow,claims);
   // These setters are called after payload creation in signed(); override standard claims explicitly.
   if(name==='audience')token=await new SignJWT({nonce:flow.flow.nonce,email:'new@example.test',email_verified:true}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setIssuer('https://accounts.google.com').setAudience('wrong').setSubject('bad-aud').setIssuedAt().setExpirationTime('5m').sign(privateKey);
   if(name==='issuer')token=await new SignJWT({nonce:flow.flow.nonce,email:'new@example.test',email_verified:true}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setIssuer('https://evil.test').setAudience('google-test').setSubject('bad-iss').setIssuedAt().setExpirationTime('5m').sign(privateKey);
   if(name==='expiry')token=await new SignJWT({nonce:flow.flow.nonce,email:'new@example.test',email_verified:true}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setIssuer('https://accounts.google.com').setAudience('google-test').setSubject('expired').setIssuedAt(1).setExpirationTime(2).sign(privateKey);
   tokens.set(name,token);response=await call(flow.path+'?state='+flow.state+'&code='+name,'GET',undefined,name);assert.match(response.headers.get('location'),/providerAuthFailed/,name);
  }
  const forgedKey=await generateKeyPair('RS256');flow=await start('google','signup','forged');tokens.set('forged',await new SignJWT({nonce:flow.flow.nonce,email:'forged@example.test',email_verified:true}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setIssuer('https://accounts.google.com').setAudience('google-test').setSubject('forged').setIssuedAt().setExpirationTime('5m').sign(forgedKey.privateKey));response=await call(flow.path+'?state='+flow.state+'&code=forged','GET',undefined,'forged');assert.match(response.headers.get('location'),/providerAuthFailed/,'forged signatures never authenticate');
  const oauthCsrf=await mf.dispatchFetch('https://fragweb.test/api/auth/google/start',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/x-www-form-urlencoded'},body:'intent=signup',redirect:'manual'});assert.equal(oauthCsrf.status,403);
  flow=await start('telegram','signup','telegram');response=await finish('telegram',flow,{preferred_username:'telegram_user'},'telegram');assert.equal(response.headers.get('location'),'https://fragweb.test/?profile=1');
  const telegramProfile=(await (await call('/api/profile','GET',undefined,'telegram')).json()).profile;assert.equal(telegramProfile.email,'');assert.equal(telegramProfile.phone,'');assert.equal(telegramProfile.telegram,'telegram_user');
  flow=await start('telegram','signup','substitution');response=await finish('telegram',flow,{},'other-browser');assert.match(response.headers.get('location'),/providerAuthFailed/);
  flow=await start('google','signup','expired-flow');await db.prepare('UPDATE oauth_flows SET expires_at = 0 WHERE state_hash = ?').bind(hash(flow.state)).run();const networkBefore=network.length;response=await finish('google',flow,{},'expired-flow');assert.match(response.headers.get('location'),/providerAuthFailed/);assert.equal(network.length,networkBefore);
  response=await call('/api/auth/google/start','POST',new URLSearchParams({intent:'link'}),'unsigned');assert.equal(response.status,401);
  // Explicitly connecting a fresh Telegram identity keeps an existing marketplace profile.
  const originalId=profile.id;flow=await start('telegram','link','browser');response=await finish('telegram',flow,{sub:'linked-telegram'},'browser');assert.equal(response.headers.get('location'),'https://fragweb.test/?profile=1');assert.equal((await (await call('/api/profile')).json()).profile.id,originalId);
  const configured=await (await call('/api/auth/providers')).json();assert.deepEqual(configured.linked.sort(),['google','telegram']);assert.equal(JSON.stringify(configured).includes('subject'),false);
  flow=await start('google','link','telegram');response=await finish('google',flow,{},'telegram');assert.match(response.headers.get('location'),/accountLinkRequired/,'cannot steal linked Google identity');
  flow=await start('google','link','telegram');await call('/api/account','DELETE',undefined,'telegram');response=await finish('google',flow,{sub:'logout-link',email:'new@example.test'},'telegram');assert.match(response.headers.get('location'),/signIn/,'logout invalidates in-flight linking');
  // OTP only creates access after a provider-approved code, on the initiating browser.
  response=await call('/api/auth/phone','POST',{action:'send',phone:'not-a-number',intent:'signup'},'sms');assert.equal(response.status,400);
  response=await call('/api/auth/phone','POST',{action:'send',phone:'+998 90 123 45 67',intent:'signup'},'sms');assert.equal(response.status,200);
  assert.equal((await call('/api/profile','GET',undefined,'sms')).status,401);
  assert.equal((await call('/api/auth/phone','POST',{action:'send',phone:'+998901234567',intent:'signup'},'sms')).status,429,'resend cooldown');
  assert.equal((await call('/api/auth/phone','POST',{action:'verify',code:'123456'},'other-sms-browser')).status,401);
  assert.equal((await call('/api/auth/phone','POST',{action:'verify',code:'000000'},'sms')).status,401);
  assert.equal((await call('/api/auth/phone','POST',{action:'verify',code:'222222'},'sms')).status,401,'approved response for another number is rejected');
  response=await call('/api/auth/phone','POST',{action:'verify',code:'123456'},'sms');assert.equal(response.status,200,await response.text());
  const smsProfile=(await (await call('/api/profile','GET',undefined,'sms')).json()).profile;assert.equal(smsProfile.phone,'+998901234567');assert.equal(smsProfile.email,'');
  assert.equal((await call('/api/auth/phone','POST',{action:'verify',code:'123456'},'sms')).status,401,'OTP challenge replay denied');
  assert.equal((await call('/api/auth/phone','POST',{action:'send',phone:'+998901234567',intent:'login'},'sms-returning')).status,200);
  assert.equal((await call('/api/auth/phone','POST',{action:'verify',code:'123456'},'sms-returning')).status,200);
  assert.equal((await (await call('/api/profile','GET',undefined,'sms-returning')).json()).profile.id,smsProfile.id);
  assert.equal((await call('/api/auth/phone','POST',{action:'send',phone:'+998901234568',intent:'signup'},'sms-limited')).status,200);
  for(let i=0;i<5;i++)assert.equal((await call('/api/auth/phone','POST',{action:'verify',code:'000000'},'sms-limited')).status,401);
  const callsBefore=network.length;assert.equal((await call('/api/auth/phone','POST',{action:'verify',code:'123456'},'sms-limited')).status,401);assert.equal(network.length,callsBefore,'no provider call after attempt limit');
  assert.equal((await call('/api/auth/phone','POST',{action:'send',phone:'+998901234569',intent:'signup'},'sms-expired')).status,200);await db.prepare('UPDATE phone_challenges SET expires_at = 0 WHERE phone = ?').bind('+998901234569').run();const beforeExpiredCheck=network.length;assert.equal((await call('/api/auth/phone','POST',{action:'verify',code:'123456'},'sms-expired')).status,401);assert.equal(network.length,beforeExpiredCheck,'expired code is rejected without a provider call');
  const evil=await mf.dispatchFetch('https://fragweb.test/api/auth/phone',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:JSON.stringify({action:'send',phone:'+998901234567',intent:'signup'})});assert.equal(evil.status,403);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM external_identities WHERE owner_id = ?').bind(socialOwner).first()).n,2);
 }finally{if(mf)await mf.dispose();if(disabled)await disabled.dispose();await rm(dir,{recursive:true,force:true});}
});
