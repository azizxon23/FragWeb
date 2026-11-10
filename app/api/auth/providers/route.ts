import { getDb } from '@/db';
import { externalIdentities } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { marketSession } from '@/lib/market-auth';
import { oauthConfig,smsConfig } from '@/lib/providers';
import { failure } from '@/lib/errors';
export async function GET(request:Request) {
  try {
    const session=await marketSession(request);
    const linked=session ? await getDb().select({provider:externalIdentities.provider}).from(externalIdentities).where(eq(externalIdentities.ownerId,session.owner)) : [];
    return Response.json({google:!!oauthConfig('google'),telegram:!!oauthConfig('telegram'),phone:!!smsConfig(),linked:linked.map(x=>x.provider)},{headers:{'Cache-Control':'no-store'}});
  }catch{return failure(request,'unavailable',503);}
}
