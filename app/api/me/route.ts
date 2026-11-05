import { actor } from "@/lib/auth";
export async function GET(request: Request) {
  const owner = await actor(request);
  return Response.json(
    { signedIn: !!owner },
    { headers: { "Cache-Control": "no-store" } },
  );
}
