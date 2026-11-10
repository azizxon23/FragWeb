import { getDb } from "@/db";
import { listings, profiles } from "@/db/schema";
import { desc, eq, ne, and, or, isNull } from "drizzle-orm";
import { actor, access } from "@/lib/auth";
import { listingInput, profileInput, validationIssue } from "@/lib/validation";
import { failure } from "@/lib/errors";
import { env } from "cloudflare:workers";
export async function GET(request: Request) {
  try {
    const mine = new URL(request.url).searchParams.get("mine") === "1";
    const owner = mine ? await actor(request) : null;
    if (mine && !owner) return failure(request, "signIn", 401);
    const rows = await getDb()
      .select({
        listing: listings,
        profileId: profiles.id,
        displayName: profiles.displayName,
        city: profiles.city,
        telegram: profiles.telegram,
      })
      .from(listings)
      .leftJoin(profiles, eq(listings.ownerId, profiles.ownerId))
      .where(
        mine
          ? and(eq(listings.ownerId, owner!),ne(listings.status,"archived"))
          : and(
              eq(listings.status, "active"),
              eq(listings.moderationStatus, "visible"),
              or(isNull(profiles.id), eq(profiles.status, "active")),
            ),
      )
      .orderBy(desc(listings.createdAt))
      .limit(200);
    return Response.json(
      rows.map(
        ({
          listing: { phone, ownerId, ...r },
          profileId,
          displayName,
          city,
          telegram,
        }) => ({
          ...r,
          profileId,
          seller: displayName || r.seller,
          city: city || r.city,
          telegram: telegram || r.telegram,
          photos: JSON.parse(r.photos),
        }),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return failure(request, "unavailable", 503);
  }
}
export async function POST(request: Request) {
  try {
    const auth = await access(request, true);
    if (auth.error) return auth.error;
    if (!auth.profile || !profileInput.safeParse(auth.profile).success) return failure(request, "profileRequired", 409);
    let raw;
    try {
      raw = await request.json();
    } catch {
      return failure(request, "invalid", 400);
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      return failure(request, "invalid", 400);
    const body = raw as Record<string, unknown>;
    // Contact data comes from the account, not untrusted per-listing identity fields.
    const parsed = listingInput.safeParse({
      ...body,
      seller: auth.profile.displayName,
      phone: auth.profile.phone,
      telegram: auth.profile.telegram,
      city: auth.profile.city,
    });
    if (!parsed.success) {
      const e = validationIssue(parsed.error.issues[0]);
      return failure(request, e.code, 400, e.field, e.limit);
    }
    const data = parsed.data;
    for (const path of data.photos) {
      const obj = await env.BUCKET!.head(path.split("/").pop()!);
      if (!obj || obj.customMetadata?.owner !== auth.owner || obj.customMetadata?.purpose === "avatar")
        return failure(request, "ownPhotos", 400, "photos");
    }
    const id = crypto.randomUUID();
    await getDb()
      .insert(listings)
      .values({
        ...data,
        id,
        ownerId: auth.owner!,
        photos: JSON.stringify(data.photos),
        createdAt: Date.now(),
        status: "active",
      });
    return Response.json({ id }, { status: 201 });
  } catch {
    return failure(request, "unavailable", 503);
  }
}
export async function PATCH(request: Request) {
  try {
    const auth = await access(request, true);
    if (auth.error) return auth.error;
    const body = (await request.json()) as { id?: unknown };
    if (typeof body.id !== "string") return failure(request, "invalid", 400);
    const result = await getDb()
      .update(listings)
      .set({ status: "sold" })
      .where(and(eq(listings.id, body.id), eq(listings.ownerId, auth.owner!)))
      .returning({ id: listings.id });
    return result.length
      ? Response.json({ ok: true })
      : failure(request, "notFound", 404);
  } catch {
    return failure(request, "unavailable", 503);
  }
}
