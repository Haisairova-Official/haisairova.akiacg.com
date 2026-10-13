import {buildPhysicalOccupancy,routeLeaderLimit,createLocalJunctionControl} from './local-traffic.mjs?rev=world21d';
import {projectPath} from './interchange-logic.mjs?rev=world21d';
import {initTrafficClass,trafficBodies,updateTrailerPose} from './traffic-fleet.mjs?rev=world21d';
import {bodyGap} from './close-passes.mjs?rev=world21d';
import {vehicleBodies} from './vehicle-footprint.mjs?rev=world21d';
import {initTraffic,stepTraffic,laneSafe,occupiesLane} from './traffic.mjs?rev=world21d';
import {physicalLocalById,localComponentById,MOTORWAYS,CONNECTORS,virtualLanes,outerLane,roadSection,LANE_SCALE,OUTER_LANE,connectorById,roadPoint,projectMain,projectNetwork,NETWORK_CENTRE} from './road-network.mjs?rev=world21d';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createNetworkTraffic(cars,{speedLimit=()=>Infinity}={}){
 let transitions=0,merges=0,recycles=0;const localControl=createLocalJunctionControl();cars.forEach(initTrafficClass);
 function place(t,id,s,lane=19){
  t.roadId=id;t.s=s;const lanes=MOTORWAYS.includes(id)?virtualLanes(id):[19];lane=lanes.reduce((a,b)=>Math.abs(a-lane)<Math.abs(b-lane)?a:b);t.v={id:t.id,x:s,z:lane,direction:1,lanes,width:t.width,frontExtent:t.frontExtent,rearExtent:t.rearExtent,maxSpeed:t.maxSpeed,braking:t.braking,changeDuration:t.trailer?5.2:t.type==='van'?4.4:3.2};initTraffic(t.v);t.baseSpeed=t.v.preferredSpeed;t.mergeGranted=false;t.planned=null;t.generation=(t.generation||0)+1;t.cooldown=0;t.passed=false;t.eligible=false;delete t.physical;sync(t);updateTrailerPose(t,true);
 }
 function sync(t){const p=roadPoint(t.roadId,t.v?.x??t.s,MOTORWAYS.includes(t.roadId)?(t.v.z-19)*LANE_SCALE:0);t.s=t.v?.x??t.s;t.x=p.x;t.z=p.z;t.y=p.y;t.heading=p.heading;t.grade=p.grade;t.changes=t.v?.changes||0;t.velocity=t.v?.velocity??t.velocity;t.speed=t.velocity;t.direction=Math.sin(p.heading)>=0?1:-1;t.signal=t.v?.signal??0;t.change=t.v?.change??null;t.lane=t.v?.lane??19;}
 function seed(x=40,z=19){
  cars.forEach((t,i)=>{let id,s,lane=13+(i%3)*6;if(i<12){id='A+';s=Math.max(450,x)-NETWORK_CENTRE.x+28+Math.floor(i/3)*48+i%3*13;}else if(i<15){id='A-';s=NETWORK_CENTRE.x-Math.max(650,x+180+(i-12)*44);}else if(i<18){id='B+';s=-1600+(i-15)*60;lane=25;}else{id='B-';s=-1600+(i-18)*60;lane=25;}place(t,id,s,lane);});
 }
 const navPlayer=(s,id)=>{const p=projectMain(id,s.x,s.z,s.roadY||0);return p.lane>roadSection(id).inner&&p.lane<roadSection(id).outer&&p.heightError<1.6?{x:p.s,z:19+p.lane/LANE_SCALE,roadY:0,vx:Math.max(0,Math.sin(p.heading)*(s.vx||0)+Math.cos(p.heading)*(s.vz||0)),speed:Math.max(0,s.speed),frontExtent:vehicleBodies(s)[0].length/2,rearExtent:s.vehicle==='dayun'?12.65:vehicleBodies(s)[0].length/2,width:vehicleBodies(s)[0].width}:null;};
 function step(player,dt){
  // Perception starts at the actual body, never a path-following ghost ahead
  // or inside another vehicle. Keep target speed as a command; sensed speed
  // is separate so acceleration feed-forward remains physically meaningful.
  for(const t of cars)if(t.physical&&t.physical.generation===t.generation){const p=t.physical,q=MOTORWAYS.includes(t.roadId)?projectMain(t.roadId,p.x,p.z,p.y):projectPath(connectorById(t.roadId),p.x,p.z,p.y,t.s);t.v.x=q.s;t.s=q.s;t.v.observedVelocity=p.velocity;sync(t);}
  const occupancy=buildPhysicalOccupancy(cars,connectorById),junctionLimits=localControl.step(cars,player,connectorById);
  const previous=new Map(cars.map(t=>[t,{s:t.s,x:t.x,z:t.z,y:t.y,roadId:t.roadId}])),enteredThisStep=new Set();
  // Decide before lateral movement; committed merge reservations are visible to
  // the receiving mainline, not isolated decorations on a separate strip.
  for(const t of cars){
   if(t.planned&&!connectorById(t.planned.id))t.planned=null;
   if(MOTORWAYS.includes(t.roadId)){
    if(!t.planned&&(t.trailer||t.id%3!==1||t.roadId==='A-'&&t.s>900)){const next=CONNECTORS.filter(c=>c.from===t.roadId&&c.startS>t.s&&c.startS-t.s<800).sort((a,b)=>a.startS-b.startS);if(next.length){const nearest=next[0].startS,choices=next.filter(p=>Math.abs(p.startS-nearest)<1);t.planned=choices[(t.id+t.generation)%choices.length];}}
   }else{
    const p=connectorById(t.roadId),remaining=p.length-t.s,group=cars.filter(o=>o.roadId===p.to).map(o=>o.v),mergeAt=projectMain(p.to,t.x,t.z,t.y).s;
    if(!t.mergeGranted&&remaining<180&&laneSafe({x:mergeAt,velocity:t.velocity,direction:1,lanes:virtualLanes(p.to)},virtualLanes(p.to).at(-1),group,navPlayer(player,p.to)))t.mergeGranted=true;
   }
  }
  for(const id of MOTORWAYS){
   const outer=virtualLanes(id).at(-1),members=cars.filter(t=>t.roadId===id),group=members.map(t=>t.v);if(!members.length)continue;const p=navPlayer(player,id);
   for(const t of cars)if(!MOTORWAYS.includes(t.roadId)&&t.mergeGranted&&connectorById(t.roadId).to===id){const q=projectMain(id,t.x,t.z,t.y);group.push({id:1000+t.id,x:q.s,z:outer,direction:1,velocity:t.velocity,preferredSpeed:t.velocity,width:t.width,frontExtent:t.frontExtent,rearExtent:t.rearExtent,braking:t.braking,lane:outer,lanes:virtualLanes(id),laneCooldown:999,signal:0,change:null});}
   // A departing combination remains an obstacle until its actual last
   // body clears the source carriageway. A front axle crossing a graph node
   // must not make the long trailer disappear from lane-change perception.
   for(const t of cars)if(!MOTORWAYS.includes(t.roadId)&&connectorById(t.roadId)?.from===id&&t.s<(connectorById(t.roadId).decelerationStartS??180)+60){
    for(const [part,b] of trafficBodies(t).entries()){const q=projectMain(id,b.x,b.z,b.y),dh=b.heading-q.heading,halfWidth=(Math.abs(Math.cos(dh))*b.width+Math.abs(Math.sin(dh))*b.length)/2,halfLength=(Math.abs(Math.cos(dh))*b.length+Math.abs(Math.sin(dh))*b.width)/2,section=roadSection(id);
     if(q.heightError>1.4||q.lane+halfWidth<section.inner||q.lane-halfWidth>section.outer)continue;
     const z=19+q.lane/LANE_SCALE,v=t.physical?Math.max(0,(t.physical.vx||0)*Math.sin(q.heading)+(t.physical.vz||0)*Math.cos(q.heading)):t.velocity;
     group.push({id:10000+t.id*2+part,reservation:true,x:q.s,z,lane:z,direction:1,velocity:v,observedVelocity:v,preferredSpeed:v,width:halfWidth*2,frontExtent:halfLength,rearExtent:halfLength,braking:t.braking,lanes:virtualLanes(id),laneCooldown:999,signal:0,change:null});
    }
   }
   for(const t of members){
    t.v.preferredSpeed=t.baseSpeed;
    // A missed exit never means braking to a standstill in a through lane.
    // Prepare the outer lane upstream; decelerate only on the real exit lane.
    if(t.planned&&!t.v.change&&t.v.lane<outer&&laneSafe(t.v,t.v.lane+6,group,p)){t.v.change={from:t.v.lane,to:t.v.lane+6,time:0};t.v.signal=-1;}
    if(t.planned&&t.v.lane===outer)t.v.signal=-1;
   }
   stepTraffic(group,p,dt);
   for(const t of members){
    if(t.planned&&connectorById(t.planned.id)&&t.s<t.planned.startS&&t.v.x>=t.planned.startS&&!t.v.change&&Math.abs(t.v.z-outer)<.1){const edge=t.planned;t.roadId=edge.id;t.v.x=Math.max(0,t.v.x-edge.startS);t.v.z=19;t.v.lane=19;t.v.lanes=[19];t.v.change=null;t.v.signal=-1;t.mergeGranted=false;t.planned=null;enteredThisStep.add(t);transitions++;}
    else if(t.planned&&t.v.x>t.planned.startS)t.planned=null;
   }
  }
  for(const t of cars)if(!MOTORWAYS.includes(t.roadId)&&!enteredThisStep.has(t)){
   const path=connectorById(t.roadId),remaining=path.length-t.v.x,old=roadPoint(path.id,t.v.x),ahead=roadPoint(path.id,Math.min(path.length,t.v.x+10)),bend=Math.abs(Math.atan2(Math.sin(ahead.heading-old.heading),Math.cos(ahead.heading-old.heading)))/10;
   const cruise=path.speedSegments?.find(p=>t.v.x>=p.startS&&t.v.x<=p.endS)?.speed??path.rampSpeed??(path.city?8:12),entry=path.decelerationStartS??0,end=path.decelerationEndS??entry;
   const rampTarget=path.accelerationStartS!==undefined&&t.v.x>path.accelerationStartS?cruise+(Math.min(t.baseSpeed,27)-cruise)*clamp((t.v.x-path.accelerationStartS)/320,0,1):t.v.x<end?Math.max(cruise,Math.min(t.baseSpeed,Math.sqrt(cruise*cruise+2*2.4*Math.max(0,end-t.v.x)))):cruise;
   let target=Math.min(rampTarget,Math.sqrt(2.3/Math.max(.002,bend)),speedLimit(t)),hard=Infinity;
   if(Number.isFinite(path.serviceSpeed)&&t.v.x<=path.serviceExitS)target=Math.min(target,Math.sqrt(path.serviceSpeed**2+2*t.braking*Math.max(0,path.serviceEntryS-t.v.x)));
   if(Number.isFinite(path.townSpeed)&&t.v.x<=path.townExitS)target=Math.min(target,Math.sqrt(path.townSpeed**2+2*t.braking*Math.max(0,path.townEntryS-t.v.x))); 
   for(const limit of path.speedSegments||[])if(t.v.x<=limit.endS)target=Math.min(target,Math.sqrt(limit.speed**2+2*t.braking*Math.max(0,limit.startS-t.v.x)));
   const leader=routeLeaderLimit(t,path,occupancy,player);if(Number.isFinite(leader.gap)){target=Math.min(target,Math.max(0,leader.velocity+(leader.gap-9-t.velocity*.8)*.65));hard=Math.min(hard,leader.gap-4);}
   const control=junctionLimits.get(t.id);if(control){target=Math.min(target,Math.sqrt(2*t.braking*control.distance));hard=Math.min(hard,control.distance);}
   if(!t.mergeGranted&&remaining<200){const stop=remaining-157;target=Math.min(target,Math.sqrt(Math.max(0,stop)*5));hard=Math.min(hard,Math.max(0,stop));}
   t.v.velocity+=clamp(target-t.v.velocity,-t.braking*dt,2.2*dt);t.v.x+=Math.min(t.v.velocity*dt,Math.max(0,hard));t.v.signal=remaining<200?1:0;
   if(t.v.x>=path.length&&t.mergeGranted){t.roadId=path.to;t.v.x=path.joinS+(t.v.x-path.length);t.v.lanes=virtualLanes(path.to);t.v.z=t.v.lane=t.v.lanes.at(-1);t.v.change=null;t.v.signal=0;t.v.laneCooldown=7;t.mergeGranted=false;merges++;}
  }
  cars.forEach(t=>{sync(t);updateTrailerPose(t);});
  // A shared-space check handles overlapping exit leads and late player cut-ins
  // across graph edges. Only forward conflict slows a vehicle; no position jump.
  for(const t of cars){const prev=previous.get(t),sin=Math.sin(t.heading),cos=Math.cos(t.heading),others=cars.filter(o=>o!==t).concat([{...player,y:player.roadY||0,player:true}]);
   if(others.some(o=>{const dx=o.x-t.x,dz=o.z-t.z,forward=dx*sin+dz*cos,side=dx*cos-dz*sin;if(Math.abs(o.y-t.y)>1.4||forward<=0||forward>(t.frontExtent+(o.rearExtent||8)+5))return false;const other=o.player?vehicleBodies(o):trafficBodies(o,{physical:false});return trafficBodies(t,{physical:false}).some(a=>other.some(b=>{const dh=b.heading-a.heading,side=(b.x-a.x)*Math.cos(a.heading)-(b.z-a.z)*Math.sin(a.heading),sideWidth=a.width/2+Math.abs(Math.cos(dh))*b.width/2+Math.abs(Math.sin(dh))*b.length/2;return Math.abs(side)<sideWidth+.30&&bodyGap(a,b)<3.15;}));})){
    // Keep transition identities coherent: rollback only the local step while
    // still on the same edge (the graph endpoints themselves are coincident).
    if(Math.hypot(t.x-prev.x,t.z-prev.z)<2){t.v.x=MOTORWAYS.includes(t.roadId)?t.v.x-t.velocity*dt:Math.max(0,t.v.x-t.velocity*dt);if(t.roadId===prev.roadId&&MOTORWAYS.includes(t.roadId))t.v.x=prev.s;t.v.velocity=Math.max(0,t.velocity-9*dt);sync(t);updateTrailerPose(t);}
   }
  }
  for(const t of cars){
   if(Math.hypot(t.x-player.x,t.z-player.z)<1100)continue;
   // Re-populate the same physical local road only outside view, away from
   // junctions/merge areas and with full-body clearance. A long 12km itinerary
   // must not lock the entire fixed traffic pool in an unseen remote district.
   const here=projectNetwork(player.x,player.z,player.roadY||0),local=here&&physicalLocalById(here.id);
   if(local&&!(t.physical?.contactCooldown>0)){
    const graph=localComponentById(local.componentId),direction=t.id%3===0?-1:1,lane=graph?.laneEdges.find(e=>e.direction===direction),path=graph?.itineraries.find(p=>p.physicalSegments.some(e=>e.edgeId===lane?.id));
    if(path){const edge=path.physicalSegments.find(e=>e.edgeId===lane.id),q=projectPath(path,player.x,player.z,player.roadY||0);let station=q.s+760+(t.id%7)*53;
     for(let attempt=0;attempt<12&&station<edge.endS-100;attempt++,station+=35){if(station<edge.startS+100)continue;const p=roadPoint(path.id,station),distance=Math.hypot(p.x-player.x,p.z-player.z);if(distance<700||distance>1200)continue;const radius=24+(t.trailer?12:0),clear=!cars.some(o=>o!==t&&Math.abs((o.physical?.y??o.y)-p.y)<2&&Math.hypot((o.physical?.x??o.x)-p.x,(o.physical?.z??o.z)-p.z)<radius+(o.trailer?12:0));if(clear){place(t,path.id,station);t.v.velocity=Math.min(t.v.velocity,45/3.6);sync(t);recycles++;break;}}
    }
    continue;
   }
   // Never recycle a visible car or an on-ramp merge. Mainline distant vehicles
   // re-enter a checked gap outside the camera, with a fresh generation ID.
   if(!MOTORWAYS.includes(t.roadId))continue;
   const current=projectNetwork(player.x,player.z,player.roadY||0),id=t.id%5<3&&current&&MOTORWAYS.includes(current.id)?current.id:t.roadId;
   let s=projectMain(id,player.x,player.z,player.roadY||0).s+380+(t.id%7)*43,lane=virtualLanes(id)[t.id%virtualLanes(id).length],tries=0;
   if(Math.hypot(roadPoint(id,s,(lane-19)*LANE_SCALE).x-player.x,roadPoint(id,s,(lane-19)*LANE_SCALE).z-player.z)>1050)continue;
   const clear=()=>{const p=roadPoint(id,s,(lane-19)*LANE_SCALE);return !cars.some(o=>o!==t&&((o.roadId===id&&occupiesLane(o.v,lane)&&Math.abs(o.s-s)<Math.max(20+t.frontExtent+o.rearExtent-3.65,12+o.velocity*.8))||(Math.abs(o.y-p.y)<1.6&&Math.hypot(o.x-p.x,o.z-p.z)<24+(t.trailer?10:0)+(o.trailer?10:0))));};
   while(tries++<80&&!clear())s+=18;
   const finalPoint=roadPoint(id,s,(lane-19)*LANE_SCALE);if(clear()&&Math.hypot(finalPoint.x-player.x,finalPoint.z-player.z)<=1050){place(t,id,s,lane);recycles++;}
  }
 }
 seed();
 return{seed,step,get transitions(){return transitions;},get merges(){return merges;},get recycles(){return recycles;}};
}
