import {actor} from "@/lib/auth";
export async function GET(request:Request){return Response.json({signedIn:!!(await actor(request))},{headers:{"Cache-Control":"no-store"}});}
