import { env } from 'cloudflare:workers';
import { access } from '@/lib/auth';
import { failure } from '@/lib/errors';
import { activity,activityPage,activityResponse } from '@/lib/engagement';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){
  try {
    const auth=await access(request,false,true);if(auth.error)return auth.error;
    const {id}=await params,page=activityPage(request);if(!page)return failure(request,'invalid',400);
    const listing=await env.DB!.prepare(`SELECT id,seller,city,brand,name,gender,size,remaining,price,condition,description,photos,status,moderation_status AS moderationStatus,created_at AS createdAt FROM listings WHERE id=?`).bind(id).first();
    if(!listing)return failure(request,'notFound',404);
    const seller=await env.DB!.prepare(`SELECT p.id,p.display_name AS displayName,p.email,p.phone,p.telegram,p.city,p.avatar,p.status FROM profiles p JOIN listings l ON l.owner_id=p.owner_id WHERE l.id=?`).bind(id).first();
    return activityResponse({listing:{...listing,photos:JSON.parse(listing.photos as string)},seller,...await activity(id,null,page,true)});
  }catch{return failure(request,'unavailable',503);}
}
export async function PATCH(request:Request,{params}:Context){
  try {
    const auth=await access(request,true,true);if(auth.error)return auth.error;
    const {id}=await params;let input;try{input=await request.json();}catch{return failure(request,'invalid',400);}
    if(!input||typeof input!=='object'||Array.isArray(input))return failure(request,'invalid',400);
    const body=input as Record<string,unknown>;
    if(typeof body.commentId!=='string'||(body.status!=='visible'&&body.status!=='hidden'))return failure(request,'invalid',400);
    if(typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.trim().length>300)return failure(request,'reason',400);
    const db=env.DB!;
    const [audit]=await db.batch([
      db.prepare(`INSERT INTO audit_logs(id,actor_id,action,target_id,reason,created_at) SELECT ?,?,'moderateComment',id,?,? FROM listing_comments WHERE id=? AND listing_id=? AND status!='deleted'`).bind(crypto.randomUUID(),auth.owner,body.reason.trim(),Date.now(),body.commentId,id),
      db.prepare("UPDATE listing_comments SET status=? WHERE id=? AND listing_id=? AND status!='deleted'").bind(body.status,body.commentId,id),
    ]);
    return audit.meta.changes?activityResponse({ok:true}):failure(request,'notFound',404);
  }catch{return failure(request,'unavailable',503);}
}
