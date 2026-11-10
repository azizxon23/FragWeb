import { env } from 'cloudflare:workers';
export type OAuthProvider = 'google'|'telegram';
export type Provider = OAuthProvider|'phone';
export type Intent = 'login'|'signup'|'link';
export const validIntent = (v: unknown): v is Intent => ['login','signup','link'].includes(String(v));
export const validOAuth = (v: string): v is OAuthProvider => v==='google'||v==='telegram';
export const safeAccountReturn = (v: unknown) => typeof v==='string' && ['/','/?profile=1','/?sell=1'].includes(v) ? v : '/?profile=1';
const config = () => env as unknown as Record<string,string|undefined>;
export function oauthConfig(provider: OAuthProvider) {
  const prefix=provider==='google'?'GOOGLE':'TELEGRAM';
  const clientId=config()[prefix+'_CLIENT_ID'], clientSecret=config()[prefix+'_CLIENT_SECRET'];
  if(!clientId||!clientSecret)return null;
  return provider==='google' ? {clientId,clientSecret,authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',jwks:'https://www.googleapis.com/oauth2/v3/certs',issuer:['https://accounts.google.com','accounts.google.com'],scope:'openid email profile'} : {clientId,clientSecret,authorize:'https://oauth.telegram.org/auth',token:'https://oauth.telegram.org/token',jwks:'https://oauth.telegram.org/.well-known/jwks.json',issuer:['https://oauth.telegram.org'],scope:'openid profile'};
}
export function smsConfig() {
  const e=config(),sid=e.TWILIO_ACCOUNT_SID,token=e.TWILIO_AUTH_TOKEN,service=e.TWILIO_VERIFY_SERVICE_SID;
  return sid && /^AC[0-9a-f]{32}$/i.test(sid) && token && service && /^VA[0-9a-f]{32}$/i.test(service) ? {sid,token,service} : null;
}
export const randomToken = () => (crypto.randomUUID()+crypto.randomUUID()).replaceAll('-','');
export function readCookie(request: Request, name: string) { return request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||''; }
export function authCookie(name: string,value: string,age=600,lax=false) {return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=${lax?'Lax':'Strict'}; Max-Age=${age}`;}
export function normalizePhone(value: string) {const n=value.replace(/[\s().-]/g,'');return /^\+[1-9][0-9]{7,14}$/.test(n)?n:null;}
