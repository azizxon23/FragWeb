import { getDb } from '@/db';
import { oauthFlows } from '@/db/schema';
import { lte } from 'drizzle-orm';
import { sameOrigin } from '@/lib/auth';
import { digest } from '@/lib/admin-password';
import { marketSession,marketToken,limited } from '@/lib/market-auth';
import { oauthConfig,validOAuth,validIntent,randomToken,safeAccountReturn,authCookie } from '@/lib/providers';
import { pkceChallenge } from '@/lib/oidc';
import { failure } from '@/lib/errors';
export async function POST(request:Request,{params}:{params:Promise<{provider:string}>}) {
  if(!sameOrigin(request))return failure(request,'origin',403);
  try {
    const {provider}=await params;if(!validOAuth(provider))return failure(request,'invalid',400);
    const config=oauthConfig(provider);if(!config)return failure(request,'providerUnavailable',503);
    if(Number(request.headers.get('content-length'))>4096)return failure(request,'invalid',400);
    const data=await request.formData(),intent=data.get('intent');if(!validIntent(intent))return failure(request,'invalid',400);
    const session=intent==='link'?await marketSession(request):null;
    if(intent==='link'&&!session)return failure(request,'signIn',401);
    const ip=request.headers.get('cf-connecting-ip')||'unknown';if(await limited('oauth:'+await digest(ip),50))return failure(request,'adminRateLimit',429);
    const state=randomToken(),browser=randomToken(),verifier=randomToken(),nonce=randomToken(),returnTo=safeAccountReturn(data.get('returnTo'));
    const origin=new URL(request.url).origin,callback=origin+'/api/auth/'+provider+'/callback';
    await getDb().batch([
      getDb().delete(oauthFlows).where(lte(oauthFlows.expiresAt,Date.now())),
      getDb().insert(oauthFlows).values({stateHash:await digest(state),browserHash:await digest(browser),provider,verifier,nonce,intent,linkOwner:session?.owner||'',linkSessionHash:session?await digest(marketToken(request)):'',returnTo,expiresAt:Date.now()+600000}),
    ]);
    const url=new URL(config.authorize);url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:callback,response_type:'code',scope:config.scope,state,nonce,code_challenge:await pkceChallenge(verifier),code_challenge_method:'S256',...(provider==='google'?{prompt:'select_account'}:{})}).toString();
    return new Response(null,{status:303,headers:{Location:url.toString(),'Set-Cookie':authCookie('__Host-fragweb-oauth',browser,600,true),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }catch{return failure(request,'unavailable',503);}
}
