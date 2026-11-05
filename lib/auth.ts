import {env} from "cloudflare:workers";
import {validateTelegramInitData} from "./telegram";
export async function actor(request:Request):Promise<string|null>{
 const id=request.headers.get("oai-authenticated-user-id"); if(id)return "chatgpt:"+id;
 const raw=request.headers.get("x-telegram-init-data");const token=(env as unknown as Record<string,string>).TELEGRAM_BOT_TOKEN;
 return raw&&token?validateTelegramInitData(raw,token):null;
}
export function sameOrigin(request:Request){const origin=request.headers.get("origin");return !!origin&&origin===new URL(request.url).origin;}
