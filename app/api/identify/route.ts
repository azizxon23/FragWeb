import {identify} from "@/lib/catalog";
export async function GET(request:Request){const query=new URL(request.url).searchParams.get("q")||"";return Response.json({method:"catalog-name-match",results:identify(query.slice(0,120))});}
