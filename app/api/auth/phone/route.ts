import { getDb } from '@/db';
import { phoneChallenges } from '@/db/schema';
import { and,eq,gt,lt,lte,sql } from 'drizzle-orm';
import { sameOrigin } from '@/lib/auth';
import { digest } from '@/lib/admin-password';
import { marketSession,marketToken,newMarketSession,marketCookie,limited } from '@/lib/market-auth';
import { smsConfig,validIntent,normalizePhone,randomToken,readCookie,authCookie,safeAccountReturn } from '@/lib/providers';
import { finishProvider,ProviderError } from '@/lib/provider-accounts';
import { failure } from '@/lib/errors';
export async function POST(request:Request) {
  if(!sameOrigin(request))return failure(request,'origin',403);
  try {
    const config=smsConfig();if(!config)return failure(request,'providerUnavailable',503);
    if(Number(request.headers.get('content-length'))>4096)return failure(request,'invalid',400);
    let raw;try{raw=await request.json();}catch{return failure(request,'invalid',400);}
    if(!raw||typeof raw!=='object')return failure(request,'invalid',400);
    const input=raw as Record<string,unknown>,db=getDb();
    const headers={Authorization:'Basic '+btoa(config.sid+':'+config.token),'Content-Type':'application/x-www-form-urlencoded'};
    const endpoint='https://verify.twilio.com/v2/Services/'+config.service;
    if(input.action==='send') {
      const phone=typeof input.phone==='string'?normalizePhone(input.phone):null,intent=input.intent;if(!phone||!validIntent(intent))return failure(request,'phoneInternational',400);
      const session=intent==='link'?await marketSession(request):null;if(intent==='link'&&!session)return failure(request,'signIn',401);
      const ip=request.headers.get('cf-connecting-ip')||'unknown';
      if(await limited('sms-ip:'+await digest(ip),20)||await limited('sms:'+await digest(phone),5))return failure(request,'adminRateLimit',429);
      // One send per browser challenge each minute, even across number changes.
      const previous=readCookie(request,'__Host-fragweb-phone');
      if(previous){const old=await db.select().from(phoneChallenges).where(eq(phoneChallenges.idHash,await digest(previous))).get();if(old&&old.expiresAt>Date.now()+540000)return failure(request,'smsCooldown',429);}
      const response=await fetch(endpoint+'/Verifications',{method:'POST',headers,body:new URLSearchParams({To:phone,Channel:'sms'}),signal:AbortSignal.timeout(10000)});
      const result=await response.json() as {sid?:string;status?:string;to?:string;service_sid?:string};
      if(!response.ok||result.status!=='pending'||!result.sid||!/^VE[0-9a-f]{32}$/i.test(result.sid))return failure(request,'smsSendFailed',502);
      const challenge=randomToken();
      await db.batch([
        db.delete(phoneChallenges).where(lte(phoneChallenges.expiresAt,Date.now())),
        ...(previous?[db.delete(phoneChallenges).where(eq(phoneChallenges.idHash,await digest(previous)))]:[]),
        db.insert(phoneChallenges).values({idHash:await digest(challenge),phone,verificationSid:result.sid,intent,linkOwner:session?.owner||'',linkSessionHash:session?await digest(marketToken(request)):'',returnTo:safeAccountReturn(input.returnTo),expiresAt:Date.now()+600000}),
      ]);
      return Response.json({ok:true},{headers:{'Set-Cookie':authCookie('__Host-fragweb-phone',challenge),'Cache-Control':'no-store'}});
    }
    if(input.action!=='verify'||typeof input.code!=='string'||!/^\d{4,10}$/.test(input.code))return failure(request,'smsCode',400);
    const challenge=readCookie(request,'__Host-fragweb-phone');if(!/^[a-f0-9]{64}$/.test(challenge))return failure(request,'smsCode',401);
    const hash=await digest(challenge);
    const [flow]=await db.update(phoneChallenges).set({attempts:sql`${phoneChallenges.attempts}+1`}).where(and(eq(phoneChallenges.idHash,hash),gt(phoneChallenges.expiresAt,Date.now()),lt(phoneChallenges.attempts,5))).returning();
    if(!flow||!validIntent(flow.intent))return failure(request,'smsCode',401);
    const response=await fetch(endpoint+'/VerificationCheck',{method:'POST',headers,body:new URLSearchParams({VerificationSid:flow.verificationSid,Code:input.code}),signal:AbortSignal.timeout(10000)});
    const result=await response.json() as {status?:string;to?:string;sid?:string;service_sid?:string};
    if(!response.ok||result.status!=='approved'||result.to!==flow.phone||result.sid!==flow.verificationSid||result.service_sid!==config.service)return failure(request,'smsCode',401);
    const [consumed]=await db.delete(phoneChallenges).where(and(eq(phoneChallenges.idHash,hash),gt(phoneChallenges.expiresAt,Date.now()))).returning();
    if(!consumed)return failure(request,'smsCode',401);
    const owner=await finishProvider({provider:'phone',subject:flow.phone,phone:flow.phone},flow.intent,flow.linkOwner,flow.linkSessionHash);
    const out=new Headers({'Cache-Control':'no-store'});out.append('Set-Cookie',authCookie('__Host-fragweb-phone','',0));out.append('Set-Cookie',marketCookie(await newMarketSession(owner)));
    return Response.json({ok:true,returnTo:safeAccountReturn(flow.returnTo)},{headers:out});
  }catch(e){return failure(request,e instanceof ProviderError?e.code:'unavailable',e instanceof ProviderError?409:503);}
}
