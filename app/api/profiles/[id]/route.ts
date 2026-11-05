import { getDb } from "@/db";
import { profiles, listings } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { failure } from "@/lib/errors";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const p = await getDb()
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, id), eq(profiles.status, "active")))
      .get();
    if (!p) return failure(request, "notFound", 404);
    const [total] = await getDb()
      .select({ count: count() })
      .from(listings)
      .where(
        and(
          eq(listings.ownerId, p.ownerId),
          eq(listings.status, "active"),
          eq(listings.moderationStatus, "visible"),
        ),
      );
    return Response.json(
      {
        id: p.id,
        displayName: p.displayName,
        city: p.city,
        bio: p.bio,
        telegram: p.telegram,
        createdAt: p.createdAt,
        listingCount: total.count,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return failure(request, "unavailable", 503);
  }
}
