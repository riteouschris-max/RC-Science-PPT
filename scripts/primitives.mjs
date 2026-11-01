// Native editable components. Coordinates and font sizes are source-image pixels.
export class Canvas {
  constructor(width=1600,height=900,font='Arial'){
    this.scene={width,height,font,slides:[{background:'FFFFFF',elements:[]}]};this.items=this.scene.slides[0].elements;this.count=0;
  }
  add(type,props){const e={id:props.id||`${type}-${++this.count}`,type,...props};this.items.push(e);return e;}
  shape(id,x,y,w,h,fill,geometry='rect',line={width:0},extra={}){return this.add('shape',{id,x,y,w,h,fill,geometry,line,...extra});}
  text(id,text,x,y,w,h,fontSize=24,color='082E68',bold=false,extra={}){return this.add('text',{id,text,x,y,w,h,fontSize,color,bold,...extra});}
  ellipse(id,cx,cy,rx,ry,fill,line={width:0}){return this.shape(id,cx-rx,cy-ry,rx*2,ry*2,fill,'ellipse',line);}
  path(id,x,y,w,h,commands,fill='none',color='082E68',width=1){return this.add('path',{id,x,y,w,h,commands,fill,line:{color,width}});}
  line(id,x1,y1,x2,y2,color='082E68',width=2,extra={}){
    return this.add('line',{id,x:Math.min(x1,x2),y:Math.min(y1,y2),w:Math.abs(x2-x1),h:Math.abs(y2-y1),
      flipV:(x2-x1)*(y2-y1)<0,line:{color,width,...extra}});
  }
  arrow(id,x1,y1,x2,y2,color='082E68',width=2){
    const reversed=x2<x1||(x2===x1&&y2<y1);
    return this.line(id,x1,y1,x2,y2,color,width,reversed?{beginArrow:'triangle'}:{endArrow:'triangle'});
  }
  inhibit(id,x1,y1,x2,y2,color='E53935',width=2){
    this.line(id,x1,y1,x2,y2,color,width);const a=Math.atan2(y2-y1,x2-x1)+Math.PI/2;
    this.line(id+'-bar',x2-8*Math.cos(a),y2-8*Math.sin(a),x2+8*Math.cos(a),y2+8*Math.sin(a),color,width);
  }
}
export const gradient=(a,b,angle=90)=>({gradient:[{offset:0,color:a},{offset:1,color:b}],angle});
function circleCommands(out,x,y,r){const k=.55228475*r;out.push(['M',x+r,y],['C',x+r,y+k,x+k,y+r,x,y+r],['C',x-k,y+r,x-r,y+k,x-r,y],['C',x-r,y-k,x-k,y-r,x,y-r],['C',x+k,y-r,x+r,y-k,x+r,y],['Z']);}
export function membrane(c,id,x,y,w,h,{radius=110,spacing=7,thickness=12,color='8FBFF0'}={}){
  if(w<radius*2||h<radius*2)throw Error('Membrane dimensions must be at least twice the radius');
  c.shape(id+'-interior',x,y,w,h,gradient('EFF9FF','FFFFFF'),'roundRect',{color,width:1},{radius});
  const heads=[],tails=[];
  function lipid(px,py,nx,ny){
    const ix=px+nx*thickness,iy=py+ny*thickness;circleCommands(heads,px,py,2);circleCommands(heads,ix,iy,2);
    for(const side of [-1,1])tails.push(['M',px+nx*2-ny*side,py+ny*2+nx*side],['L',px+nx*6-ny*(side+1),py+ny*6+nx*(side+1)],['L',px+nx*(thickness-2)-ny*side,py+ny*(thickness-2)+nx*side]);
  }
  for(let a=radius;a<=w-radius;a+=spacing){lipid(a,0,0,1);lipid(a,h,0,-1);}
  for(let a=radius;a<=h-radius;a+=spacing){lipid(0,a,1,0);lipid(w,a,-1,0);}
  for(const [cx,cy,a0]of[[radius,radius,180],[w-radius,radius,270],[w-radius,h-radius,0],[radius,h-radius,90]])
    for(let a=a0;a<=a0+90;a+=spacing/radius*180/Math.PI){const t=a*Math.PI/180;lipid(cx+radius*Math.cos(t),cy+radius*Math.sin(t),-Math.cos(t),-Math.sin(t));}
  c.path(id+'-tails',x,y,w,h,tails,'none',color,.7);
  c.path(id+'-heads',x,y,w,h,heads,'E7F5FF',color,.7);
}
export function protein(c,id,cx,cy,rx=45,ry=23,label='Protein'){
  c.ellipse(id,cx,cy,rx,ry,gradient('D9F6FF','71C3EB'),{color:'088FCB',width:1.3});
  c.text(id+'-label',label,cx-rx,cy-ry,rx*2,ry*2,22,'082E68',true,{align:'center'});
}
export function cluster(c,id,cx,cy,r=35){
  c.ellipse(id+'-body',cx,cy,r,r,gradient('D5F3FF','74BFE5'),{color:'29A2D8',width:1});
  for(let j=0;j<22;j++){const a=j*2.399,d=j<6?j*3:r*.7;const x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d;c.ellipse(id+'-'+j,x,y,r*.2,r*.17,gradient('DEF9FF','70BAE2'),{color:'288FC3',width:.7});}
}
export function mitochondrion(c,id,x,y,w=120,h=60){
  c.ellipse(id+'-outer',x+w/2,y+h/2,w/2,h/2,gradient('FFF0E6','FFB9A4'),{color:'FFAD96',width:1.2});
  const cmds=[['M',w*.08,h*.6]];
  for(let j=0;j<4;j++){const a=w*.08+j*w*.21;cmds.push(['C',a+w*.04,h*.08,a+w*.10,h*.08,a+w*.12,h*.6],['C',a+w*.13,h*.95,a+w*.19,h*.8,a+w*.20,h*.4]);}
  c.path(id+'-cristae',x,y,w,h,cmds,'none','FF9C83',3);
}
