import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash,pbkdf2Sync } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtemp,readFile,readdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('engagement privacy, identity, idempotency, pagination and audited moderation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fragweb-activity-'));let mf;
 try{
  await build({entryPoints:['tests/fixtures/api-worker.ts'],outfile:join(dir,'worker.mjs'),bundle:true,format:'esm',platform:'browser',external:['cloudflare:workers'],logLevel:'silent'});
  mf=new Miniflare({modules:true,modulesRoot:dir,rootPath:dir,scriptPath:join(dir,'worker.mjs'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{FRAGWEB_OWNER_EMAIL:'owner@example.test',FRAGWEB_OWNER_PASSWORD_HASH:'pbkdf2$salt$'+pbkdf2Sync('owner-test-password','salt',100000,32,'sha256').toString('hex')}});
  const db=await mf.getD1Database('DB');
  for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const s of (await readFile(join('drizzle',file),'utf8')).split('--> statement-breakpoint').flatMap(s=>s.split(';')).map(s=>s.trim()).filter(Boolean))await db.prepare(s).run();
  const tokens={};
  for(const name of ['seller','reader','other']){
   await db.prepare("INSERT INTO profiles(id,owner_id,display_name,email,phone,telegram,city,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(name+'-profile',name,name,name+'@private.test','+998901234567',name+'_test','Tashkent',1,1).run();
   const token=(name==='seller'?'a':name==='reader'?'b':'c').repeat(64);tokens[name]=token;
   await db.prepare('INSERT INTO marketplace_sessions(token_hash,owner_id,expires_at) VALUES(?,?,?)').bind(createHash('sha256').update(token).digest('hex'),name,Date.now()+600000).run();
  }
  await db.prepare("INSERT INTO listings(id,owner_id,seller,phone,telegram,city,brand,name,gender,size,remaining,price,condition,description,photos,created_at) VALUES('listing','seller','seller','private-phone','seller_test','Tashkent','Creed','Aventus','men',100,80,100,'box','Test listing','[]',1)").run();
  let adminCookie='';
  async function call(path,method='GET',body,who,origin='https://fragweb.test'){
   const headers={'content-type':'application/json'};if(method!=='GET')headers.origin=origin;
   if(who==='owner'){headers['oai-authenticated-user-id']='owner';headers['oai-authenticated-user-email']='owner@example.test';if(adminCookie)headers.cookie=adminCookie;}
   else if(who)headers.cookie='__Host-fragweb-market='+tokens[who];
   return mf.dispatchFetch('https://fragweb.test'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  }
  const url='/api/listings/listing/activity',adminUrl='/api/admin/listings/listing';
  assert.equal((await call(url,'POST',{body:'Hello'})).status,401);
  assert.equal((await call(url,'PUT',{liked:true},'owner')).status,401,'admin identity is not a marketplace session');
  assert.equal((await call(url,'PUT',{liked:true},'reader','https://evil.test')).status,403);
  assert.equal((await call(url,'POST',{body:' '},'reader')).status,400);
  assert.equal((await call(url,'POST',{body:'x'.repeat(1001)},'reader')).status,400);
  assert.equal((await call(url,'PUT',{liked:true},'reader')).status,200);
  assert.equal((await call(url,'PUT',{liked:true},'reader')).status,200);
  let data=await (await call(url,'GET',undefined,'reader')).json();assert.equal(data.likeCount,1);assert.equal(data.liked,true);
  assert.equal((await (await call(url)).json()).liked,false);
  await call(url,'PUT',{liked:false},'reader');assert.equal((await (await call(url)).json()).likeCount,0);
  await call(url,'PUT',{liked:true},'reader');
  const text='<script>alert("x")</script> & honest opinion';
  assert.equal((await call(url,'POST',{body:text},'reader')).status,201);
  data=await (await call(url,'GET',undefined,'reader')).json();const commentId=data.comments[0].id;
  assert.equal(data.comments[0].body,text,'plaintext preserved, React must render as text');assert.equal(!!data.comments[0].mine,true);
  assert.equal((await call(url,'DELETE',{commentId},'other')).status,404,'cannot delete another author comment');
  const json=JSON.stringify(data);for(const secret of ['ownerId','owner_id','private.test','phone','password','token'])assert.equal(json.includes(secret),false,secret);
  assert.equal((await call(adminUrl)).status,401);assert.equal((await call(adminUrl,'GET',undefined,'reader')).status,401);
  const login=await call('/api/admin/session','POST',{email:'owner@example.test',password:'owner-test-password'},'owner');assert.equal(login.status,200);adminCookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await call(adminUrl,'PATCH',{commentId,status:'hidden',reason:'bad'},'owner')).status,400);
  assert.equal((await call(adminUrl,'PATCH',{commentId,status:'hidden',reason:'Spam review'},'owner','https://evil.test')).status,403);
  assert.equal((await call(adminUrl,'PATCH',{commentId,status:'hidden',reason:'Spam review'},'owner')).status,200);
  assert.equal((await (await call(url)).json()).commentCount,0);
  data=await (await call(adminUrl,'GET',undefined,'owner')).json();assert.equal(data.comments[0].status,'hidden');assert.equal(data.likers[0].profileId,'reader-profile');assert.equal(data.seller.email,'seller@private.test');assert.equal(data.listing.name,'Aventus');assert.equal(JSON.stringify(data).includes('ownerId'),false);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM audit_logs WHERE action='moderateComment' AND target_id=? AND reason='Spam review'").bind(commentId).first()).n,1);
  assert.equal((await call(adminUrl,'PATCH',{commentId,status:'visible',reason:'Approved after review'},'owner')).status,200);
  assert.equal((await (await call(url)).json()).commentCount,1);
  await db.prepare("UPDATE profiles SET status='suspended' WHERE owner_id='reader'").run();
  data=await (await call(url)).json();assert.equal(data.likeCount,0);assert.equal(data.commentCount,0);
  assert.equal((await call(url,'POST',{body:'blocked'},'reader')).status,403);
  assert.equal((await call(url,'PUT',{liked:true},'reader')).status,403);
  await db.prepare("UPDATE profiles SET status='active' WHERE owner_id='reader'").run();
  assert.equal((await call(url,'DELETE',{commentId},'reader')).status,200);
  assert.equal((await call(adminUrl,'PATCH',{commentId,status:'visible',reason:'Cannot restore deleted'},'owner')).status,404);
  assert.equal((await db.prepare('SELECT body FROM listing_comments WHERE id=?').bind(commentId).first()).body,'');
  assert.equal((await db.prepare("SELECT count(*) AS n FROM audit_logs WHERE reason='Cannot restore deleted'").first()).n,0,'failed moderation does not create audit event');
  for(let i=0;i<23;i++)await db.prepare("INSERT INTO listing_comments(id,listing_id,owner_id,body,created_at) VALUES(?,'listing','other',?,5)").bind('c'+String(i).padStart(2,'0'),'Comment '+i).run();
  const first=await (await call(url)).json(),second=await (await call(url+'?page=2')).json();
  assert.equal(first.comments.length,20);assert.equal(second.comments.length,3);assert.equal(first.commentCount,23);
  assert.equal(new Set([...first.comments,...second.comments].map(c=>c.id)).size,23,'timestamp ties paginate deterministically');
  assert.equal((await call(url+'?page=-1')).status,400);
  const listing=(await (await call('/api/listings')).json())[0];assert.equal(listing.commentCount,23);assert.equal(listing.likeCount,1);
  for(const [field,value] of [['moderation_status','hidden'],['status','sold']]){
   await db.prepare(`UPDATE listings SET ${field}=? WHERE id='listing'`).bind(value).run();
   assert.equal((await call(url)).status,404);assert.equal((await call(url,'PUT',{liked:true},'other')).status,404);assert.equal((await call(url,'POST',{body:'blocked'},'other')).status,404);
   assert.equal((await call(adminUrl,'GET',undefined,'owner')).status,200);
   await db.prepare(`UPDATE listings SET ${field}=? WHERE id='listing'`).bind(field==='status'?'active':'visible').run();
  }
  await db.prepare("UPDATE profiles SET status='suspended' WHERE owner_id='seller'").run();assert.equal((await call(url)).status,404);
  await db.prepare("UPDATE profiles SET status='active' WHERE owner_id='seller'").run();
  // Per-account comment quota; no profile completeness or phone requirement is introduced.
  await db.prepare("UPDATE profiles SET phone='' WHERE owner_id='reader'").run();
  for(let i=0;i<19;i++)assert.equal((await call(url,'POST',{body:'Allowed '+i},'reader')).status,201);
  assert.equal((await call(url,'POST',{body:'Too many'},'reader')).status,429);
 }finally{if(mf)await mf.dispose();await rm(dir,{recursive:true,force:true});}
});
