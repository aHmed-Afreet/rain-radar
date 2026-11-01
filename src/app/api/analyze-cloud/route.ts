import {NextRequest,NextResponse} from "next/server";
export const runtime="nodejs";
const allowed=new Set(["image/jpeg","image/png","image/webp"]);
const statuses=new Set(["Possible signs","No clear signs","Uncertain"]);
function clean(value:unknown,max=210){return typeof value==="string"?value.slice(0,max):""}
export async function POST(request:NextRequest){
 const key=process.env.GEMINI_API_KEY;
 if(!key)return NextResponse.json({error:"CloudIQ is not configured. Add GEMINI_API_KEY to Vercel."},{status:503});
 let form:FormData;try{form=await request.formData()}catch{return NextResponse.json({error:"Invalid upload."},{status:400})}
 const file=form.get("image");
 if(!(file instanceof File)||!allowed.has(file.type))return NextResponse.json({error:"Choose a JPEG, PNG or WebP sky photo."},{status:400});
 if(file.size>4*1024*1024)return NextResponse.json({error:"Image must be below 4 MB."},{status:413});
 const b64=Buffer.from(await file.arrayBuffer()).toString("base64");
 const prompt=`You are CloudIQ, an educational sky-photo interpretation tool. Inspect ONLY observable features in the photo. Return JSON ONLY and use this exact schema:
{"cloudType":"brief common name or 'Unclear'","summary":"one natural sentence, max 24 words","rain":{"status":"Possible signs|No clear signs|Uncertain","reason":"one short sentence"},"heavyRain":{"status":"Possible signs|No clear signs|Uncertain","reason":"one short sentence"},"hail":{"status":"Possible signs|No clear signs|Uncertain","reason":"one short sentence"},"thunderstorm":{"status":"Possible signs|No clear signs|Uncertain","reason":"one short sentence"},"watchFor":"one simple observable change to watch for"}
If towering convective clouds are clearly visible you may mark POSSIBLE signs of showers/thunderstorms, but do NOT predict that they will occur, severity, timing, probability, hail or official warnings from the photo. Choose Uncertain when unclear. No clear signs does not mean safe or zero chance. The statuses describe VISIBLE CLOUD CLUES only, NOT forecasts. Be cautious and concise. Do not output markdown.`;
 try{
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),20000);
  let res:Response;try{res=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",{method:"POST",signal:ctrl.signal,headers:{"Content-Type":"application/json","x-goog-api-key":key},body:JSON.stringify({contents:[{parts:[{text:prompt},{inline_data:{mime_type:file.type,data:b64}}]}],generationConfig:{responseMimeType:"application/json",maxOutputTokens:650}})})}finally{clearTimeout(timer)}
  if(!res.ok)return NextResponse.json({error:res.status===429?"Free Gemini quota reached. Try again later.":res.status===403?"Gemini access denied. Check key and regional eligibility.":res.status===404?"Gemini model unavailable to this project.":"Gemini request failed (HTTP "+res.status+")."},{status:502});
  const data=await res.json();const raw=(data.candidates?.[0]?.content?.parts||[]).map((p:{text?:string})=>p.text||"").join("").trim();
  let value:any;try{value=JSON.parse(raw.replace(/^\x60\x60\x60(?:json)?\s*/i,"").replace(/\s*\x60\x60\x60$/,""))}catch{return NextResponse.json({error:"AI returned an unreadable result. Please try again."},{status:502})}
  const section=(x:any)=>({status:statuses.has(x?.status)?x.status:"Uncertain",reason:clean(x?.reason)});
  return NextResponse.json({result:{cloudType:clean(value.cloudType,65)||"Unclear",summary:clean(value.summary),rain:section(value.rain),heavyRain:section(value.heavyRain),hail:section(value.hail),thunderstorm:section(value.thunderstorm),watchFor:clean(value.watchFor)}})
 }catch{return NextResponse.json({error:"Cloud analysis is temporarily unavailable."},{status:502})}
}
