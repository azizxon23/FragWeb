import { getDb } from "@/db";
import { profiles, listings, auditLogs } from "@/db/schema";
import { eq, desc, count, or, like, sql } from "drizzle-orm";
import { access } from "@/lib/auth";
import { adminAccount } from "@/lib/admin-auth";
import { adminAction, validationIssue } from "@/lib/validation";
import { failure } from "@/lib/errors";
export async function GET(request: Request) {
  try {
    const auth = await access(request, false, true);
    if (auth.error) return auth.error;
    const db = getDb(),
      params = new URL(request.url).searchParams;
    const section = params.get("section") || "users",
      query = (params.get("q") || "").slice(0, 100);
    const rawPage = Number(params.get("page") || 1);
    const page = Number.isFinite(rawPage)
      ? Math.max(1, Math.min(100000, Math.floor(rawPage)))
      : 1;
    const limit = 20,
      offset = (page - 1) * limit;
    const [userStats] = await db
      .select({
        total: count(),
        suspended: sql<number>`coalesce(sum(case when ${profiles.status} = 'suspended' then 1 else 0 end),0)`,
      })
      .from(profiles);
    const [listingStats] = await db
      .select({
        total: count(),
        active: sql<number>`coalesce(sum(case when ${listings.status} = 'active' then 1 else 0 end),0)`,
        hidden: sql<number>`coalesce(sum(case when ${listings.moderationStatus} = 'hidden' then 1 else 0 end),0)`,
      })
      .from(listings);
    const stats = {
      users: userStats.total,
      suspended: userStats.suspended,
      listings: listingStats.total,
      active: listingStats.active,
      hidden: listingStats.hidden,
    };
    if (section === "users") {
      const filter = query
        ? or(
            like(profiles.displayName, `%${query}%`),
            like(profiles.telegram, `%${query}%`),
            like(profiles.email, `%${query}%`),
          )
        : undefined;
      const [{ total }] = await db
        .select({ total: count() })
        .from(profiles)
        .where(filter);
      const rows = await db
        .select()
        .from(profiles)
        .where(filter)
        .orderBy(desc(profiles.createdAt))
        .limit(limit)
        .offset(offset);
      return Response.json(
        {
          stats,
          total,
          page,
          rows: await Promise.all(rows.map(async ({ ownerId, ...r }) => ({
            ...r,
            isAdmin: !!await adminAccount(r.email.toLowerCase()),
          }))),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (section === "listings") {
      const filter = query
        ? or(
            like(listings.name, `%${query}%`),
            like(listings.brand, `%${query}%`),
            like(listings.seller, `%${query}%`),
          )
        : undefined;
      const [{ total }] = await db
        .select({ total: count() })
        .from(listings)
        .where(filter);
      const rows = await db
        .select()
        .from(listings)
        .where(filter)
        .orderBy(desc(listings.createdAt))
        .limit(limit)
        .offset(offset);
      return Response.json(
        {
          stats,
          total,
          page,
          rows: rows.map(({ ownerId, phone, ...r }) => ({
            ...r,
            photos: JSON.parse(r.photos),
          })),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (section === "audit") {
      const [{ total }] = await db.select({ total: count() }).from(auditLogs);
      const rows = await db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          targetId: auditLogs.targetId,
          reason: auditLogs.reason,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);
      return Response.json(
        { stats, total, page, rows },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return failure(request, "invalid", 400);
  } catch {
    return failure(request, "unavailable", 503);
  }
}
export async function PATCH(request: Request) {
  try {
    const auth = await access(request, true, true);
    if (auth.error) return auth.error;
    let body;
    try {
      body = await request.json();
    } catch {
      return failure(request, "invalid", 400);
    }
    const parsed = adminAction.safeParse(body);
    if (!parsed.success) {
      const e = validationIssue(parsed.error.issues[0]);
      return failure(request, e.code, 400, e.field, e.limit);
    }
    const data = parsed.data,
      db = getDb();
    if (data.action === "userStatus") {
      const target = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, data.id))
        .get();
      if (!target) return failure(request, "notFound", 404);
      if (
        target.ownerId === auth.owner ||
        !!await adminAccount(target.email.toLowerCase())
      )
        return failure(request, "protectAdmin", 403);
      await db.batch([
        db
          .update(profiles)
          .set({ status: data.status, updatedAt: Date.now() })
          .where(eq(profiles.id, data.id)),
        db
          .insert(auditLogs)
          .values({
            id: crypto.randomUUID(),
            actorId: auth.owner!,
            action: data.status === "active" ? "userRestored" : "userSuspended",
            targetId: data.id,
            reason: data.reason,
            createdAt: Date.now(),
          }),
      ]);
    } else {
      const target = await db
        .select({ id: listings.id })
        .from(listings)
        .where(eq(listings.id, data.id))
        .get();
      if (!target) return failure(request, "notFound", 404);
      await db.batch([
        db
          .update(listings)
          .set({ moderationStatus: data.visibility })
          .where(eq(listings.id, data.id)),
        db
          .insert(auditLogs)
          .values({
            id: crypto.randomUUID(),
            actorId: auth.owner!,
            action:
              data.visibility === "visible"
                ? "listingRestored"
                : "listingHidden",
            targetId: data.id,
            reason: data.reason,
            createdAt: Date.now(),
          }),
      ]);
    }
    return Response.json({ ok: true });
  } catch {
    return failure(request, "unavailable", 503);
  }
}
