import { getDb } from '@/db';
import { profiles, listings, marketplaceAccounts } from '@/db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { access } from '@/lib/auth';
import { failure } from '@/lib/errors';
export async function GET(request: Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const auth=await access(request,false,true);if(auth.error) return auth.error;
    const {id}=await params,db=getDb();
    const profile=await db.select().from(profiles).where(eq(profiles.id,id)).get();
    if(!profile) return failure(request,'notFound',404);
    const account=await db.select({createdAt:marketplaceAccounts.createdAt}).from(marketplaceAccounts).where(eq(marketplaceAccounts.ownerId,profile.ownerId)).get();
    const rows=await db.select({id:listings.id,name:listings.name,brand:listings.brand,price:listings.price,status:listings.status,moderationStatus:listings.moderationStatus,createdAt:listings.createdAt}).from(listings).where(eq(listings.ownerId,profile.ownerId)).orderBy(desc(listings.createdAt)).limit(20);
    const [{total}]=await db.select({total:count()}).from(listings).where(eq(listings.ownerId,profile.ownerId));
    const {ownerId,...safe}=profile;
    return Response.json({profile:{...safe,role:'user'},passwordConfigured:!!account,listings:rows,totalListings:total},{headers:{'Cache-Control':'no-store'}});
  } catch {return failure(request,'unavailable',503);}
}
