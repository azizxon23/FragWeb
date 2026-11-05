import { actor, isAdmin } from "@/lib/auth";
export async function GET(request: Request) {
  const owner = await actor(request);
  return Response.json(
    { signedIn: !!owner, isAdmin: isAdmin(request, owner) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
