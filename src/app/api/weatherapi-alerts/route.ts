import {NextRequest,NextResponse} from "next/server";
export const runtime="nodejs";
type Alert={headline:string,event:string,severity:string,areas:string,description:string,instruction:string,effective:string,expires:string};
function safe(s:unknown,n=1500){return typeof s==="string"?s.slice(0,n):""}
export async function GET(req:NextRequest){
 const lat=Number(req.nextUrl.searchParams.get("lat")),lon=Number(req.nextUrl.searchParams.get("lon"));
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return NextResponse.json({status:"error",message:"Invalid location coordinates.",alerts:[]},{status:400});
 const key=process.env.WEATHERAPI_KEY;
 if(!key)return NextResponse.json({status:"unconfigured",message:"Add WEATHERAPI_KEY to Vercel Production environment, then redeploy.",alerts:[]});
 const url=new URL("https://api.weatherapi.com/v1/alerts.json");
 url.searchParams.set("key",key);url.searchParams.set("q",lat+","+lon);
 try{
  const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),10000);
  let res:Response;
  try{res=await fetch(url,{signal:ctl.signal,next:{revalidate:600}})}finally{clearTimeout(timer)}
  if(!res.ok){let detail="";try{const j=await res.json();detail=safe(j?.error?.message,220)}catch{}
   return NextResponse.json({status:"unavailable",message:res.status===403||res.status===401?"WeatherAPI rejected the key or alerts endpoint is not available on this plan.":res.status===429?"WeatherAPI usage limit reached.":detail||"WeatherAPI request failed (HTTP "+res.status+").",alerts:[]});
  }
  const data=await res.json();
  if(!data||!data.alerts||!Array.isArray(data.alerts.alert))return NextResponse.json({status:"unavailable",message:"Provider did not return a verifiable alerts response.",alerts:[]});
  const alerts:Alert[]=data.alerts.alert.slice(0,25).map((a:Record<string,unknown>)=>({headline:safe(a.headline,250),event:safe(a.event,150),severity:safe(a.severity,60),areas:safe(a.areas,250),description:safe(a.desc||a.description),instruction:safe(a.instruction),effective:safe(a.effective,100),expires:safe(a.expires,100)}));
  return NextResponse.json({status:"available",alerts,checkedAt:new Date().toISOString(),provider:"WeatherAPI.com",coverageNote:"Coverage of UAE government alerts is not independently verified."});
 }catch{return NextResponse.json({status:"unavailable",message:"WeatherAPI alerts could not be reached.",alerts:[]})}
}
