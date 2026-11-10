import { marketSession } from "./market-auth";
import { env } from "cloudflare:workers";
import { validateTelegramInitData } from "./telegram";
import { adminSession } from "./admin-auth";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { failure } from "./errors";
export async function verifiedActor(request: Request): Promise<string | null> {
  const id = request.headers.get("oai-authenticated-user-id");
  if (id) return "chatgpt:" + id;
  const raw = request.headers.get("x-telegram-init-data");
  const token = (env as unknown as Record<string, string>).TELEGRAM_BOT_TOKEN;
  return raw && token ? validateTelegramInitData(raw, token) : null;
}
export async function actor(request: Request) { return (await marketSession(request))?.owner || null; }
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}
export function trustedEmail(request: Request) {
  return request.headers.get("oai-authenticated-user-id")
    ? request.headers.get("oai-authenticated-user-email") || ""
    : "";
}
export async function access(request: Request, write = false, admin = false) {
  if (write && !sameOrigin(request))
    return { error: failure(request, "origin", 403) };
  const session = admin ? null : await marketSession(request);
  const owner = admin ? await verifiedActor(request) : session?.owner;
  if (!owner) return { error: failure(request, "signIn", 401) };
  if (admin && !await adminSession(request))
    return { error: failure(request, "adminOnly", 403) };
  const profile = await getDb()
    .select()
    .from(profiles)
    .where(eq(profiles.ownerId, owner))
    .get();
  if (profile?.status === "suspended")
    return { error: failure(request, "suspended", 403) };
  return { owner, profile, email: admin ? trustedEmail(request) : session?.email };
}
