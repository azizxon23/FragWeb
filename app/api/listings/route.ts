import {getDb} from "@/db";
import {listings} from "@/db/schema";
import {desc,eq,and} from "drizzle-orm";
import {actor,sameOrigin} from "@/lib/auth";
import {listingInput} from "@/lib/validation";
import {env} from "cloudflare:workers";
export async function GET(request:Request){try{const mine=new URL(request.url).searchParams.get("mine")==="1";const owner=mine?await actor(request):null;if(mine&&!owner)return Response.json({error:"Sign in to view your listings"},{status:401});const rows=await getDb().select().from(listings).where(mine?eq(listings.ownerId,owner!):eq(listings.status,"active")).orderBy(desc(listings.createdAt)).limit(200);return Response.json(rows.map(({phone,ownerId,...r})=>({...r,photos:JSON.parse(r.photos)})),{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({error:"The marketplace is temporarily unavailable. Please try again."},{status:503});}}
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:"Invalid origin"},{status:403});const owner=await actor(request);if(!owner)return Response.json({error:"Sign in to publish a listing"},{status:401});
 try{const parsed=listingInput.safeParse(await request.json());if(!parsed.success)return Response.json({error:parsed.error.issues[0].message,field:parsed.error.issues[0].path[0]},{status:400});
 const data=parsed.data;
 for(const path of data.photos){const obj=await env.BUCKET!.head(path.split("/").pop()!);if(!obj||obj.customMetadata?.owner!==owner)return Response.json({error:"Upload your own listing photos"},{status:400});}
 const id=crypto.randomUUID();await getDb().insert(listings).values({...data,id,ownerId:owner,photos:JSON.stringify(data.photos),createdAt:Date.now(),status:"active"});return Response.json({id},{status:201});
 }catch{return Response.json({error:"Could not publish. Please try again."},{status:503});}}
export async function PATCH(request:Request){if(!sameOrigin(request))return Response.json({error:"Invalid origin"},{status:403});const owner=await actor(request);if(!owner)return Response.json({error:"Sign in required"},{status:401});try{const {id}=await request.json() as {id?:unknown};if(typeof id!=="string")return Response.json({error:"Invalid listing"},{status:400});const result=await getDb().update(listings).set({status:"sold"}).where(and(eq(listings.id,id),eq(listings.ownerId,owner))).returning({id:listings.id});return result.length?Response.json({ok:true}):Response.json({error:"Listing not found"},{status:404});}catch{return Response.json({error:"Could not update listing"},{status:503});}}
