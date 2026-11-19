import { env } from 'cloudflare:workers';
// Only a deployment owner's short-lived secret can select a removal target.
// No request parameter, browser identity or claimed email can activate maintenance.
export async function applyRequestedProfileRemoval(){
 const config=(env as unknown as Record<string,string>).FRAGWEB_PROFILE_REMOVAL_REQUEST;
 if(!config)return;
 const request=JSON.parse(config) as {id:string;createdAt:number;requestId:string;expiresAt:number};
 const uuid=/^[a-f0-9-]{36}$/i;
 if(!uuid.test(request.id)||!uuid.test(request.requestId)||!Number.isSafeInteger(request.createdAt)||request.expiresAt<=Date.now()||request.expiresAt>Date.now()+3600000)return;
 const db=env.DB!;
 const target=await db.prepare('SELECT id FROM profiles WHERE id=? AND created_at=?').bind(request.id,request.createdAt).first();
 if(!target)return;
 const selector='SELECT owner_id FROM profiles WHERE id=? AND created_at=?';
 const scope=[request.id,request.createdAt];
 const statements=[db.prepare(`UPDATE listings SET status='archived',moderation_status='hidden' WHERE owner_id IN (${selector})`).bind(...scope)];
 for(const [table,column] of [['listing_comments','owner_id'],['listing_likes','owner_id'],['marketplace_sessions','owner_id'],['marketplace_accounts','owner_id'],['external_identities','owner_id'],['oauth_flows','link_owner'],['phone_challenges','link_owner']])statements.push(db.prepare(`DELETE FROM ${table} WHERE ${column} IN (${selector})`).bind(...scope));
 statements.push(db.prepare("INSERT INTO audit_logs(id,actor_id,action,target_id,reason,created_at) SELECT ?,'maintenance:owner-request','requestedProfileRemoved',id,'Explicit owner-requested marketplace profile removal. Administrator access preserved.',? FROM profiles WHERE id=? AND created_at=? ON CONFLICT(id) DO NOTHING").bind(request.requestId,Date.now(),...scope));
 statements.push(db.prepare('DELETE FROM profiles WHERE id=? AND created_at=?').bind(...scope));
 await db.batch(statements);
}
