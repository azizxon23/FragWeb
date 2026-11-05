import { digest, verifyPassword } from '@/lib/admin-password';
import { getDb } from '@/db';
import { adminSessions, adminAttempts, profiles } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { sameOrigin } from '@/lib/auth';
import { adminAccount, adminSession, identity, sessionCookie, sessionToken } from '@/lib/admin-auth';
import { failure } from '@/lib/errors';
export async function GET(request: Request) {
  try {
    const user = identity(request), session = await adminSession(request);
    return Response.json({ signedIn: !!user, email: user?.email || '', authenticated: !!session, isOwner: session?.isOwner || false }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return failure(request, 'unavailable', 503); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure(request, 'origin', 403);
  const user = identity(request);
  if (!user) return failure(request, 'signIn', 401);
  try {
    const db = getDb(), now = Date.now();
    // Atomic fixed-window limit: at most five attempts per verified identity / 15 min.
    const [attempt] = await db.insert(adminAttempts).values({ ownerId: user.id, attempts: 1, windowStart: now }).onConflictDoUpdate({ target: adminAttempts.ownerId, set: {
      attempts: sql`case when ${adminAttempts.windowStart} < ${now - 900000} then 1 else ${adminAttempts.attempts} + 1 end`,
      windowStart: sql`case when ${adminAttempts.windowStart} < ${now - 900000} then ${now} else ${adminAttempts.windowStart} end`,
    }}).returning();
    if (attempt.attempts > 5) return failure(request, 'adminRateLimit', 429);
    let body: { email?: unknown; password?: unknown }; try { const raw = await request.json(); if (!raw || typeof raw !== "object") return failure(request, "invalid", 400); body = raw; } catch { return failure(request, 'invalid', 400); }
    const account = await adminAccount(user.email);
    const profile = await db.select().from(profiles).where(eq(profiles.ownerId, user.id)).get();
    if (!account || profile?.status === 'suspended' || typeof body.password !== 'string' || body.password.length > 128 || typeof body.email !== 'string' || body.email.trim().toLowerCase() !== user.email || !await verifyPassword(body.password, account.passwordHash)) return failure(request, 'adminCredentials', 403);
    const token = (crypto.randomUUID() + crypto.randomUUID()).replaceAll('-', '');
    await db.batch([
      db.delete(adminSessions).where(sql`${adminSessions.expiresAt} <= ${now} or ${adminSessions.ownerId} = ${user.id}`),
      db.insert(adminSessions).values({ tokenHash: await digest(token), ownerId: user.id, email: user.email, passwordVersion: await digest(account.passwordHash), expiresAt: now + 28800000 }),
      db.delete(adminAttempts).where(eq(adminAttempts.ownerId, user.id)),
    ]);
    return Response.json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie(token), 'Cache-Control': 'no-store' } });
  } catch { return failure(request, 'unavailable', 503); }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return failure(request, 'origin', 403);
  try {
    const user = identity(request), token = sessionToken(request);
    if (user && token) await getDb().delete(adminSessions).where(sql`${adminSessions.tokenHash} = ${await digest(token)} and ${adminSessions.ownerId} = ${user.id}`);
    return Response.json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie('', 0), 'Cache-Control': 'no-store' } });
  } catch { return failure(request, 'unavailable', 503); }
}
