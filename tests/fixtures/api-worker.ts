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
import * as account from "../../app/api/account/route";
import * as cleanup from "../../app/api/admin/cleanup/route";
import * as adminUser from "../../app/api/admin/users/[id]/route";
import * as providerConfig from "../../app/api/auth/providers/route";
import * as oauthStart from "../../app/api/auth/[provider]/start/route";
import * as oauthCallback from "../../app/api/auth/[provider]/callback/route";
import * as phoneAuth from "../../app/api/auth/phone/route";
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
  "/api/account": account,
  "/api/auth/providers": providerConfig,
  "/api/auth/phone": phoneAuth,
  "/api/admin/cleanup": cleanup,
};
export default {
  async fetch(request: Request) {
    const path = new URL(request.url).pathname;
    const oauth=path.match(/^\/api\/auth\/(google|telegram)\/(start|callback)$/);
    if(oauth) {const params={params:Promise.resolve({provider:oauth[1]})};return oauth[2]==='start'&&request.method==='POST'?oauthStart.POST(request,params):oauth[2]==='callback'&&request.method==='GET'?oauthCallback.GET(request,params):new Response('Method not allowed',{status:405});}
    if (path.startsWith("/api/admin/users/")) return adminUser.GET(request,{params:Promise.resolve({id:path.split("/").pop()!})});
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
