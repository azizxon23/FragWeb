import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { actor, access } from "@/lib/auth";
import { failure } from "@/lib/errors";
import { profileInput, validationIssue } from "@/lib/validation";
export async function GET(request: Request) {
  try {
    const owner = await actor(request);
    if (!owner) return failure(request, "signIn", 401);
    const profile = await getDb()
      .select()
      .from(profiles)
      .where(eq(profiles.ownerId, owner))
      .get();
    return Response.json(
      {
        profile: profile ? (({ ownerId, ...safe }) => safe)(profile) : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return failure(request, "unavailable", 503);
  }
}
export async function PUT(request: Request) {
  try {
    const auth = await access(request, true);
    if (auth.error) return auth.error;
    let body;
    try {
      body = await request.json();
    } catch {
      return failure(request, "invalid", 400);
    }
    const parsed = profileInput.safeParse(body);
    if (!parsed.success) {
      const e = validationIssue(parsed.error.issues[0]);
      return failure(request, e.code, 400, e.field, e.limit);
    }
    if (parsed.data.avatar) {
      const object = await env.BUCKET!.head(parsed.data.avatar.split('/').pop()!);
      if (!object || object.customMetadata?.owner !== auth.owner || object.customMetadata?.purpose !== 'avatar') return failure(request, 'ownPhotos', 400, 'avatar');
    }
    const now = Date.now();
    const email = auth.email!;
    await getDb()
      .insert(profiles)
      .values({
        ...parsed.data,
        id: crypto.randomUUID(),
        ownerId: auth.owner!,
        email,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: profiles.ownerId,
        set: { ...parsed.data, email, updatedAt: now },
      });
    return GET(request);
  } catch {
    return failure(request, "unavailable", 503);
  }
}
