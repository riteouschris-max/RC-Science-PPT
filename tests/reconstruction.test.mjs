import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import JSZip from 'jszip';
import {DOMParser} from '@xmldom/xmldom';
import {buildPresentation,validateScene} from '../scripts/build_pptx.mjs';
import {demoScene} from '../scripts/build_demo.mjs';
import {imageRequest,requestImage} from '../scripts/generate_image.mjs';

const A='http://schemas.openxmlformats.org/drawingml/2006/main';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scene=demoScene();
let bytes;
test('exports native Chinese text, native curves/gradients, and an editable chart workbook',async()=>{
  bytes=await buildPresentation(scene);const z=await JSZip.loadAsync(bytes);
  const xml=await z.file('ppt/slides/slide1.xml').async('string');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  assert.ok(xml.includes('细胞应激反应的多通路调控'));
  assert.ok(doc.getElementsByTagNameNS(A,'gradFill').length>10);
  assert.ok(doc.getElementsByTagNameNS(A,'custGeom').length>=3);
  assert.ok(doc.getElementsByTagNameNS(A,'cubicBezTo').length>100);
  assert.equal(Object.keys(z.files).filter(k=>k.startsWith('ppt/media/')&&!z.files[k].dir).length,0);
  assert.equal(Object.keys(z.files).filter(k=>/ppt\/embeddings\/.*\.xlsx$/.test(k)).length,1);
  assert.ok(!xml.includes('NaN'));
  const chart=await z.file('ppt/charts/chart1.xml').async('string');
  assert.ok(chart.includes('externalData'));
  assert.ok(chart.includes('172'));
});
test('the exported PPTX passes independent Python relationship, text, geometry, and workbook checks',async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'rc-science-ppt-'));
  try{
    const file=path.join(temp,'slide.pptx'),src=path.join(temp,'scene.json');
    await fs.writeFile(file,bytes||await buildPresentation(scene));await fs.writeFile(src,JSON.stringify(scene));
    const r=spawnSync(process.env.PYTHON||'python',[path.join(root,'scripts/audit_pptx.py'),file,'--scene',src,'--min-text','30','--max-pictures','0'],{encoding:'utf8'});
    assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(JSON.parse(r.stdout).passed,true);
  }finally{await fs.rm(temp,{recursive:true,force:true});}
});
test('rejects fabricated/unknown numeric chart points, non-finite coordinates, and duplicate object names',()=>{
  const s=structuredClone(scene),chart=s.slides[0].elements.find(e=>e.type==='chart');chart.series[0].values[0]=null;
  assert.throws(()=>validateScene(s),/complete and finite/);
  const q=structuredClone(scene);q.slides[0].elements[0].x=NaN;assert.throws(()=>validateScene(q),/must be finite/);
  const r=structuredClone(scene);r.slides[0].elements[1].id=r.slides[0].elements[0].id;assert.throws(()=>validateScene(r),/unique id/);
  const t=structuredClone(scene);t.slides[0].elements[0].x=99999;assert.throws(()=>validateScene(t),/outside/);
});
test('keeps the selected Image 2.5 model and enforces valid 16:9 generation dimensions',()=>{
  const r=imageRequest({prompt:'An illustrative scientific slide',model:'gpt-image-2.5-flare'});
  assert.equal(r.model,'gpt-image-2.5-flare');assert.equal(r.size,'1536x864');
  assert.throws(()=>imageRequest({prompt:'x',model:'gpt-image-1'}),/explicit supported/);
  assert.throws(()=>imageRequest({prompt:'x',size:'1600x901'}),/constraints/);
});
test('generation uses one authenticated request, returns PNG bytes, and does not retry or leak API error bodies',async()=>{
  let calls=0;const signature=Buffer.from([137,80,78,71,13,10,26,10]);
  const result=await requestImage(imageRequest({prompt:'demo'}),{apiKey:'test-only-key',fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,'https://api.openai.com/v1/images/generations');assert.equal(options.headers.Authorization,'Bearer test-only-key');
    return {ok:true,json:async()=>({data:[{b64_json:signature.toString('base64')}]})};
  }});assert.equal(calls,1);assert.ok(result.bytes.equals(signature));
  calls=0;await assert.rejects(requestImage(imageRequest({prompt:'demo'}),{apiKey:'test-only-key',fetchImpl:async()=>{calls++;return {ok:false,status:429,json:async()=>({error:'sensitive echoed body'})};}}),e=>!e.message.includes('sensitive')&&e.message.includes('429'));assert.equal(calls,1);
});
