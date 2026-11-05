import { passwordHash } from '@/lib/admin-password';
import { getDb } from '@/db';
import { adminAccounts, adminSessions, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { access } from '@/lib/auth';
import { adminAccount, ownerEmail } from '@/lib/admin-auth';
import { failure } from '@/lib/errors';
import { z } from 'zod';
const input = z.object({ email: z.string().trim().email().max(254).transform(x => x.toLowerCase()), reason: z.string().trim().min(5).max(300), password: z.string().min(12).max(128).optional() });
export async function GET(request: Request) {
  try {
    const auth = await access(request, false, true); if (auth.error) return auth.error;
    const rows = await getDb().select({ email: adminAccounts.email, createdAt: adminAccounts.createdAt }).from(adminAccounts);
    return Response.json({ rows: [{ email: ownerEmail(), isOwner: true }, ...rows.filter(r => r.email !== ownerEmail()).map(r => ({ ...r, isOwner: false }))] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return failure(request, 'unavailable', 503); }
}
async function change(request: Request, remove: boolean) {
  try {
    const auth = await access(request, true, true); if (auth.error) return auth.error;
    let body; try { body = await request.json(); } catch { return failure(request, 'invalid', 400); }
    const parsed = input.safeParse(body);
    if (!parsed.success || (!remove && !parsed.data.password)) return failure(request, 'adminInput', 400);
    const { email, password, reason } = parsed.data;
    if (email === ownerEmail() || email === request.headers.get('oai-authenticated-user-email')?.toLowerCase()) return failure(request, 'protectAdmin', 403);
    const existing = await adminAccount(email);
    if (!remove && existing) return failure(request, 'adminExists', 409);
    if (remove && !existing) return failure(request, 'notFound', 404);
    const db = getDb();
    const action = remove ? db.delete(adminAccounts).where(eq(adminAccounts.email, email)) : db.insert(adminAccounts).values({ email, passwordHash: await passwordHash(password!), addedBy: auth.owner!, createdAt: Date.now() });
    await db.batch([action, db.delete(adminSessions).where(eq(adminSessions.email, email)), db.insert(auditLogs).values({ id: crypto.randomUUID(), actorId: auth.owner!, action: remove ? 'adminRevoked' : 'adminGranted', targetId: email, reason, createdAt: Date.now() })]);
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return failure(request, 'unavailable', 503); }
}
export const POST = (request: Request) => change(request, false);
export const DELETE = (request: Request) => change(request, true);
