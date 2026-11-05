import { env } from "cloudflare:workers";
import { access } from "@/lib/auth";
import { failure } from "@/lib/errors";
export async function POST(request: Request) {
  try {
    const auth = await access(request, true);
    if (auth.error) return auth.error;
    if (!auth.profile) return failure(request, "profileRequired", 409);
    if (Number(request.headers.get("content-length")) > 5500000)
      return failure(request, "photoSize", 413);
    const data = await request.formData();
    const photo = data.get("photo");
    if (!(photo instanceof File) || photo.size < 12)
      return failure(request, "photoType", 400);
    if (photo.size > 5 * 1024 * 1024) return failure(request, "photoSize", 413);
    const bytes = new Uint8Array(await photo.arrayBuffer());
    let ext = "",
      type = "";
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
      ext = "jpg";
      type = "image/jpeg";
    } else if (
      bytes[0] === 137 &&
      bytes[1] === 80 &&
      bytes[2] === 78 &&
      bytes[3] === 71
    ) {
      ext = "png";
      type = "image/png";
    } else if (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    ) {
      ext = "webp";
      type = "image/webp";
    } else return failure(request, "photoType", 400);
    const key = crypto.randomUUID() + "." + ext;
    await env.BUCKET!.put(key, bytes, {
      httpMetadata: { contentType: type },
      customMetadata: { owner: auth.owner! },
    });
    return Response.json({ url: "/api/images/" + key });
  } catch {
    return failure(request, "unavailable", 503);
  }
}
