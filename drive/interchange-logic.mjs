// Coordinates are local [x, z, elevation]. Curves are sampled at roughly 2–4.3m for geometry and collision.
export const INTERCHANGE_TYPES=['directional','diamond','trumpet'];
export const localExitX=index=>index<=1?760:5200+Math.floor((index-5)/4)*6000;
export const localExitIndex=x=>Math.max(5,5+Math.floor((x-3860)/6000)*4);
export const INTERCHANGE_NAMES={directional:'定向弯道',diamond:'菱形立交',trumpet:'喇叭立交'};
export function bezier(a,b,c,d,steps=48){const pts=[];for(let i=0;i<=steps;i++){const t=i/steps,u=1-t;pts.push(a.map((v,k)=>v*u**3+3*b[k]*u*u*t+3*c[k]*u*t*t+d[k]*t**3));}return pts;}
const line=(a,b)=>bezier(a,a.map((v,k)=>v+(b[k]-v)/3),a.map((v,k)=>v+2*(b[k]-v)/3),b,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2));
const join=(...parts)=>parts.flatMap((p,i)=>i?p.slice(1):p);
export function annotate(points){let distance=0;return points.map((p,i)=>{if(i)distance+=Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1],p[2]-points[i-1][2]);return {x:p[0],z:p[1],y:p[2],s:distance};});}
const decel=()=>bezier([-210,22.75,0],[-170,22.75,0],[-140,33,0],[-100,33,0]);
const merge=()=>bezier([115,33,0],[175,33,0],[235,22.75,0],[290,22.75,0]);
export function buildInterchange(type){
 let exit,roads=[];const add=(id,points,width=7,flags={})=>{const path={id,width,points:annotate(points),...flags};roads.push(path);return path;};
 if(type==='directional'){
  exit=join(decel(),bezier([-100,33,0],[-32,33,0],[18,70,0],[18,120,0]),line([18,120,0],[18,255,0]));
  const turnback=[];for(let i=0;i<=36;i++){const a=Math.PI-i*Math.PI/36;turnback.push([22.5+4.5*Math.cos(a),235+4.5*Math.sin(a),0]);}add('turnback',turnback,8);
  add('merge',join(line([27,235,0],[27,130,0]),bezier([27,130,0],[27,70,0],[65,33,0],[115,33,0]),merge()));
 }else if(type==='diamond'){
  // Long grade-separated approaches reach the bridge plateau before their
  // widened pavement overlaps the crossroad. No overlapping vertical step.
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(10+t*(-15+6*t));};
  const entryPlan=join(bezier([-1100,22.75,0],[-1000,22.75,0],[-900,33,0],[-800,33,0],80),bezier([-800,33,0],[-250,33,0],[20,120,0],[20,200,0],160));
  const measured=annotate(entryPlan),riseStart=measured.find(p=>p.x>=-800).s,riseLength=measured.find(p=>p.x>8).s-riseStart;
  const entry=measured.map(p=>[p.x,p.z,8*smooth((p.s-riseStart)/riseLength)]);
  exit=join(entry,line([20,200,8],[20,320,8]));
  add('crossroad',line([20,-200,8],[20,320,8]),12,{bridge:true});
  const returnPlan=join(line([27,275,0],[27,200,0]),bezier([27,200,0],[27,100,0],[410,33,0],[820,33,0],160),bezier([820,33,0],[920,33,0],[1020,22.75,0],[1120,22.75,0],80)),ret=annotate(returnPlan),start=ret.find(p=>p.x>35).s,fallEnd=ret.find(p=>p.x>=820).s;
  const returning=ret.map(p=>[p.x,p.z,8*(1-smooth((p.s-start)/(fallEnd-start)))]);add('merge',returning);
  const opposite=pts=>pts.map(([x,z,y])=>[40-x,11-z,y]);
  add('opposite-exit',opposite(entry));add('opposite-merge',opposite(returning));
 }else{
  const arc=[];for(let i=0;i<=144;i++){const u=i/144,a=-Math.PI/2+Math.PI*1.5*u;arc.push([40+60*Math.cos(a),125+60*Math.sin(a),1+7*(u*u*(3-2*u))]);}
  exit=join(decel(),bezier([-100,33,0],[-35,33,0],[0,65,1],[40,65,1]),arc,line([-20,125,8],[-20,-160,8]));
  add('crossroad',line([-20,-240,8],[-20,125,8]),12,{bridge:true});
  add('merge',join(line([-25,-145,8],[-25,220,8]),bezier([-25,220,8],[-25,285,8],[160,285,8],[160,215,8]),bezier([160,215,8],[160,100,8],[330,33,0],[500,33,0],100),bezier([500,33,0],[600,33,0],[700,22.75,0],[800,22.75,0],80)));
  const diamond=buildInterchange('diamond'),entry=diamond.exit.points.filter(p=>p.z<=200),returning=diamond.roads.find(p=>p.id==='merge').points;
  add('opposite-exit',entry.map(p=>[-p.x,11-p.z,p.y]));
  add('opposite-merge',returning.map(p=>[-p.x+2,11-p.z,p.y]));
 }
 const exitRoad=add('exit',exit,7,{finish:true});
 return {type,name:INTERCHANGE_NAMES[type],roads,exit:exitRoad,finish:exitRoad.points.at(-1)};
}
export const INTERCHANGES=Object.fromEntries(INTERCHANGE_TYPES.map(type=>[type,buildInterchange(type)]));
// Immutable annotated paths are indexed in short segment blocks. Exact segment
// projection and tie-breaking remain unchanged; broadphase only rejects blocks
// whose mathematical distance lower bound is already worse than the best hit.
const projectionBlocks=new WeakMap();
export function projectPath(path,x,z,height,nearS){
 const p=path.points;let best={distance:Infinity},bestScore=Infinity,bestIndex=Infinity;
 const scan=(start,end)=>{for(let i=start;i<end;i++){const a=p[i],b=p[i+1];if(Number.isFinite(nearS)&&(b.s<nearS-35||a.s>nearS+35))continue;const dx=b.x-a.x,dz=b.z-a.z,d2=dx*dx+dz*dz;if(d2===0)continue;const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/d2)),px=a.x+dx*t,pz=a.z+dz*t,d=Math.hypot(x-px,z-pz);const y=a.y+(b.y-a.y)*t,score=d+(height===undefined?0:Math.abs(y-height)*4);if(score<bestScore||score===bestScore&&i<bestIndex){bestScore=score;bestIndex=i;best={distance:d,lane:((x-px)*-dz+(z-pz)*dx)/Math.sqrt(d2),x:px,z:pz,y:a.y+(b.y-a.y)*t,s:a.s+(b.s-a.s)*t,heading:Math.atan2(dx,dz),id:path.id,width:path.width,total:p.at(-1).s};}}};
 if(Number.isFinite(nearS)){let low=0,high=p.length-1;while(low<high){const mid=(low+high)>>1;if(p[mid].s<nearS-35)low=mid+1;else high=mid;}const start=Math.max(0,low-1);high=p.length-1;while(low<high){const mid=(low+high+1)>>1;if(p[mid].s>nearS+35)high=mid-1;else low=mid;}scan(start,Math.min(p.length-1,low+1));}
 else{let blocks=projectionBlocks.get(p);if(!blocks){blocks=[];for(let start=0;start<p.length-1;start+=16){const end=Math.min(p.length-1,start+16),part=p.slice(start,end+1);blocks.push({start,end,minX:Math.min(...part.map(p=>p.x)),maxX:Math.max(...part.map(p=>p.x)),minZ:Math.min(...part.map(p=>p.z)),maxZ:Math.max(...part.map(p=>p.z)),minY:Math.min(...part.map(p=>p.y)),maxY:Math.max(...part.map(p=>p.y))});}projectionBlocks.set(p,blocks);}
  const bound=b=>Math.hypot(Math.max(b.minX-x,0,x-b.maxX),Math.max(b.minZ-z,0,z-b.maxZ))+(height===undefined?0:4*Math.max(b.minY-height,0,height-b.maxY));let first=null,minimum=Infinity;for(const b of blocks){const d=bound(b);if(d<minimum){minimum=d;first=b;}}if(first)scan(first.start,first.end);for(const b of blocks)if(b!==first&&bound(b)<=bestScore)scan(b.start,b.end);
 }
 return Number.isFinite(nearS)&&!Number.isFinite(best.distance)?projectPath(path,x,z,height):best;
}

