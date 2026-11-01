import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const A='http://schemas.openxmlformats.org/drawingml/2006/main';
const P='http://schemas.openxmlformats.org/presentationml/2006/main';
const px=n=>n/96, pt=n=>n*.75;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const clean=c=>String(c||'000000').replace(/^#/,'').toUpperCase();
const children=e=>Array.from(e.childNodes).filter(c=>c.nodeType===1);
function checkColor(c){if(!/^[0-9A-F]{6}$/i.test(clean(c)))throw Error('Colors must be six-digit RGB values');}
function checkFill(f){
  if(!f||f==='none')return;
  if(typeof f==='string'){checkColor(f);return;}
  for(const z of f.gradient||[f]){
    checkColor(z.color);if(z.opacity!==undefined&&(!finite(z.opacity)||z.opacity<0||z.opacity>1))throw Error('Opacity must be 0..1');
  }
}
export function validateScene(scene){
  if(!finite(scene.width)||!finite(scene.height)||scene.width<=0||scene.height<=0)throw Error('Positive pixel width and height are required');
  if(!Array.isArray(scene.slides)||!scene.slides.length)throw Error('At least one slide is required');
  for(const [i,s] of scene.slides.entries()){
    if(!Array.isArray(s.elements))throw Error(`Slide ${i+1}: elements must be an array`);
    const ids=new Set();
    for(const e of s.elements){
      if(!e.id||ids.has(e.id))throw Error(`Slide ${i+1}: every element needs a unique id`);ids.add(e.id);
      if(!['text','shape','path','line','chart','image'].includes(e.type))throw Error(`${e.id}: unsupported type ${e.type}`);
      for(const k of ['x','y','w','h'])if(!finite(e[k]))throw Error(`${e.id}: ${k} must be finite`);
      if(e.w<0||e.h<0)throw Error(`${e.id}: negative size`);
      if(e.type!=='line'&&(e.w===0||e.h===0))throw Error(`${e.id}: positive width/height required`);
      if(e.x < -1||e.y < -1||e.x+e.w > scene.width+1||e.y+e.h > scene.height+1)throw Error(`${e.id}: element lies outside the slide canvas`);
      if(e.type==='path'){
        if(!e.commands?.length)throw Error(`${e.id}: empty path`);
        for(const c of e.commands){
          if(!['M','L','C','Q','Z'].includes(c[0]))throw Error(`${e.id}: unknown path command`);
          if(c.length!==({M:3,L:3,C:7,Q:5,Z:1}[c[0]])||!c.slice(1).every(finite))throw Error(`${e.id}: invalid path coordinates`);
        }
      }
      if(e.type==='chart'){
        if(!['bar','line','area','pie','doughnut'].includes(e.chartType||'bar'))throw Error(`${e.id}: unsupported chart type`);
        if(!e.categories?.length||!e.series?.length)throw Error(`${e.id}: chart data required`);
        for(const t of e.series)if(t.values?.length!==e.categories.length||!t.values.every(finite))throw Error(`${e.id}: chart values must be complete and finite; represent unknown values separately`);
      }
      if(e.color)checkColor(e.color);if(e.line?.color)checkColor(e.line.color);checkFill(e.fill);
      if(e.fontSize!==undefined&&(!finite(e.fontSize)||e.fontSize<=0))throw Error(`${e.id}: font size must be positive`);
      for(const f of [e.fill,e.line?.fill])if(f?.gradient){
        const stops=f.gradient;
        if(stops.length<2||stops.some(z=>!finite(z.offset)||z.offset<0||z.offset>1))throw Error(`${e.id}: gradient offsets must be 0..1`);
      }
    }
  }
  return scene;
}
function solid(fill){
  if(!fill||fill==='none')return {color:'FFFFFF',transparency:100};
  if(typeof fill==='string')return {color:clean(fill)};
  const f=fill.gradient?fill.gradient[0]:fill;
  return {color:clean(f.color),transparency:(1-(f.opacity??1))*100};
}
function stroke(l={}){
  return {color:clean(l.color||'000000'),width:pt(l.width??0),transparency:l.width?0:100,
    dashType:({dashed:'dash',dotted:'sysDot'}[l.style]||'solid'),beginArrowType:l.beginArrow,endArrowType:l.endArrow};
}
function pos(e){return {x:px(e.x),y:px(e.y),w:px(e.w),h:px(e.h),rotate:e.rotation||0,objectName:e.id};}
function points(commands){return commands.map(c=>{
  if(c[0]==='Z')return {close:true};
  if(c[0]==='C')return {x:px(c[5]),y:px(c[6]),curve:{type:'cubic',x1:px(c[1]),y1:px(c[2]),x2:px(c[3]),y2:px(c[4])}};
  if(c[0]==='Q')return {x:px(c[3]),y:px(c[4]),curve:{type:'quadratic',x1:px(c[1]),y1:px(c[2])}};
  return {x:px(c[1]),y:px(c[2]),...(c[0]==='M'?{moveTo:true}:{})};
});}
function gradientNode(doc,f){
  const node=(name,attrs={})=>{const el=doc.createElementNS(A,'a:'+name);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));return el;};
  const g=node('gradFill',{rotWithShape:1}),list=node('gsLst');
  for(const stop of [...f.gradient].sort((a,b)=>a.offset-b.offset)){
    const gs=node('gs',{pos:Math.round(stop.offset*100000)}),c=node('srgbClr',{val:clean(stop.color)});
    if(stop.opacity!==undefined)c.appendChild(node('alpha',{val:Math.round(stop.opacity*100000)}));gs.appendChild(c);list.appendChild(gs);
  }
  g.appendChild(list);g.appendChild(node('lin',{ang:Math.round((((f.angle??90)%360+360)%360)*60000),scaled:1}));return g;
}
// PptxGenJS creates the package, including native editable chart workbooks.
// Replace placeholder fills by semantic object name to add native OOXML gradients.
async function applyGradients(buffer,slides){
  const zip=await JSZip.loadAsync(buffer);
  for(let i=0;i<slides.length;i++){
    const specs=new Map(slides[i].elements.filter(e=>e.fill?.gradient).map(e=>[e.id,e.fill]));
    if(!specs.size)continue;
    const part=`ppt/slides/slide${i+1}.xml`,xml=await zip.file(part).async('string');
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    for(const shape of Array.from(doc.getElementsByTagNameNS(P,'sp'))){
      const props=shape.getElementsByTagNameNS(P,'cNvPr')[0],fill=specs.get(props?.getAttribute('name'));
      if(!fill)continue;const sp=children(shape).find(e=>e.localName==='spPr');
      for(const el of children(sp))if(['solidFill','noFill','gradFill','pattFill','blipFill'].includes(el.localName))sp.removeChild(el);
      const before=children(sp).find(e=>['ln','effectLst','effectDag','scene3d','sp3d','extLst'].includes(e.localName));
      sp.insertBefore(gradientNode(doc,fill),before||null);
    }
    zip.file(part,new XMLSerializer().serializeToString(doc));
  }
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
export async function buildPresentation(scene,{baseDir=process.cwd(),out}={}){
  validateScene(scene);
  const pptx=new PptxGenJS();pptx.defineLayout({name:'SOURCE',width:px(scene.width),height:px(scene.height)});pptx.layout='SOURCE';
  pptx.author=scene.author||'RC-Science-PPT';pptx.subject='Editable reconstruction of a scientific slide image';
  pptx.title=scene.title||'Scientific slide reconstruction';pptx.lang=scene.language||'zh-CN';
  const font=scene.font||'Arial';pptx.theme={headFontFace:font,bodyFontFace:font,lang:pptx.lang};
  for(const page of scene.slides){
    const slide=pptx.addSlide();slide.background={color:clean(page.background||'FFFFFF')};
    for(const e of page.elements){
      const p=pos(e);
      if(e.type==='text'){
        const options={...p,fontFace:e.font||font,fontSize:pt(e.fontSize||22),bold:e.bold||false,color:clean(e.color||'082E68'),
          margin:0,breakLine:false,align:e.align||'left',valign:e.valign||'mid',wrap:e.wrap??false,
          paraSpaceAfter:0,transparency:0,vertAnchor:'ctr',isTextBox:true};
        const text=e.runs?e.runs.map(r=>({text:r.text,options:{...(r.color?{color:clean(r.color)}:{}),...(r.fontSize?{fontSize:pt(r.fontSize)}:{}),...(r.bold!==undefined?{bold:r.bold}:{})}})):e.text||'';
        slide.addText(text,options);
      }else if(e.type==='shape'||e.type==='path'){
        slide.addShape(e.type==='path'?'custGeom':(e.geometry||'rect'),{...p,fill:solid(e.fill),line:stroke(e.line),
          ...(e.radius?{rectRadius:px(e.radius)}:{}),...(e.type==='path'?{points:points(e.commands)}:{})});
      }else if(e.type==='line'){
        slide.addShape('line',{...p,flipH:e.flipH||false,flipV:e.flipV||false,line:stroke(e.line)});
      }else if(e.type==='image'){
        if(!e.reason)throw Error(`${e.id}: retained images require a reason in the scene source`);
        const file=path.resolve(baseDir,e.src);slide.addImage({...p,path:file,altText:e.alt||e.id});
      }else if(e.type==='chart'){
        const cats=e.categories.map(String);
        const series=e.series.map(t=>({name:t.name,labels:cats,values:t.values}));
        const numberFormat=e.numberFormat||(e.series.every(t=>t.values.every(Number.isInteger))?'0':'0.########');
        slide.addChart(e.chartType||'bar',series,{
          ...p,catAxisLabelFontFace:e.font||font,valAxisLabelFontFace:e.font||font,dataLabelFormatCode:numberFormat,
          legendFontFace:e.font||font,titleFontFace:e.font||font,
          chartColors:e.colors?.map(clean)||['E53935'],showLegend:false,showTitle:false,
          showValue:e.showValue??true,showCatName:false,dataLabelPosition:({line:'t',area:'t',pie:'bestFit',doughnut:'bestFit'}[e.chartType]||'outEnd'),
          catAxisLabelFontSize:pt(e.labelSize||16),valAxisLabelFontSize:pt(e.labelSize||16),dataLabelColor:clean(e.color||'082E68'),dataLabelBkgrdColor:'FFFFFF',
          fontFace:e.font||font,fontSize:pt(e.labelSize||16),
          catAxisLineColor:'44688F',valAxisLineColor:'44688F',valGridLine:{color:'E4EEF8',size:.5},catGridLine:{style:'none'},
          showBorder:false,showSerName:false,showPercent:false,
          catAxisLabelColor:'315176',valAxisLabelColor:'315176',
          catAxisLineShow:e.axes!==false,valAxisLineShow:e.axes!==false,
          catAxisLabelPos:e.axes===false?'none':'low',valAxisLabelPos:e.axes===false?'none':'low',
          catAxisHidden:e.axes===false,valAxisHidden:e.axes===false,
          valAxisMinVal:e.min??0,...(e.max!==undefined?{valAxisMaxVal:e.max}:{}),
          ...(e.majorUnit!==undefined?{valAxisMajorUnit:e.majorUnit}:{}),
          showMarker:false,
          catAxisTitleFontFace:e.font||font,valAxisTitleFontFace:e.font||font,
          barDir:e.direction||'col',barGrouping:'clustered',gapSize:e.gap??50,
        });
      }
    }
    if(page.notes)slide.addNotes(page.notes);
  }
  const raw=await pptx.write({outputType:'nodebuffer'}),buffer=await applyGradients(raw,scene.slides);
  if(out){await fs.mkdir(path.dirname(path.resolve(out)),{recursive:true});await fs.writeFile(out,buffer);}
  return buffer;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];
  if(!args.includes('--scene')||!args.includes('--out')){console.error('Usage: node scripts/build_pptx.mjs --scene scene.json --out result.pptx');process.exitCode=2;}
  else try{const src=path.resolve(value('--scene'));const scene=JSON.parse(await fs.readFile(src,'utf8'));await buildPresentation(scene,{baseDir:path.dirname(src),out:value('--out')});console.log(JSON.stringify({output:path.resolve(value('--out')),slides:scene.slides.length}));}catch(e){console.error(e.message);process.exitCode=1;}
}
