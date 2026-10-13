import {trafficBodies} from './traffic-fleet.mjs?rev=world21d';
import {projectPath} from './interchange-logic.mjs?rev=world21d';
import {vehicleBodies} from './vehicle-footprint.mjs?rev=world21d';
// Shared physical edges and explicit local-road junction reservations. A route
// choice must not hide the vehicle in front merely because its route ID differs.
const segments=(path)=>path.physicalSegments||(path.junctionId&&!path.city&&path.departLength>0&&path.accelerationStartS>path.departLength?[{edgeId:path.junctionId+':depart:'+path.from,startS:0,endS:path.departLength,length:path.departLength},{edgeId:path.id+':core',startS:path.departLength,endS:path.accelerationStartS,length:path.accelerationStartS-path.departLength},{edgeId:path.junctionId+':arrive:'+path.to,startS:path.accelerationStartS,endS:path.length,length:path.length-path.accelerationStartS}]:[{edgeId:path.id,startS:0,endS:path.length,length:path.length}]);
export function buildPhysicalOccupancy(cars,getPath){const map=new Map();map.branchRecords=[];for(const t of cars){const path=getPath(t.roadId);if(!path)continue;if(path.junctionId&&!path.city&&!path.service)map.branchRecords.push({car:t,path});const rear=t.s-(t.rearExtent||1.825)-1,front=t.s+(t.frontExtent||1.825)+1;for(const edge of segments(path)){if(edge.endS<rear||edge.startS>front)continue;const item={car:t,start:(edge.edgeStartS||0)+Math.max(0,rear-edge.startS),end:(edge.edgeStartS||0)+Math.min(edge.endS-edge.startS,front-edge.startS),velocity:t.physical?.velocity??t.velocity};if(!map.has(edge.edgeId))map.set(edge.edgeId,[]);map.get(edge.edgeId).push(item);}}return map;}
export function routeLeaderLimit(t,path,occupancy,player=null){let gap=Infinity,velocity=0;for(const edge of segments(path)){if(edge.endS<t.v.x||edge.startS>t.v.x+200)continue;for(const item of occupancy.get(edge.edgeId)||[]){if(item.car===t)continue;const rear=edge.startS+item.start-(edge.edgeStartS||0),front=edge.startS+item.end-(edge.edgeStartS||0),ownFront=t.v.x+(t.frontExtent||1.825);if(front<=t.v.x)continue;const d=rear-ownFront;if(d<gap){gap=d;velocity=item.velocity;}}}// Separate graph cores may still share a narrow, same-height fork throat.
 // Per-body projection keeps a long trailer visible until its swept footprint
 // truly separates. Once lanes are apart, it imposes no artificial shared edge.
 const ownBody=t.physical||t,ownStation=t.physical?projectPath(path,ownBody.x,ownBody.z,ownBody.y).s:t.v.x;
 for(const record of occupancy.branchRecords||[]){const other=record.car,p=record.path,otherBody=other.physical||other;if(other===t||p.id===path.id||p.junctionId!==path.junctionId)continue;
  const departure=p.from===path.from&&t.v.x<path.departLength+180&&other.s<p.departLength+180,arrival=p.to===path.to&&t.v.x>path.accelerationStartS-180&&other.s>p.accelerationStartS-180;
  if(!departure&&!arrival||Math.hypot(otherBody.x-ownBody.x,otherBody.z-ownBody.z)>130||Math.abs((otherBody.y||0)-(ownBody.y||0))>2)continue;
  for(const b of trafficBodies(other)){const q=projectPath(path,b.x,b.z,b.y),dh=b.heading-q.heading,parallel=Math.cos(dh),halfLength=(Math.abs(parallel)*b.length+Math.abs(Math.sin(dh))*b.width)/2,halfWidth=(Math.abs(parallel)*b.width+Math.abs(Math.sin(dh))*b.length)/2;
   if(parallel<.75||Math.abs(q.y-(b.y||0))>1.4||q.distance>halfWidth+(t.width||1.65)/2+.3||q.s+halfLength<=ownStation||q.s<ownStation-2)continue;
   // Stable priority for a side-by-side convergence prevents reciprocal waits.
   if(Math.abs(q.s-ownStation)<2&&(t.id??0)<(other.id??0))continue;
   const d=q.s-halfLength-(ownStation+(t.frontExtent||1.825));if(d<gap){gap=d;velocity=Math.max(0,(other.physical?.velocity??other.velocity??0)*parallel);}
  }
 }
 // The player has no AI graph reservation. Perceive its real chassis and
 // trailer on the upcoming pavement instead of waiting for the emergency
 // 3.15m overlap guard. Path projection also sees a physically shared branch
 // whose logical route differs. Off-lane, behind and other-deck bodies do not
 // become leaders; an oncoming or stationary obstruction has zero lead speed.
 if(player&&Math.hypot(player.x-ownBody.x,player.z-ownBody.z)<210){
  for(const b of vehicleBodies(player)){
   const q=projectPath(path,b.x,b.z,b.y),dh=b.heading-q.heading,
    halfLength=(Math.abs(Math.cos(dh))*b.length+Math.abs(Math.sin(dh))*b.width)/2,
    halfWidth=(Math.abs(Math.cos(dh))*b.width+Math.abs(Math.sin(dh))*b.length)/2;
   if(Math.abs(q.y-(b.y||0))>1.4||q.distance>halfWidth+(t.width||1.65)/2+.3||q.s+halfLength<=ownStation||q.s<ownStation-2||q.s-ownStation>200)continue;
   const d=q.s-halfLength-(ownStation+(t.frontExtent||1.825));
   if(d<gap){gap=d;velocity=Math.max(0,(player.vx||0)*Math.sin(q.heading)+(player.vz||0)*Math.cos(q.heading));}
  }
 }
 return{gap,velocity};}
