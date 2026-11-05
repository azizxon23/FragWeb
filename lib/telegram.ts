export async function validateTelegramInitData(raw:string,token:string):Promise<string|null>{
 try {
 const params=new URLSearchParams(raw),hash=params.get("hash");if(!hash||!/^[a-f0-9]{64}$/.test(hash))return null;
 const date=Number(params.get("auth_date"));if(!date||Date.now()/1000-date>3600||date>Date.now()/1000+60)return null;
 params.delete("hash");const data=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+"="+v).join("\n");
 const enc=new TextEncoder(); const key=await crypto.subtle.importKey("raw",enc.encode("WebAppData"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const secret=await crypto.subtle.sign("HMAC",key,enc.encode(token));const hmac=await crypto.subtle.importKey("raw",secret,{name:"HMAC",hash:"SHA-256"},false,["verify"]);
 const valid=await crypto.subtle.verify("HMAC",hmac,new Uint8Array(hash.match(/../g)!.map(v=>parseInt(v,16))),enc.encode(data));if(!valid)return null;
 const user=JSON.parse(params.get("user")||"null");return user&&Number.isSafeInteger(user.id)?"telegram:"+user.id:null;
 }catch{return null;}
}