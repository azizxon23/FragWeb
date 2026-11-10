import { getDb } from '@/db';
import { marketplaceAccounts, marketplaceSessions, profiles, loginAttempts } from '@/db/schema';
import { eq, gt, and, sql } from 'drizzle-orm';
import { digest } from './admin-password';
const COOKIE = '__Host-fragweb-market';
export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export function marketCookie(token: string, maxAge = 28800) { return `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`; }
export function marketToken(request: Request) { return request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1) || ''; }
export async function marketSession(request: Request) {
  const token = marketToken(request);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await getDb().select({ owner: marketplaceSessions.ownerId, email: profiles.email })
    .from(marketplaceSessions).innerJoin(profiles,eq(profiles.ownerId,marketplaceSessions.ownerId))
    .where(and(eq(marketplaceSessions.tokenHash,await digest(token)),gt(marketplaceSessions.expiresAt,Date.now()))).get();
  // Status is checked by access(); keep read access to one's suspended profile for explanation.
  return row || null;
}
export async function limited(key: string, max = 10) {
  const now=Date.now();
  const [row]=await getDb().insert(loginAttempts).values({key,attempts:1,windowStart:now}).onConflictDoUpdate({target:loginAttempts.key,set:{
    attempts:sql`case when ${loginAttempts.windowStart} < ${now-900000} then 1 else ${loginAttempts.attempts}+1 end`,
    windowStart:sql`case when ${loginAttempts.windowStart} < ${now-900000} then ${now} else ${loginAttempts.windowStart} end`,
  }}).returning();
  return row.attempts>max;
}
export async function newMarketSession(owner: string) {
  const token=(crypto.randomUUID()+crypto.randomUUID()).replaceAll('-','');
  const db=getDb();
  await db.batch([
    db.delete(marketplaceSessions).where(sql`${marketplaceSessions.expiresAt} <= ${Date.now()} or ${marketplaceSessions.ownerId} = ${owner}`),
    db.insert(marketplaceSessions).values({tokenHash:await digest(token),ownerId:owner,expiresAt:Date.now()+28800000}),
  ]);
  return token;
}
export async function marketProfile(owner: string) { return getDb().select().from(profiles).where(eq(profiles.ownerId,owner)).get(); }
