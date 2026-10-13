import {annotate} from './interchange-logic.mjs?rev=world21d';
import {MIXED_PROFILE,JUNCTION_PROFILE_LIBRARY} from './junction-profile-data.mjs?rev=world21d';
import {selectJunctionLayout} from './junction-selection.mjs?rev=world21d';
export const JUNCTION_GEOMETRY_VERSION='motorway-z-hermite-v2';
export const MOTORWAY_JUNCTION_TYPES=Object.freeze({cloverleaf:'苜蓿叶式',mixed:'半苜蓿叶半定向组合式'});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function mixedVertical(profile,s){const {stations:x,coefficients:c}=typeof profile==='number'?MIXED_PROFILE[profile]:profile;s=clamp(s,0,x.at(-1));let lo=0,hi=x.length-2;while(lo<hi){const m=(lo+hi+1)>>1;if(x[m]<=s)lo=m;else hi=m-1;}const t=s-x[lo],[a,b,d,e]=c[lo];return{y:((a*t+b)*t+d)*t+e,grade:(3*a*t+2*b)*t+d};}
// Integrate Euler transitions at <=1 m, exactly cutting each transition boundary.
// Only three width plans are cached; no solver or unbounded world cache in browser.
export function mixedPlan(outer=23.125,middleRadius=422.47659411033476){let x=-600,z=outer,s=0,yaw=0;const out=[{x,z,sPlan:s,yaw}],angles=[Math.PI/12,-2*Math.PI/3,Math.PI/12],radii=[200,middleRadius,200],spiral=50;
 for(let j=0;j<3;j++){const angle=angles[j],radius=radii[j],length=Math.abs(angle)*radius+spiral;if(spiral>Math.abs(angle)*radius)throw Error('invalid transition length');const cuts=[0,spiral,length-spiral,length],curvature=t=>Math.sign(angle)*Math.min(1,t/spiral,(length-t)/spiral)/radius;
  for(let k=0;k<3;k++){const a=cuts[k],b=cuts[k+1],count=Math.max(1,Math.ceil(b-a));for(let i=0;i<count;i++){const q=a+(b-a)*i/count,ds=(b-a)/count,k0=curvature(q),k1=curvature(q+ds),mid=yaw+k0*ds/2+(k1-k0)*ds/8;x+=Math.cos(mid)*ds;z+=Math.sin(mid)*ds;yaw+=(k0+k1)*ds/2;s+=ds;out.push({x,z,sPlan:s,yaw});}}
 }return out;
}
const plans=new Map();
export const junctionSelection=j=>selectJunctionLayout(j,JUNCTION_PROFILE_LIBRARY,j.seed??7127);
export const selectedJunctionType=j=>junctionSelection(j).type;
export const junctionChoiceKey=j=>JUNCTION_GEOMETRY_VERSION+':'+(j.seed??7127)+':'+junctionSelection(j).type+':'+junctionSelection(j).profileKey+':'+j.id;
export function applyJunctionMetadata(path,type,selection=null,choiceKey=null){const key=JUNCTION_GEOMETRY_VERSION+':'+type+':'+(selection?.profileKey||'base')+':'+path.junctionId;return{...path,junctionType:type,junctionSelection:selection,choiceKey,geometryKey:key,physicalSegments:[{edgeId:path.junctionId+':depart:'+path.from,startS:0,endS:path.departLength,length:path.departLength},{edgeId:path.id+':core',startS:path.departLength,endS:path.accelerationStartS,length:path.accelerationStartS-path.departLength},{edgeId:path.junctionId+':arrive:'+path.to,startS:path.accelerationStartS,endS:path.length,length:path.length-path.accelerationStartS}],departureGate:path.junctionId+':depart:'+path.from,arrivalGate:path.junctionId+':arrive:'+path.to};}
class IncompatibleSite extends Error{}
export function buildMixedRoute(base,j,directionIndex,template=JUNCTION_PROFILE_LIBRARY['0:3']){
 if(!plans.has(template.maxLanes))plans.set(template.maxLanes,mixedPlan(template.outer,template.middleRadius));const plan=plans.get(template.maxLanes),profile=template.profiles[directionIndex],direction=directionIndex===0?1:-1,depart=base.points.filter(p=>p.s<=base.departLength+.001),finish=base.points.filter(p=>p.s>=base.accelerationStartS-.001),core=plan.map(p=>({x:j.x+direction*p.x,z:j.z+direction*p.z,y:mixedVertical(profile,p.sPlan).y}));
 for(const[a,b]of[[depart.at(-1),core[0]],[finish[0],core.at(-1)]])if(Math.hypot(a.x-b.x,a.z-b.z,a.y-b.y)>1e-4)throw new IncompatibleSite('endpoint-mismatch');
 // Reject incompatible future generators instead of forcing a step or a steep join.
 const slope=(a,b)=>(b.y-a.y)/Math.hypot(b.x-a.x,b.z-a.z),start=slope(depart.at(-2),depart.at(-1)),end=slope(finish[0],finish[1]);
 if(Math.abs(start-mixedVertical(profile,0).grade)>.002||Math.abs(end-mixedVertical(profile,plan.at(-1).sPlan).grade)>.002)throw new IncompatibleSite('endpoint-grade-mismatch');
 for(let i=1;i<core.length;i++)if(!Number.isFinite(core[i].y)||Math.abs(slope(core[i-1],core[i]))>.048)throw new IncompatibleSite('profile-grade-limit');
 const points=annotate([...depart,...core.slice(1),...finish.slice(1)].map(p=>[p.x,p.z,p.y])),accelerationStartS=points[depart.length+core.length-2].s,tail=base.length-base.mergeTaperStartS,xs=points.map(p=>p.x),zs=points.map(p=>p.z);
 return{...base,points,length:points.at(-1).s,accelerationStartS,mergeTaperStartS:points.at(-1).s-tail,rampSpeed:50/3.6,alignment:'semidirectional-euler',bounds:{minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)}};
}
export function buildMotorwayJunction(j,buildBase){let selection=junctionSelection(j),type=selection.type;const choiceKey=junctionChoiceKey(j),base=[0,1,2,3].flatMap(n=>['right','left'].map(turn=>buildBase(turn,n,j)));let paths=base;
 if(type==='mixed'){try{paths=base.map((p,i)=>i===1||i===5?buildMixedRoute(p,j,(i-1)/4,JUNCTION_PROFILE_LIBRARY[selection.profileKey]):p);}catch(error){if(!(error instanceof IncompatibleSite))throw error;type='cloverleaf';selection={...selection,type,reason:error.message};paths=base;}}
 paths=paths.map(p=>applyJunctionMetadata(p,type,selection,choiceKey));return{type,selection,name:MOTORWAY_JUNCTION_TYPES[type],geometryKey:paths[0].geometryKey,choiceKey,paths};
}
