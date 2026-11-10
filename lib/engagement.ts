import { env } from 'cloudflare:workers';
export const publicListing = `SELECT l.id FROM listings l JOIN profiles s ON s.owner_id=l.owner_id WHERE l.id=? AND l.status='active' AND l.moderation_status='visible' AND s.status='active'`;
export function activityPage(request: Request) {
  const n=Number(new URL(request.url).searchParams.get('page') || 1);
  return Number.isSafeInteger(n)&&n>0&&n<=10000 ? n : null;
}
export async function activity(id:string, owner:string|null, page:number, admin=false) {
  const db=env.DB!, offset=(page-1)*20;
  const counts=await db.prepare(`SELECT
    (SELECT count(*) FROM listing_likes k JOIN profiles p ON p.owner_id=k.owner_id WHERE k.listing_id=? ${admin?'':"AND p.status='active'"}) AS likeCount,
    (SELECT count(*) FROM listing_comments c JOIN profiles p ON p.owner_id=c.owner_id WHERE c.listing_id=? ${admin?'':"AND c.status='visible' AND p.status='active'"}) AS commentCount,
    EXISTS(SELECT 1 FROM listing_likes WHERE listing_id=? AND owner_id=?) AS liked`).bind(id,id,id,owner||'').first<{likeCount:number;commentCount:number;liked:number}>();
  const comments=await db.prepare(`SELECT c.id, CASE WHEN c.status='deleted' THEN '' ELSE c.body END AS body, c.status, c.created_at AS createdAt,
    p.id AS profileId, p.display_name AS displayName, p.avatar, ${admin?'p.status AS authorStatus,':''} c.owner_id=? AS mine
    FROM listing_comments c JOIN profiles p ON p.owner_id=c.owner_id WHERE c.listing_id=?
    ${admin?'':"AND c.status='visible' AND p.status='active'"} ORDER BY c.created_at DESC,c.id DESC LIMIT 20 OFFSET ?`).bind(owner||'',id,offset).all();
  const likers=admin ? (await db.prepare(`SELECT p.id AS profileId,p.display_name AS displayName,p.avatar,p.status AS authorStatus,k.created_at AS createdAt FROM listing_likes k JOIN profiles p ON p.owner_id=k.owner_id WHERE k.listing_id=? ORDER BY k.created_at DESC,k.id DESC LIMIT 20 OFFSET ?`).bind(id,offset).all()).results : undefined;
  return {...counts,liked:!!counts?.liked,comments:comments.results,...(admin?{likers}:{}),page};
}
export function activityResponse(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
