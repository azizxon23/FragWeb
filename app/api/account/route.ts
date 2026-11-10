import { getDb } from '@/db';
import { profiles, marketplaceAccounts, marketplaceSessions } from '@/db/schema';
import { eq, or, sql } from 'drizzle-orm';
import { identity } from '@/lib/admin-auth';
import { sameOrigin } from '@/lib/auth';
import { digest, passwordHash, verifyPassword } from '@/lib/admin-password';
import { limited, marketSession, marketProfile, marketCookie, marketToken, newMarketSession, normalizeEmail } from '@/lib/market-auth';
import { failure } from '@/lib/errors';
import { z } from 'zod';
const credentials = z.object({ mode:z.enum(['login','signup','setup']), email:z.string().trim().email().max(254).transform(normalizeEmail), password:z.string().min(12).max(128), confirmPassword:z.string().optional(), displayName:z.string().trim().min(2).max(70).optional() });
export async function GET(request: Request) {
  try {
    const session=await marketSession(request), verified=identity(request);
    const account=verified ? await getDb().select({email:marketplaceAccounts.email}).from(marketplaceAccounts).where(or(eq(marketplaceAccounts.ownerId,verified.id),eq(marketplaceAccounts.email,verified.email))).get() : null;
    const legacy=verified ? await marketProfile(verified.id) : null;
    return Response.json({ signedIn:!!session, verifiedEmail:verified?.email || '', existing:!!account, needsSetup:!!legacy && !account },{headers:{'Cache-Control':'no-store'}});
  } catch { return failure(request,'unavailable',503); }
}
export async function POST(request: Request) {
  if(!sameOrigin(request)) return failure(request,'origin',403);
  try {
    if(Number(request.headers.get('content-length'))>4096) return failure(request,'invalid',400);
    let raw;try{raw=await request.json();}catch{return failure(request,'invalid',400);}
    const parsed=credentials.safeParse(raw); if(!parsed.success) return failure(request,raw && typeof raw==='object' && 'mode' in raw && raw.mode==='login'?'loginInput':'accountInput',400);
    const {mode,email,password,confirmPassword,displayName}=parsed.data;
    // Platform IP is provided by the trusted edge; identity/email quotas also apply.
    const ip=request.headers.get('cf-connecting-ip') || 'unknown';
    if(await limited('ip:'+await digest(ip),50) || await limited('email:'+await digest(email),10)) return failure(request,'adminRateLimit',429);
    const db=getDb();
    if(mode==='login') {
      const account=await db.select().from(marketplaceAccounts).where(eq(marketplaceAccounts.email,email)).get();
      // A dummy verifier keeps a nonexistent-email check on the same expensive path.
      const verifier=account?.passwordHash || 'pbkdf2$invalid-account$0000000000000000000000000000000000000000000000000000000000000000';
      const valid=await verifyPassword(password,verifier);
      if(!account || !valid) return failure(request,'loginCredentials',401);
      const profile=await marketProfile(account.ownerId);
      if(profile?.status==='suspended') return failure(request,'suspended',403);
      const token=await newMarketSession(account.ownerId);
      return Response.json({ok:true},{headers:{'Set-Cookie':marketCookie(token),'Cache-Control':'no-store'}});
    }
    const verified=identity(request);
    if(!verified || verified.email!==email) return failure(request,'verifyEmail',401);
    if(password!==confirmPassword) return failure(request,'passwordMismatch',400);
    const account=await db.select({owner:marketplaceAccounts.ownerId}).from(marketplaceAccounts).where(or(eq(marketplaceAccounts.email,email),eq(marketplaceAccounts.ownerId,verified.id))).get();
    if(account) return failure(request,'accountExists',409);
    const legacy=await marketProfile(verified.id);
    const byEmail=await db.select({owner:profiles.ownerId}).from(profiles).where(sql`lower(trim(${profiles.email})) = ${email}`).get();
    if(byEmail && byEmail.owner!==verified.id) return failure(request,'accountExists',409);
    if(mode==='signup' && legacy) return failure(request,'existingSetup',409);
    if(mode==='setup' && !legacy) return failure(request,'notFound',404);
    if(legacy?.status==='suspended') return failure(request,'suspended',403);
    if(!legacy && !displayName) return failure(request,'accountInput',400);
    const hash=await passwordHash(password),now=Date.now();
    try {
      if(legacy) await db.insert(marketplaceAccounts).values({ownerId:verified.id,email,passwordHash:hash,createdAt:now});
      else await db.batch([
        db.insert(marketplaceAccounts).values({ownerId:verified.id,email,passwordHash:hash,createdAt:now}),
        db.insert(profiles).values({id:crypto.randomUUID(),ownerId:verified.id,email,displayName:displayName!,phone:'',telegram:'',city:'Tashkent',bio:'',avatar:'',createdAt:now,updatedAt:now}),
      ]);
    } catch(error) { if(/unique|constraint/i.test(String(error))) return failure(request,'accountExists',409); throw error; }
    return Response.json({ok:true},{status:201,headers:{'Set-Cookie':marketCookie(await newMarketSession(verified.id)),'Cache-Control':'no-store'}});
  } catch { return failure(request,'unavailable',503); }
}
export async function DELETE(request: Request) {
  if(!sameOrigin(request)) return failure(request,'origin',403);
  try {
    const token=marketToken(request);
    if(token) await getDb().delete(marketplaceSessions).where(eq(marketplaceSessions.tokenHash,await digest(token)));
    return Response.json({ok:true},{headers:{'Set-Cookie':marketCookie('',0),'Cache-Control':'no-store'}});
  } catch { return failure(request,'unavailable',503); }
}
