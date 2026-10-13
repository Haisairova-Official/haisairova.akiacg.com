import {mainPoint,roadSection,roadVerticalClear,mainArcDistance,stationBefore,terrainHeight,networkInternalBoundary,supportClear} from './road-network.mjs?rev=world21d';
import {SIGN_STYLE} from './sign-layout.mjs?rev=world21d';
const at=(p,x,z=0)=>({x:p.x+Math.cos(p.heading)*x+Math.sin(p.heading)*z,z:p.z-Math.sin(p.heading)*x+Math.cos(p.heading)*z});
const occupied=(p,x)=>[[0,0],[-.38,-.38],[.38,-.38],[-.38,.38],[.38,.38]].some(([dx,dz])=>{const q=at(p,x+dx,dz);return networkInternalBoundary('__sign_support__',q.x,q.z,p.y)||!supportClear(q.x,q.z,p.y+1);});
export function signInstallation(spec,layout,p,section=roadSection(spec.roadId),{roadside=false}={}){
 const bottom=.22+(roadside?2.1:SIGN_STYLE.clearance),centre=roadside?-section.outer-1.5-layout.width/2:spec.fork?-section.centre:-section.outer+layout.width/2-.05,top=bottom+layout.height+.20;
 const clear=(x,min,max,pad=.3)=>{const q=at(p,x);return roadVerticalClear(q.x,q.z,p.y+min,p.y+max,pad);};
 const postClear=x=>{const q=at(p,x),base=Math.min(.22,terrainHeight(q.x,q.z)-p.y);return !occupied(p,x)&&clear(x,base,top,.35);};
 let left=-section.inner+1.05,right=roadside?centre:-section.outer-1.05;for(let n=0;n<100&&!postClear(right);n++)right-=.4;if(spec.fork)for(let n=0;n<100&&!postClear(left);n++)left+=.4;
 const posts=spec.fork?[left,right]:[right],armLeft=spec.fork?left:centre+layout.width/2+.22,armRight=right;
 if(posts.some(x=>!postClear(x)))return null;
 for(let x=centre-layout.width/2;x<=centre+layout.width/2+.001;x+=Math.min(1,layout.width/6))if(!clear(x,bottom,top))return null;
 for(let x=armRight;x<=armLeft+.001;x+=1)if(!clear(x,top-.2,top+.2))return null;
 for(const x of posts){const q=at(p,x),base=Math.min(.22,terrainHeight(q.x,q.z)-p.y);if(!clear(x,base,top,.35))return null;}
 return{left,right,bottom,centre,top,posts,armLeft,armRight,form:roadside?'roadside':'overhead'};
}
// Keep the surveyed reference point fixed. If a bridge occupies the nominal
// sign site, JTG D82-2009 6.1.7 permits ±50m installation deviation for
// nominal distances <=3km. Keep the nominal label and retain measured metadata.
export function planSignPlacement(spec,layout,{maxShift=50}={}){
 const nominal=spec.placementS??spec.station,section=roadSection(spec.roadId);for(const shift of [0,10,20,30,50,75,100].filter(d=>d<=maxShift)){
  const station=shift?stationBefore(spec.roadId,nominal,shift):nominal,p=mainPoint(spec.roadId,station),installation=signInstallation(spec,layout,p,section);
  if(!installation)continue;const moved={...spec,station,placementS:station,placementShift:shift,nominalDistance:spec.nominalDistance??spec.distance,displayDistance:spec.nominalDistance??spec.distance};if(Number.isFinite(spec.referencePointS))moved.distance=Math.round(mainArcDistance(spec.roadId,station,spec.referencePointS));return{spec:moved,point:p,installation};
 }return null;
}
