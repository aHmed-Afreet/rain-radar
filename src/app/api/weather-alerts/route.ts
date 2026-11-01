import {NextRequest,NextResponse} from "next/server";
export const runtime="nodejs";
type Alert={event:string,sender_name:string,start:number,end:number,description:string,tags?:string[]};
const cache=new Map<string,{until:number,body:unknown}>();
export async function GET(request:NextRequest){
 const lat=Number(request.nextUrl.searchParams.get("lat")),lon=Number(request.nextUrl.searchParams.get("lon"));
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return NextResponse.json({status:"error",message:"Invalid coordinates"},{status:400});
 const key=process.env.OPENWEATHER_API_KEY;
 if(!key)return NextResponse.json({status:"unconfigured",message:"Add OPENWEATHER_API_KEY to the Vercel Production environment to retrieve provider weather alerts.",alerts:[]});
 const bucket=Math.round(lat*10)/10+":"+Math.round(lon*10)/10;
 const existing=cache.get(bucket);if(existing&&existing.until>Date.now())return NextResponse.json(existing.body);
 try{
  const url=new URL("https://api.openweathermap.org/data/3.0/onecall");
  url.searchParams.set("lat",String(lat));url.searchParams.set("lon",String(lon));
  url.searchParams.set("exclude","current,minutely,hourly,daily");
  url.searchParams.set("appid",key);
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
  let response:Response;
  try{response=await fetch(url,{signal:controller.signal,cache:"no-store"})}finally{clearTimeout(timeout)}
  if(!response.ok)return NextResponse.json({status:"unavailable",message:response.status===401||response.status===403?"OpenWeather key or One Call subscription is not authorized.":response.status===429?"OpenWeather quota reached.":"OpenWeather alerts could not be retrieved.",alerts:[]});
  const raw=await response.json();
  const alerts:Alert[]=Array.isArray(raw.alerts)?raw.alerts.filter((a:any)=>a&&typeof a.event==="string").slice(0,20).map((a:any)=>({event:String(a.event).slice(0,150),sender_name:String(a.sender_name||"Provider-supplied authority").slice(0,120),start:Number(a.start)||0,end:Number(a.end)||0,description:String(a.description||"").slice(0,1800),tags:Array.isArray(a.tags)?a.tags.filter((t:any)=>typeof t==="string").slice(0,8):[]})):[];
  const body={status:"available",checkedAt:new Date().toISOString(),alerts,source:"OpenWeather One Call 3.0; supplied alert authority shown per item"};
  cache.set(bucket,{until:Date.now()+600000,body});if(cache.size>100)cache.clear();
  return NextResponse.json(body,{headers:{"Cache-Control":"private, max-age=0"}});
 }catch{return NextResponse.json({status:"unavailable",message:"Alert provider timed out or was unreachable.",alerts:[]})}
}
