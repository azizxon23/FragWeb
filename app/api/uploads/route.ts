import {env} from "cloudflare:workers";
import {actor,sameOrigin} from "@/lib/auth";
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:"Invalid origin"},{status:403});const owner=await actor(request);if(!owner)return Response.json({error:"Sign in to upload photos"},{status:401});
 if(Number(request.headers.get("content-length"))>5500000)return Response.json({error:"Maximum photo size is 5 MB"},{status:413});
 try{const data=await request.formData();const photo=data.get("photo");if(!(photo instanceof File)||photo.size>5*1024*1024||photo.size<12)return Response.json({error:"Choose a JPG, PNG or WebP under 5 MB"},{status:400});
 const bytes=new Uint8Array(await photo.arrayBuffer());let ext="",type="";
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){ext="jpg";type="image/jpeg";}else if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71){ext="png";type="image/png";}else if(String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP"){ext="webp";type="image/webp";}else return Response.json({error:"Unsupported image format"},{status:400});
 const key=crypto.randomUUID()+"."+ext;await env.BUCKET!.put(key,bytes,{httpMetadata:{contentType:type},customMetadata:{owner}});return Response.json({url:"/api/images/"+key});
 }catch{return Response.json({error:"Upload failed. Please try again."},{status:503});}}
