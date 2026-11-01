import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export function imageRequest({prompt,model='gpt-image-2.5-sunburst',size='1536x864',quality='high'}){
  if(!prompt?.trim())throw Error('A non-empty prompt is required');
  if(!['gpt-image-2.5-sunburst','gpt-image-2.5-flare'].includes(model))throw Error('Select an explicit supported GPT Image 2.5 model');
  if(!['low','medium','high','xhigh','max','auto'].includes(quality))throw Error('Invalid image quality');
  const m=/^(\d+)x(\d+)$/.exec(size);
  if(size!=='auto'){
    if(!m)throw Error('Size must be WIDTHxHEIGHT or auto');
    const w=Number(m[1]),h=Number(m[2]),pixels=w*h;
    if(!w||!h||w%16||h%16||Math.max(w,h)>3840||Math.max(w,h)/Math.min(w,h)>3||pixels<655360||pixels>8294400)throw Error('Size does not satisfy GPT Image 2.5 dimension constraints');
  }
  return {model,prompt,size,quality,n:1,output_format:'png',background:'opaque'};
}
export async function requestImage(body,{apiKey=process.env.OPENAI_API_KEY,fetchImpl=globalThis.fetch}={}){
  if(!apiKey)throw Error('OPENAI_API_KEY is required for generation; existing-image reconstruction needs no API key');
  // One attempt only. A retry could generate another billable image.
  const response=await fetchImpl('https://api.openai.com/v1/images/generations',{
    method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify(body),signal:AbortSignal.timeout(180000)
  });
  if(!response.ok)throw Error(`Image API request failed (HTTP ${response.status}); check account access and billing before retrying`);
  const data=await response.json(),base64=data.data?.[0]?.b64_json;
  if(!base64)throw Error('Image API returned no base64 image');
  const bytes=Buffer.from(base64,'base64');
  if(bytes.length<8||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Image API did not return a PNG');
  return {bytes,usage:data.usage||null};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const a=process.argv.slice(2),get=(k,d)=>a.includes(k)?a[a.indexOf(k)+1]:d;
  try{
    const prompt=await fs.readFile(get('--prompt-file','prompt.txt'),'utf8');
    const body=imageRequest({prompt,model:get('--model','gpt-image-2.5-sunburst'),size:get('--size','1536x864'),quality:get('--quality','high')});
    if(a.includes('--dry-run'))console.log(JSON.stringify({endpoint:'https://api.openai.com/v1/images/generations',body},null,2));
    else{
      const out=path.resolve(get('--out','reference.png'));
      try{await fs.access(out);throw Error('Output exists; choose a new path');}catch(e){if(e.code!=='ENOENT')throw e;}
      const {bytes,usage}=await requestImage(body);await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,bytes,{flag:'wx'});
      await fs.writeFile(out+'.generation.json',JSON.stringify({...body,usage},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output:out}));
    }
  }catch(e){console.error(e.message);process.exitCode=1;}
}
