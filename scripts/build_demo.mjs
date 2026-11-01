import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Canvas,gradient,membrane,protein,cluster,mitochondrion} from './primitives.mjs';
import {buildPresentation} from './build_pptx.mjs';

export function demoScene(){
  const c=new Canvas(1600,900,'Microsoft YaHei');
  c.scene.title='RC-Science-PPT native reconstruction demo';
  const navy='082E68',red='BD0000',blue='0066A2';
  const panel=(id,x,y,w,h)=>c.shape(id,x,y,w,h,'FFFFFF','roundRect',{color:'C5E1FA',width:1.2},{radius:14});
  c.text('eyebrow','RC-Science-PPT  /  原生对象演示',24,18,900,35,26,navy,true);
  c.text('title','细胞应激反应的多通路调控',24,65,1548,65,53,navy,true);
  c.shape('definition-bg',24,145,1552,55,gradient('E0F0FF','F1F8FE'),'roundRect',{width:0},{radius:10});
  c.text('definition','图中所有文字、蛋白、细胞膜、曲线与图表均可独立编辑',45,151,1500,43,28,navy);
  panel('left-panel',24,222,292,555);panel('mechanism-panel',334,222,786,555);panel('evidence-panel',1138,222,438,555);
  c.shape('left-head',24,222,292,54,gradient('3974AE','073B78'),'roundRect',{width:0},{radius:9});
  c.text('left-head-label','可编辑的科研元素',42,227,254,43,25,'FFFFFF',true,{align:'center'});
  const list=[['文字与符号','Fe²⁺、H₂O₂、蛋白名称'],['分子与细胞结构','原生形状及贝塞尔曲线'],['激活与抑制关系','箭头和抑制端点可修改'],['真实数据图表','内嵌工作簿，可编辑数据']];
  list.forEach(([title,body],j)=>{const y=316+j*112;c.ellipse('left-dot-'+j,63,y+20,24,24,gradient('E0F3FF','B1DCFA'));c.text('left-no-'+j,String(j+1),45,y-3,36,45,25,blue,true,{align:'center'});c.text('left-title-'+j,title,102,y-7,202,36,23,navy,true);c.text('left-body-'+j,body,102,y+29,202,55,17,navy,false,{wrap:true});});
  c.shape('mech-head',334,222,786,54,gradient('3974AE','073B78'),'roundRect',{width:0},{radius:9});
  c.text('mech-head-label','机制图：原生矢量形状与关系',358,226,738,45,25,'FFFFFF',true,{align:'center'});
  membrane(c,'cell-membrane',354,366,745,379,{radius:104,spacing:6.8});
  const heads=[['代谢信号',368,180],['抗氧化通路',566,180],['脂质调控',764,180]];
  heads.forEach(([t,x,w],j)=>{c.shape('path-card-'+j,x,292,w,87,gradient(j===0?'FFE8E8':'DDF0FF','FFFFFF'),'roundRect',{color:j===0?'FFBEBE':'ADD9FB',width:1},{radius:9});c.text('path-title-'+j,t,x,300,w,33,22,j===0?red:blue,true,{align:'center'});c.text('path-sub-'+j,['Signal A','Defense B','Enzyme C'][j],x,337,w,27,18,navy,false,{align:'center'});});
  protein(c,'defense',655,438,60,25,'Defense B');
  protein(c,'signal',461,407,50,24,'Signal A');
  cluster(c,'protein-cluster',426,523,34);c.text('protein-caption','Protein pool',373,562,143,30,19,blue,false,{align:'center'});
  mitochondrion(c,'mitochondrion',857,457,139,64);
  c.text('mitochondrion-label','细胞器状态',867,528,130,27,20,navy,false,{align:'center'});
  c.shape('center-node',620,542,217,78,gradient('FFF2E6','FFD6BF'),'roundRect',{color:'FFCCB6',width:1},{radius:20});
  c.text('center-node-label','氧化还原平衡',632,548,193,64,27,red,true,{align:'center'});
  c.arrow('signal-to-balance',473,438,641,540,navy,2);
  c.arrow('pool-to-balance',467,527,619,578,navy,1.7);
  c.inhibit('defense-inhibition',666,465,703,539,'E53935',2.2);
  c.arrow('balance-to-organelle',840,579,921,552,navy,2);
  c.arrow('balance-to-outcome',728,624,728,666,red,6);
  c.ellipse('outcome',728,699,126,39,gradient('EF5C4D','BA0000'));
  c.text('outcome-label','细胞状态改变',620,672,216,52,31,'FFFFFF',true,{align:'center'});
  for(let j=0;j<20;j++){let a=j*2.399;const x=738+Math.cos(a)*(230+j%3*21),y=583+Math.sin(a)*(102+j%4*7);c.ellipse('redox-dot-'+j,x,y,3,3,gradient('FF9D8C','E00000'));}
  c.text('evidence-title','数据与编辑能力',1163,241,385,43,28,navy,true);
  c.text('demo-data-note','以下仅为演示数据，无研究结论',1163,295,385,42,20,red,false,{wrap:true});
  c.add('chart',{id:'editable-evidence-chart',x:1158,y:367,w:398,h:282,chartType:'bar',categories:['A','B','C','D','E'],series:[{name:'演示数据',values:[24,48,83,126,172]}],max:200,majorUnit:50,labelSize:17,colors:['ED5A50']});
  c.text('chart-footnote','柱体与数值来自同一份内嵌工作簿',1163,678,385,57,20,navy,false,{wrap:true});
  c.shape('footer-box',24,800,1552,72,'FFFFFF','roundRect',{color:'F26A68',width:1.3},{radius:12});
  c.text('footer-text','图片是视觉参考，交付的是可修改的 PowerPoint 对象',47,812,1506,48,28,navy,true,{align:'center'});
  c.scene.slides[0].notes='原创合成演示，展示原生文字、曲线、图表和图形的能力。示例数字仅用于软件演示，不是科研证据。这张演示图并非 Image 2.5 生成，也不作为图片自动识别精度的基准。';
  return c.scene;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const a=process.argv.slice(2),out=path.resolve(a.includes('--out')?a[a.indexOf('--out')+1]:'build/demo');
  await fs.mkdir(out,{recursive:true});const scene=demoScene();
  await fs.writeFile(path.join(out,'demo.scene.json'),JSON.stringify(scene,null,2)+'\n');
  await buildPresentation(scene,{out:path.join(out,'demo.pptx')});console.log(JSON.stringify({out,objects:scene.slides[0].elements.length}));
}
