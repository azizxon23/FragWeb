import { getDb } from '@/db';
import { externalIdentities, marketplaceSessions, profiles } from '@/db/schema';
import { and,eq,gt,or,sql } from 'drizzle-orm';
import { normalizeEmail } from './market-auth';
import type { ErrorCode } from './errors';
import type { Provider, Intent } from './providers';
export class ProviderError extends Error { constructor(public code:ErrorCode){super(code);} }
export type VerifiedProvider = {provider:Provider;subject:string;email?:string;name?:string;phone?:string;telegram?:string};
export async function finishProvider(user:VerifiedProvider,intent:Intent,linkOwner='',linkSessionHash='') {
  const db=getDb(),email=user.email?normalizeEmail(user.email):'';
  if(intent==='link') {
    const session=await db.select().from(marketplaceSessions).where(and(eq(marketplaceSessions.tokenHash,linkSessionHash),eq(marketplaceSessions.ownerId,linkOwner),gt(marketplaceSessions.expiresAt,Date.now()))).get();
    if(!session)throw new ProviderError('signIn');
  }
  const existing=await db.select().from(externalIdentities).where(and(eq(externalIdentities.provider,user.provider),eq(externalIdentities.subject,user.subject))).get();
  if(existing) {
    if(intent==='signup')throw new ProviderError('accountExists');
    if(intent==='link'&&existing.ownerId!==linkOwner)throw new ProviderError('accountLinkRequired');
    const profile=await db.select().from(profiles).where(eq(profiles.ownerId,existing.ownerId)).get();
    if(!profile||profile.status==='suspended')throw new ProviderError('suspended');
    return existing.ownerId;
  }
  if(intent==='login')throw new ProviderError('providerAccountMissing');
  const filters=[];
  if(email)filters.push(sql`lower(trim(${profiles.email})) = ${email}`);
  if(user.provider==='phone'&&user.phone)filters.push(eq(profiles.phone,user.phone));
  const collision=filters.length ? await db.select({owner:profiles.ownerId}).from(profiles).where(or(...filters)).get() : null;
  if(collision && (intent!=='link'||collision.owner!==linkOwner))throw new ProviderError('accountLinkRequired');
  const owner=intent==='link'?linkOwner:'market:'+crypto.randomUUID();
  if(intent==='link') {
    const profile=await db.select().from(profiles).where(eq(profiles.ownerId,owner)).get();
    if(!profile||profile.status==='suspended')throw new ProviderError('suspended');
  }
  const values={id:crypto.randomUUID(),provider:user.provider,subject:user.subject,ownerId:owner,createdAt:Date.now()};
  try {
    if(intent==='link')await db.insert(externalIdentities).values(values);
    else await db.batch([
      db.insert(profiles).values({id:crypto.randomUUID(),ownerId:owner,displayName:(user.name?.trim()||'User').slice(0,70),email,phone:user.phone||'',telegram:user.telegram||'',city:'Tashkent',bio:'',avatar:'',status:'active',createdAt:Date.now(),updatedAt:Date.now()}),
      db.insert(externalIdentities).values(values),
    ]);
  } catch(error){if(/unique|constraint/i.test(String(error)))throw new ProviderError('accountLinkRequired');throw error;}
  return owner;
}
