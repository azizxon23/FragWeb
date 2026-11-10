import { getDb } from '@/db';
import { listings, auditLogs, adminSessions, adminAttempts, marketplaceSessions, loginAttempts } from '@/db/schema';
import { and, eq, lte } from 'drizzle-orm';
import { access } from '@/lib/auth';
import { adminSession } from '@/lib/admin-auth';
import { failure } from '@/lib/errors';
// Exact test record inspected and approved for cleanup; no pattern-based deletion.
const TEST_ID='02d33ddf-b664-4a4b-985d-85aa397f91c9';
export async function POST(request: Request) {
  try {
    const auth=await access(request,true,true);if(auth.error) return auth.error;
    const session=await adminSession(request);if(!session?.isOwner) return failure(request,'adminOnly',403);
    let body;try{body=await request.json();}catch{return failure(request,'invalid',400);}
    if(!body || typeof body!=='object' || !('confirm' in body) || body.confirm!==TEST_ID) return failure(request,'invalid',400);
    const db=getDb(),now=Date.now();
    const target=await db.select().from(listings).where(eq(listings.id,TEST_ID)).get();
    const actions=[];
    if(target && (target.createdAt!==1793856070769 || target.description!=='dasjdnasjdnajsndajndasnsj')) return failure(request,'invalid',409);
    if(target && target.status!=='archived') {
      // Preserve the record and its photo for recovery; remove it from offers.
      actions.push(db.update(listings).set({status:'archived',moderationStatus:'hidden'}).where(and(eq(listings.id,TEST_ID),eq(listings.createdAt,1793856070769))));
      actions.push(db.insert(auditLogs).values({id:crypto.randomUUID(),actorId:auth.owner!,action:'testListingArchived',targetId:TEST_ID,reason:'Owner requested removal of the inspected test listing; seller profile preserved.',createdAt:now}));
    }
    await db.batch([
      db.delete(adminSessions).where(lte(adminSessions.expiresAt,now)),
      db.delete(marketplaceSessions).where(lte(marketplaceSessions.expiresAt,now)),
      db.delete(adminAttempts).where(lte(adminAttempts.windowStart,now-900000)),
      db.delete(loginAttempts).where(lte(loginAttempts.windowStart,now-900000)),
      ...actions,
    ]);
    return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  } catch {return failure(request,'unavailable',503);}
}
