export async function passwordHash(password: string, salt = crypto.randomUUID()) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bytes = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 }, key, 256);
  return `pbkdf2$${salt}$${hex(bytes)}`;
}
function hex(bytes: ArrayBuffer) { return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join(''); }
export async function digest(value: string) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))); }
export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false;
  const actual = await passwordHash(password, parts[1]);
  let diff = actual.length ^ stored.length;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ (stored.charCodeAt(i) || 0);
  return diff === 0;
}
