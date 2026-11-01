import {NextRequest,NextResponse} from "next/server";
export const runtime="nodejs";
const allowed=new Set(["image/jpeg","image/png","image/webp"]);
export async function POST(request:NextRequest){
  const key=process.env.OPENAI_API_KEY;
  if(!key)return NextResponse.json({error:"Cloud analysis is not configured yet. The site administrator needs to add OPENAI_API_KEY in Vercel."},{status:503});
  let form:FormData;
  try{form=await request.formData()}catch{return NextResponse.json({error:"Invalid upload"},{status:400})}
  const file=form.get("image");
  if(!(file instanceof File)||!allowed.has(file.type))return NextResponse.json({error:"Please select a JPEG, PNG or WebP sky image."},{status:400});
  if(file.size>4*1024*1024)return NextResponse.json({error:"Image must be under 4 MB."},{status:413});
  const base64=Buffer.from(await file.arrayBuffer()).toString("base64");
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({model:"gpt-4.1-mini",max_output_tokens:350,input:[{role:"user",content:[{type:"input_text",text:"You are CloudIQ, an educational cloud identification assistant. Examine the attached sky photo. Describe the most likely visible cloud genus or genera, visual clues, and typical weather associations. Explain uncertainty when unclear. If there are no visible clouds, say so. Never claim to predict rain or emergency conditions reliably from a single image. Respond in concise plain English (80-130 words) with headings: Likely clouds, Visual clues, What they can indicate, Limits."},{type:"input_image",image_url:"data:"+file.type+";base64,"+base64,detail:"low"}]}]})});
    if(!response.ok){return NextResponse.json({error:response.status===429?"Cloud analysis is temporarily busy. Please try again later.":"Cloud analysis could not complete. Check the API configuration and try again."},{status:502})}
    const data=await response.json();
    const answer=(data.output||[]).flatMap((item:{content?:{type:string,text?:string}[]})=>item.content||[]).filter((part:{type:string})=>part.type==="output_text").map((part:{text?:string})=>part.text||"").join("\n").trim();
    if(!answer)return NextResponse.json({error:"No analysis was returned."},{status:502});
    return NextResponse.json({analysis:answer});
  }catch{return NextResponse.json({error:"Cloud analysis is temporarily unavailable."},{status:502})}
}
