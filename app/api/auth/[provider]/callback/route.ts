import { getDb } from '@/db';
import { oauthFlows } from '@/db/schema';
import { and,eq,gt } from 'drizzle-orm';
import { digest } from '@/lib/admin-password';
import { newMarketSession,marketCookie } from '@/lib/market-auth';
import { oauthConfig,validOAuth,validIntent,readCookie,authCookie,safeAccountReturn } from '@/lib/providers';
import { verifyProviderToken } from '@/lib/oidc';
import { finishProvider,ProviderError } from '@/lib/provider-accounts';
export async function GET(request:Request,{params}:{params:Promise<{provider:string}>}) {
  const origin=new URL(request.url).origin;
  function error(code:string){return new Response(null,{status:303,headers:{Location:origin+'/account?authError='+encodeURIComponent(code),'Set-Cookie':authCookie('__Host-fragweb-oauth','',0,true),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}
  try {
    const {provider}=await params;if(!validOAuth(provider))return error('providerAuthFailed');
    const config=oauthConfig(provider);if(!config)return error('providerUnavailable');
    const paramsIn=new URL(request.url).searchParams,state=paramsIn.get('state')||'',browser=readCookie(request,'__Host-fragweb-oauth');
    if(!/^[a-f0-9]{64}$/.test(state)||!/^[a-f0-9]{64}$/.test(browser))return error('providerAuthFailed');
    // Atomically consume state before accepting any callback; reject replay, expiry and browser substitution.
    const [flow]=await getDb().delete(oauthFlows).where(and(eq(oauthFlows.stateHash,await digest(state)),eq(oauthFlows.browserHash,await digest(browser)),eq(oauthFlows.provider,provider),gt(oauthFlows.expiresAt,Date.now()))).returning();
    if(!flow||!validIntent(flow.intent))return error('providerAuthFailed');
    const code=paramsIn.get('code');if(paramsIn.has('error')||!code||code.length>4096)return error('providerAuthFailed');
    const body=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:origin+'/api/auth/'+provider+'/callback',client_id:config.clientId,code_verifier:flow.verifier});
    const headers:Record<string,string>={'Content-Type':'application/x-www-form-urlencoded'};
    if(provider==='telegram')headers.Authorization='Basic '+btoa(config.clientId+':'+config.clientSecret);else body.set('client_secret',config.clientSecret);
    const response=await fetch(config.token,{method:'POST',headers,body,signal:AbortSignal.timeout(10000)});
    if(!response.ok)return error('providerAuthFailed');
    const result=await response.json() as {id_token?:unknown};if(typeof result.id_token!=='string')return error('providerAuthFailed');
    const user=await verifyProviderToken(provider,result.id_token,flow.nonce);
    const owner=await finishProvider(user,flow.intent,flow.linkOwner,flow.linkSessionHash);
    const out=new Headers({Location:origin+safeAccountReturn(flow.returnTo),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
    out.append('Set-Cookie',authCookie('__Host-fragweb-oauth','',0,true));out.append('Set-Cookie',marketCookie(await newMarketSession(owner)));
    return new Response(null,{status:303,headers:out});
  }catch(e){return error(e instanceof ProviderError?e.code:'providerAuthFailed');}
}
