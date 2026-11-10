import { createRemoteJWKSet,jwtVerify } from 'jose';
import { oauthConfig,type OAuthProvider } from './providers';
import { ProviderError,type VerifiedProvider } from './provider-accounts';
const keys=new Map<string,ReturnType<typeof createRemoteJWKSet>>();
export async function verifyProviderToken(provider:OAuthProvider,token:string,nonce:string):Promise<VerifiedProvider> {
  const config=oauthConfig(provider);if(!config)throw new ProviderError('providerUnavailable');
  if(!keys.has(provider))keys.set(provider,createRemoteJWKSet(new URL(config.jwks),{timeoutDuration:8000}));
  const {payload}=await jwtVerify(token,keys.get(provider)!,{issuer:config.issuer,audience:config.clientId,algorithms:['RS256'],requiredClaims:['sub','exp','iat','iss','aud','nonce'],maxTokenAge:'10m',clockTolerance:5});
  if(payload.nonce!==nonce||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>255||(payload.azp!==undefined && payload.azp!==config.clientId)||(Array.isArray(payload.aud)&&payload.aud.length>1&&payload.azp!==config.clientId))throw new ProviderError('providerAuthFailed');
  const user:VerifiedProvider={provider,subject:payload.sub,name:typeof payload.name==='string'?payload.name:undefined};
  if(provider==='google') {
    if(payload.email_verified!==true||typeof payload.email!=='string'||!/^\S+@\S+\.\S+$/.test(payload.email)||payload.email.length>254)throw new ProviderError('providerAuthFailed');
    user.email=payload.email;
  } else if(typeof payload.preferred_username==='string'&&/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(payload.preferred_username))user.telegram=payload.preferred_username;
  return user;
}
export async function pkceChallenge(verifier:string) { const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''); }
