import { digest } from './admin-password';
import { env } from 'cloudflare:workers';
import { getDb } from '@/db';
import { adminAccounts, adminSessions } from '@/db/schema';
import { and, eq, gt } from 'drizzle-orm';

const COOKIE = '__Host-fragweb-admin';
const config = () => env as unknown as Record<string, string>;
export const ownerEmail = () => (config().FRAGWEB_OWNER_EMAIL || '').trim().toLowerCase();
export function identity(request: Request) {
  const id = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  return id && email ? { id: 'chatgpt:' + id, email } : null;
}
export async function adminAccount(email: string) {
  if (email === ownerEmail() && ownerEmail()) {
    const hash = config().FRAGWEB_OWNER_PASSWORD_HASH;
    return hash ? { email, passwordHash: hash, isOwner: true } : null;
  }
  const account = await getDb().select().from(adminAccounts).where(eq(adminAccounts.email, email)).get();
  return account ? { ...account, isOwner: false } : null;
}
export function sessionToken(request: Request) {
  return request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) || '';
}
export function sessionCookie(token: string, maxAge = 28800) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
export async function adminSession(request: Request) {
  const user = identity(request), token = sessionToken(request);
  if (!user || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await getDb().select().from(adminSessions).where(and(eq(adminSessions.tokenHash, await digest(token)), eq(adminSessions.ownerId, user.id), eq(adminSessions.email, user.email), gt(adminSessions.expiresAt, Date.now()))).get();
  if (!session) return null;
  const account = await adminAccount(user.email);
  if (!account || await digest(account.passwordHash) !== session.passwordVersion) return null;
  return { ...user, isOwner: account.isOwner };
}
