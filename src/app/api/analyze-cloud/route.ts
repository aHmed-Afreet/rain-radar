import {NextRequest,NextResponse} from "next/server";
export const runtime="nodejs";
const allowed=new Set(["image/jpeg","image/png","image/webp"]);
export async function POST(request:NextRequest){
 const key=process.env.GEMINI_API_KEY;
 if(!key)return NextResponse.json({error:"CloudIQ needs a free Gemini API key configured in Vercel (GEMINI_API_KEY)."}, {status:503});
 let form:FormData;
 try{form=await request.formData()}catch{return NextResponse.json({error:"Invalid upload."},{status:400})}
 const file=form.get("image");
 if(!(file instanceof File)||!allowed.has(file.type))return NextResponse.json({error:"Select a JPEG, PNG or WebP photo."},{status:400});
 if(file.size>4*1024*1024)return NextResponse.json({error:"Image must be under 4 MB."},{status:413});
 const base64=Buffer.from(await file.arrayBuffer()).toString("base64");
 try{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
  let response:Response;
  try{response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},signal:controller.signal,body:JSON.stringify({contents:[{parts:[{text:"You are CloudIQ, an educational cloud identification assistant. Inspect this sky photo. Name the most likely cloud genus or genera, explain visible visual clues and typical weather associations. When the photo is ambiguous, say so. Never claim a reliable rain forecast or severe-weather warning from a photo alone. Reply concisely with headings: Likely clouds, Visual clues, What they can indicate, Limits."},{inline_data:{mime_type:file.type,data:base64}}]}],generationConfig:{maxOutputTokens:350}})})}finally{clearTimeout(timer)}
  if(!response.ok)return NextResponse.json({error:response.status===429?"Gemini rate limit reached. Try again later or check your project quota.":response.status===403?"Gemini access denied. Check your project free-tier eligibility, region, and API key restrictions.":response.status===404?"Gemini model unavailable for this project. Check the model access in Google AI Studio.":response.status===400?"Gemini rejected this image request. Try a smaller JPEG or PNG.":"Gemini request failed (HTTP "+response.status+"). Check Vercel function logs."},{status:502});
  const data=await response.json();
  const answer=(data.candidates?.[0]?.content?.parts||[]).map((part:{text?:string})=>part.text||"").join("\n").trim();
  if(!answer)return NextResponse.json({error:"AI returned no analysis. Please try another photo."},{status:502});
  return NextResponse.json({analysis:answer});
 }catch{return NextResponse.json({error:"Cloud analysis timed out or is temporarily unavailable."},{status:502})}
}
