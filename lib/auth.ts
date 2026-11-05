import { env } from "cloudflare:workers";
import { validateTelegramInitData } from "./telegram";
import { isAdministrator } from "./permissions";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { failure } from "./errors";
export async function actor(request: Request): Promise<string | null> {
  const id = request.headers.get("oai-authenticated-user-id");
  if (id) return "chatgpt:" + id;
  const raw = request.headers.get("x-telegram-init-data");
  const token = (env as unknown as Record<string, string>).TELEGRAM_BOT_TOKEN;
  return raw && token ? validateTelegramInitData(raw, token) : null;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}
export function trustedEmail(request: Request) {
  return request.headers.get("oai-authenticated-user-id")
    ? request.headers.get("oai-authenticated-user-email") || ""
    : "";
}
export function isAdmin(request: Request, owner: string | null) {
  return isAdministrator(
    owner,
    trustedEmail(request),
    (env as unknown as Record<string, string>).FRAGWEB_ADMIN_EMAILS,
  );
}
export async function access(request: Request, write = false, admin = false) {
  if (write && !sameOrigin(request))
    return { error: failure(request, "origin", 403) };
  const owner = await actor(request);
  if (!owner) return { error: failure(request, "signIn", 401) };
  if (admin && !isAdmin(request, owner))
    return { error: failure(request, "adminOnly", 403) };
  const profile = await getDb()
    .select()
    .from(profiles)
    .where(eq(profiles.ownerId, owner))
    .get();
  if (profile?.status === "suspended")
    return { error: failure(request, "suspended", 403) };
  return { owner, profile, isAdmin: isAdmin(request, owner) };
}