export function createLocalJunctionControl(){const held=new Map();let waits=0;
 return{step(cars,player,getPath){const controls=new Map(),candidates=new Map(),playerParts=player?vehicleBodies(player):[];for(const t of cars){const path=getPath(t.roadId);if(!path?.controls)continue;const groups=new Map();for(const c of path.controls){if(t.s>c.endS+(t.rearExtent||2)+5||t.s<c.s-70)continue;const old=groups.get(c.node);if(old){old.s=Math.min(old.s,c.s);old.endS=Math.max(old.endS,c.endS);old.priority=Math.min(old.priority,c.priority);}else groups.set(c.node,{...c});}for(const c of groups.values()){const entry={car:t,control:c,key:`${t.id}:${t.generation}`};controls.set(entry.key+':'+c.node,entry);if(!candidates.has(c.node))candidates.set(c.node,[]);candidates.get(c.node).push(entry);}}
  for(const[node,entry]of held){const active=controls.get(entry.key+':'+node);if(!active)held.delete(node);else held.set(node,active);}
  for(const[node,list]of candidates){if(held.has(node))continue;const eligible=list.filter(e=>e.car.s>=e.control.s-45).sort((a,b)=>Number(b.car.s>=b.control.s-1)-Number(a.car.s>=a.control.s-1)||(a.car.s>=a.control.s-1&&b.car.s>=b.control.s-1?(a.control.endS-a.car.s)-(b.control.endS-b.car.s):0)||a.control.priority-b.control.priority||(a.control.s-a.car.s)-(b.control.s-b.car.s)||a.car.id-b.car.id);if(eligible.length)held.set(node,eligible[0]);}
  // Player queues can extend beyond the NPC projection window (±35m). Use
  // the full local path here so a following player cannot block its leader.
  const limits=new Map();for(const[node,list]of candidates)for(const e of list){const p=e.control.point,playerNear=p&&playerParts.some(b=>{if(Math.abs((b.y||0)-p.y)>=2.5||Math.hypot(b.x-p.x,b.z-p.z)>=(e.control.radius||65)+Math.hypot(b.width,b.length)/2)return false;const path=getPath(e.car.roadId);if(path?.points){const q=projectPath(path,b.x,b.z,b.y),sameDirection=Math.cos(b.heading-q.heading)>.55,behind=q.s+b.length/2<e.car.s-(e.car.rearExtent||2)-1;if(sameDirection&&behind&&q.distance<Math.max(3,(b.width+(e.car.width||2))/2+.4))return false;}return true;});
   if(held.get(node)?.key===e.key&&!playerNear)continue;const stop=Math.max(0,e.control.s-e.car.v.x-3),previous=limits.get(e.car.id);if(!previous||stop<previous.distance)limits.set(e.car.id,{distance:stop,node});waits++;}
  return limits;},get waitingChecks(){return waits;},get reservations(){return held.size;}};
}
