import {MOTORWAYS,CONNECTORS,roadSection,pathSection,mainPoint,projectMain,roadPoint,terrainHeight} from './road-network.mjs?rev=world21d';
import {projectPath} from './interchange-logic.mjs?rev=world21d';
// A connection is a marked traffic area, not simply two intersecting ribbons.
// All locations below derive from the same directed road/path as driving.
const shifted=(p,lane)=>({x:p.x-Math.cos(p.heading)*lane,y:p.y,z:p.z+Math.sin(p.heading)*lane});
export function connectionFeatures(paths=CONNECTORS){
 const features=[],seen=new Set();
 for(const path of paths){if(path.city||path.decelerationEndS===undefined)continue;
  for(const kind of ['departure','arrival']){const id=kind==='departure'?path.from:path.to,key=path.junctionId+':'+id+':'+kind;if(seen.has(key))continue;seen.add(key);
   const start=path.goreRanges?.[kind]?.start??(kind==='departure'?path.decelerationEndS:path.accelerationStartS),end=path.goreRanges?.[kind]?.end??(kind==='departure'?path.departLength:path.accelerationStartS+200),section=roadSection(id),ramp=pathSection(path),stripes=[],bedRings=[],candidates=[];
   for(let s=start;s<=Math.min(end,path.length);s+=2){const p=roadPoint(path.id,s),q=projectMain(id,p.x,p.z,p.y);const sameGrade=Math.abs(q.y-p.y)<=.05;if(!sameGrade&&!path.service)continue;
    const inner=mainPoint(id,q.s,section.half+.2),outer=shifted(p,-(path.laneWidth||3.5)/2-.15),mainEdge=mainPoint(id,q.s,section.outer+.35),rampEdge=shifted(p,ramp.inner-.35);
    const across=(outer.x-inner.x)*-Math.cos(q.heading)+(outer.z-inner.z)*Math.sin(q.heading),gap=(rampEdge.x-mainEdge.x)*-Math.cos(q.heading)+(rampEdge.z-mainEdge.z)*Math.sin(q.heading);
    if(sameGrade&&across>.55&&Math.floor((s-start)/2)%4===0){const a=mainPoint(id,q.s-1.7,section.half+.2),b=mainPoint(id,q.s-1.25,section.half+.2),c=shifted(roadPoint(path.id,Math.min(path.length,s+1.7)),-(path.laneWidth||3.5)/2-.15),d=shifted(roadPoint(path.id,Math.min(path.length,s+2.15)),-(path.laneWidth||3.5)/2-.15);stripes.push([a,c,b,b,c,d]);}
    const bedA=mainPoint(id,q.s,section.outer),bedB=shifted(p,ramp.inner);if(gap>-.7)bedRings.push({a:bedA,b:bedB,s,soil:!sameGrade});
    if(sameGrade&&gap>1.4)candidates.push({s,point:{x:(mainEdge.x+rampEdge.x)/2,z:(mainEdge.z+rampEdge.z)/2,y:p.y,heading:q.heading}});
   }
   // Service branches stay next to the same mainline. When grades separate,
   // the gore becomes graded earth, not an abruptly cut 1.8m-high open slab.
   // Keep both road edges unchanged and blend only the centre toward terrain.
   if(path.service){const paved=bedRings.filter(r=>!r.soil),join=kind==='departure'?paved.at(-1)?.s:paved[0]?.s;for(const r of bedRings){const t=r.soil?Math.max(0,Math.min(1,kind==='departure'?(r.s-join)/(end-join):(join-r.s)/(join-start))):0,u=t*t*(3-2*t),x=(r.a.x+r.b.x)/2,z=(r.a.z+r.b.z)/2,y=(r.a.y+r.b.y)/2;r.mid={x,z,y:y*(1-u)+(terrainHeight(x,z)-.22)*u};}}
   // A rigid head must stand downstream of the physical nose, entirely outside
   // both paved shoulders. Check all corners, not merely its centre.
   let cushion=null;const ordered=kind==='departure'?candidates:[...candidates].reverse(),first=ordered[0];
   for(const c of ordered){if(!first||Math.abs(c.s-first.s)<8)continue;const p=c.point,length=2.4,width=.8,valid=[-1,1].every(a=>[-1,1].every(b=>{const x=p.x+Math.sin(p.heading)*a*length/2-Math.cos(p.heading)*b*width/2,z=p.z+Math.cos(p.heading)*a*length/2+Math.sin(p.heading)*b*width/2,m=projectMain(id,x,z,p.y),r=projectPath(path,x,z,p.y);return m.lane>section.outer+.18&&r.lane<ramp.inner-.18;}));if(valid){cushion={...p,length,width,height:.8,s:c.s,noseSetback:Math.abs(c.s-first.s)};break;}}
   features.push({id:key,kind,roadId:id,pathId:path.id,stripes,bedRings,cushion,start,end});
  }
 }
 return features;
}

// Exact paved-gore bearing surface for a small bridge-mounted sign footing.
// Clip the same two triangles used by network-world, not a second road-height
// approximation. A footprint is accepted only when one feature covers it all.
export function connectionFooting(features,x,z,heading,width=.64){
 const half=width/2,cos=Math.cos(heading),sin=Math.sin(heading);
 const local=p=>({x:(p.x-x)*cos-(p.z-z)*sin,z:(p.x-x)*sin+(p.z-z)*cos,y:p.y+.22});
 const clip=(input,axis,limit,sign)=>{const out=[];for(let i=0;i<input.length;i++){const a=input[i],b=input[(i+1)%input.length],da=sign*(a[axis]-limit),db=sign*(b[axis]-limit);if(da>=-1e-10)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,y:a.y+(b.y-a.y)*t});}}return out;};
 for(const feature of features){const fragments=[];let area=0;for(let i=1;i<feature.bedRings.length;i++){const p=feature.bedRings[i-1],q=feature.bedRings[i];if(p.soil||q.soil)continue;for(const triangle of [[p.a,p.b,q.a],[p.b,q.b,q.a]]){let poly=triangle.map(local);for(const [axis,limit,sign]of[['x',-half,1],['x',half,-1],['z',-half,1],['z',half,-1]])if(poly.length)poly=clip(poly,axis,limit,sign);if(poly.length<3)continue;let a=0;for(let j=0;j<poly.length;j++){const u=poly[j],v=poly[(j+1)%poly.length];a+=u.x*v.z-u.z*v.x;}a=Math.abs(a)/2;if(a<1e-10)continue;area+=a;fragments.push(poly);}}
  if(Math.abs(area-width*width)>width*width*1e-7)continue;const heights=fragments.flat().map(v=>v.y),minY=Math.min(...heights),maxY=Math.max(...heights);if(maxY-minY>.025)continue;return{connectionId:feature.id,fragments,minY,maxY,area,width};
 }return null;
}
