// Test-only Worker: synthetic identity headers simulate trusted Sites dispatch.
// This entrypoint is never deployed by the application or the Sites build.
import * as listing from "../../app/api/listings/route";
import * as profile from "../../app/api/profile/route";
import * as admin from "../../app/api/admin/route";
import * as uploads from "../../app/api/uploads/route";
import * as publicProfile from "../../app/api/profiles/[id]/route";
import * as image from "../../app/api/images/[key]/route";
import * as adminSession from "../../app/api/admin/session/route";
import * as adminAccounts from "../../app/api/admin/accounts/route";
import * as me from "../../app/api/me/route";
const routes: Record<
  string,
  Record<string, (request: Request) => Promise<Response>>
> = {
  "/api/listings": listing,
  "/api/profile": profile,
  "/api/admin": admin,
  "/api/admin/session": adminSession,
  "/api/admin/accounts": adminAccounts,
  "/api/uploads": uploads,
  "/api/me": me,
};
export default {
  async fetch(request: Request) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/profiles/"))
      return publicProfile.GET(request, {
        params: Promise.resolve({ id: path.split("/").pop()! }),
      });
    if (path.startsWith("/api/images/"))
      return image.GET(request, {
        params: Promise.resolve({ key: path.split("/").pop()! }),
      });
    const handler = routes[path]?.[request.method];
    return handler
      ? handler(request)
      : new Response("Not found", { status: 404 });
  },
};
