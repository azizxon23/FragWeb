import { env } from 'cloudflare:workers';
import { access, actor } from '@/lib/auth';
import { failure } from '@/lib/errors';
import { limited } from '@/lib/market-auth';
import { activity,activityPage,activityResponse,publicListing } from '@/lib/engagement';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){
  try {
    const {id}=await params,page=activityPage(request);
    if(!page)return failure(request,'invalid',400);
    if(!await env.DB!.prepare(publicListing).bind(id).first())return failure(request,'notFound',404);
    return activityResponse(await activity(id,await actor(request),page));
  }catch{return failure(request,'unavailable',503);}
}
async function mutate(request:Request,{params}:Context){
  try {
    const auth=await access(request,true);if(auth.error)return auth.error;
    const {id}=await params,db=env.DB!;
    let input;try{input=await request.json();}catch{return failure(request,'invalid',400);}
    if(!input||typeof input!=='object'||Array.isArray(input))return failure(request,'invalid',400);
    const raw=input as Record<string,unknown>;
    if(!await db.prepare(publicListing).bind(id).first())return failure(request,'notFound',404);
    if(request.method==='PUT'){
      if(typeof raw.liked!=='boolean')return failure(request,'invalid',400);
      if(await limited('likes:'+auth.owner,120))return failure(request,'adminRateLimit',429);
      if(raw.liked)await db.prepare(`INSERT INTO listing_likes(id,listing_id,owner_id,created_at) SELECT ?,l.id,?,? FROM listings l JOIN profiles s ON s.owner_id=l.owner_id JOIN profiles p ON p.owner_id=? WHERE l.id=? AND l.status='active' AND l.moderation_status='visible' AND s.status='active' AND p.status='active' ON CONFLICT(listing_id,owner_id) DO NOTHING`).bind(crypto.randomUUID(),auth.owner,Date.now(),auth.owner,id).run();
      else await db.prepare('DELETE FROM listing_likes WHERE listing_id=? AND owner_id=?').bind(id,auth.owner).run();
    } else if(request.method==='POST') {
      if(typeof raw.body!=='string'||!raw.body.trim()||raw.body.trim().length>1000)return failure(request,'commentLength',400);
      if(await limited('comments:'+auth.owner,20))return failure(request,'adminRateLimit',429);
      await db.prepare(`INSERT INTO listing_comments(id,listing_id,owner_id,body,created_at) SELECT ?,l.id,?,?,? FROM listings l JOIN profiles s ON s.owner_id=l.owner_id JOIN profiles p ON p.owner_id=? WHERE l.id=? AND l.status='active' AND l.moderation_status='visible' AND s.status='active' AND p.status='active'`).bind(crypto.randomUUID(),auth.owner,raw.body.trim(),Date.now(),auth.owner,id).run();
    } else {
      if(typeof raw.commentId!=='string')return failure(request,'invalid',400);
      const result=await db.prepare("UPDATE listing_comments SET status='deleted',body='' WHERE id=? AND listing_id=? AND owner_id=? AND status!='deleted'").bind(raw.commentId,id,auth.owner).run();
      if(!result.meta.changes)return failure(request,'notFound',404);
    }
    return activityResponse(await activity(id,auth.owner!,1),request.method==='POST'?201:200);
  }catch{return failure(request,'unavailable',503);}
}
export const POST=mutate, PUT=mutate, DELETE=mutate;