export function projectInterchange(type,x,z,height=0,currentId=''){
 let best=null,score=Infinity;
 for(const path of INTERCHANGES[type].roads){const p=projectPath(path,x,z,height);if(p.distance>path.width/2-.65||Math.abs(p.y-height)>1.8)continue;const rank=p.distance+Math.abs(p.y-height)*4-(path.id===currentId?.18:0);if(rank<score){best=p;score=rank;}}
 return best;
}

// A boundary within another same-height carriageway is an internal seam,
// not a guardrail. Use the identical offset normal as the rendered ribbons.
export function barrierBoundary(path,index,side){
 const a=path.points[Math.max(0,index-1)],b=path.points[Math.min(path.points.length-1,index+1)],p=path.points[index],len=Math.hypot(b.x-a.x,b.z-a.z)||1,offset=side*(path.width/2+.12);
 return {x:p.x-(b.z-a.z)/len*offset,z:p.z+(b.x-a.x)/len*offset,y:p.y};
}
export function isInternalBoundary(data,path,index,side){
 const p=barrierBoundary(path,index,side);
 return data.roads.some(other=>{if(other===path)return false;const q=projectPath(other,p.x,p.z,p.y);return Math.abs(q.y-p.y)<.65&&q.distance<other.width/2+.2;});
}

// Overlapping bridge roads can legitimately change the projected path ID.
// Reaching the physical terminal still exits; its label is not the trigger.
export function reachedTerminal(data,x,z,height,heading,speed){
 const end=data.finish,prev=data.exit.points.at(-2),dx=end.x-prev.x,dz=end.z-prev.z,len=Math.hypot(dx,dz)||1;
 const along=((x-end.x)*dx+(z-end.z)*dz)/len,across=Math.abs((x-end.x)*dz-(z-end.z)*dx)/len;
 return speed>=0&&Math.abs(height-end.y)<.7&&along>=-5&&along<9&&across<data.exit.width/2-.3&&(Math.sin(heading)*dx+Math.cos(heading)*dz)/len>.45;
}

// Contact stabilization keeps a stopped car just inside a curved guardrail.
// At polyline vertices an exactly tangent restart can otherwise be rejected
// forever, resetting engine/steering every frame before it can turn inward.
export function resolvePathContact(path,x,z,height,inset=.15){
 const p=projectPath(path,x,z,height),limit=path.width/2-.65-inset;
 if(Math.abs(p.y-height)>1.8||p.distance<=limit||p.distance>path.width/2-.55)return null;
 const scale=limit/p.distance;
 return {x:p.x+(x-p.x)*scale,z:p.z+(z-p.z)*scale,y:p.y,correction:p.distance-limit};
}
