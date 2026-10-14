import {jiangwanStartPose} from './service-start.mjs?rev=world21h';
import {createTollWorld} from './toll-world.js?rev=world21d';
import{createLocalRoadLoader}from'./local-road-loader.mjs?rev=world21d';
import{localOwnerCell,localCellPlan}from'./local-road-selection.mjs?rev=world21d';
import{localCellCorridors}from'./local-road-catalogue.mjs?rev=world21d';
import{createLocalRoadWorld}from'./local-road-world.js?rev=world21d';
import{setLocalComponents,LOCAL_COMPONENTS,LOCAL_ROAD_SURFACES,physicalLocalById,localComponentById}from'./road-network.mjs?rev=world21d';
import{localSite}from'./local-sites.mjs?rev=world21d';
import {regionForIndex,regionGeometryKey,regionPose} from './regions.mjs?rev=world21d';
import {regionLayout,regionWorldPoint,regionPavementAt} from './region-roads.mjs?rev=world21d';
import {monitorWarningPlacement,MONITOR_WARNING_WIDTH,MONITOR_WARNING_POST_BACK} from './monitor-placement.mjs?rev=world21d';
import {createRoadBuildQueue} from './road-build-queue.mjs?rev=world21d';
import {contextFor,createRigidContext} from './rigid-vehicle.mjs?rev=world21d';
import {vehicleBodies} from './vehicle-footprint.mjs?rev=world21d';
import {initTrafficClass,trafficBodies} from './traffic-fleet.mjs?rev=world21d';
import {createTrafficModel} from './traffic-models.js?rev=world21d';
import {routeNavigation,navigationStats} from './navigation.mjs?rev=world21d';
import {createPassTracker} from './close-passes.mjs?rev=world21d';
import {createNetworkWorld} from './network-world.js?rev=world21p';
import {createNetworkTraffic} from './network-traffic.mjs?rev=world21d';
import {MOTORWAYS,CONNECTORS,setLocalRoutes,laneOffsets,roadFamily,roadSection,networkRevision,MOTORWAY_NAMES,MOTORWAY_DEFS,LANE_SCALE,JUNCTIONS,aheadJunction,ARCHIVE_ACCESS,NETWORK_CENTRE,projectNetwork,projectMain,connectorById,mainHeight,mainPoint,mainArcDistance,stationBefore} from './road-network.mjs?rev=world21d';
import {initTraffic,stepTraffic,occupiesLane} from './traffic.mjs?rev=world21d';
import {createMonitor,stepMonitor,resetMonitorJourney,monitorAt,monitorIndices} from './monitor.mjs?rev=world21d';
import {vehicleSpec} from './vehicle-specs.mjs?rev=world21d';
import {stepCar,collides,stopCar,respawnCar} from './physics.mjs?rev=world21d';
import {sampleYarisBounce,YARIS_PLAY_SPEED} from './yaris-model.js?rev=world21d';
import {HIGHWAY_START,CHUNK_LENGTH,CHUNK_COUNT,EXIT_INTERVAL,LANES,nextExitAt,chunkIndices,touchesTraffic} from './highway-logic.mjs?rev=world21d';

import {createInterchanges} from './interchanges.js?rev=world21d';
import {INTERCHANGE_NAMES,INTERCHANGES,reachedTerminal,resolvePathContact} from './interchange-logic.mjs?rev=world21d';
// Road pieces and traffic are allocated once. Streaming only repositions this fixed pool.
import {createChallenge,startChallenge,stepChallenge,challengeContact,safePass} from './challenge.mjs?rev=world21d';

export function createHighway(T,scene,{sign,toast,onTownLoad=()=>{},deferBuild=false}){
 const root=new T.Group();scene.add(root);const buildQueue=createRoadBuildQueue();let physicsState=null,simulationTime=0;
 function* prepareSlice(group){
  group.updateWorldMatrix(true,true);const meshes=[];group.traverse(m=>{if(m.userData.driveCollider&&m.geometry?.attributes.position?.count>=3)meshes.push(m);});
  let prepared=null,index=0;while(true){const current=physicsState&&contextFor(physicsState);if(!current)return;if(current!==prepared){prepared=current;index=0;}
   if(index<meshes.length){const mesh=meshes[index++];if(prepared.isSceneMeshNear(mesh))prepared.ensureSceneMesh(mesh,false,true);yield;continue;}
   for(const mesh of meshes){const e=prepared.surfaces.get(mesh);if(e){const enabled=prepared.isSceneMeshNear(mesh);e.collider.setEnabled(enabled);e.topCollider?.setEnabled(enabled);e.enabled=enabled;}}return;
  }
 }

 const geo=new T.BoxGeometry(1,1,1),wheelGeo=new T.CylinderGeometry(.28,.28,.20,12), materials=new Map();
 const material=color=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.85}));return materials.get(color);};
 function box(parent,w,h,d,color,x,y,z){const m=new T.Mesh(geo,material(color));m.scale.set(w,h,d);m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);return m;}
 const chunks=[],traffic=[],challenge=createChallenge(),monitor=createMonitor(),monitorPool=[];
 let town={x:0,z:0,y:0,angle:0,index:null},townVersion=0;const townLocal=s=>{const dx=s.x-town.x,dz=s.z-town.z,c=Math.cos(town.angle),a=Math.sin(town.angle);return{x:dx*c-dz*a,z:dx*a+dz*c};};const loadTown=p=>{const graph=LOCAL_COMPONENTS.find(g=>g.regionIndices.includes(p.index));p={...p,localConnected:!!graph,localTargetName:graph?.ports.find(q=>q.pose.index!==p.index)?.region.name};if(regionGeometryKey(regionForIndex(town.index),town)===regionGeometryKey(regionForIndex(p.index),p))return;town=regionPose(p);townVersion++;networkWorld.setTown(town);const task=onTownLoad(town);if(task?.next)buildQueue.add(`district:${town.regionId}`,task,(()=>{const b=regionLayout(town.index)?.bounds,r=b?Math.max(90,Math.hypot(Math.max(Math.abs(b.minX),Math.abs(b.maxX)),Math.max(Math.abs(b.minZ),Math.abs(b.maxZ)))):90;return{minX:town.x-r,maxX:town.x+r,minZ:town.z-r,maxZ:town.z+r};})(),()=>{townVersion++;},{forceDistance:180,actorDistance:180});};
 let monitorRoad='A+';let trafficClock=0;const passTracker=createPassTracker();
 let lockedJunction=null,route=null,wallContact=false;
 let mode='city',progress=0,trip=0,challengeProgress=0,recycled=0,contacts=0,nearMisses=0,impact=0,exitTimer=0,exitMoved=false,entries=0,exits=0;
 // Legacy straight-road accounting remains for old acceptance observables,
 // but those 570 permanently hidden meshes no longer allocate geometry.
 for(let n=0;n<CHUNK_COUNT;n++)chunks.push({index:-1});
 // Three fixed gantry / warning pairs; all supporting posts are on the median.
 for(let i=0;i<3;i++){
  const node=new T.Group(),warning=new T.Group();root.add(node,warning);
  const post=box(node,.35,7,.35,0x789598,0,3.5,6.5),beam=box(node,.35,.35,23,0x789598,0,7,18);post.userData.driveCollider=beam.userData.driveCollider='wall';const cameras=[];
  sign('限速 120  ·  游戏监控',0,6.3,19,11,1.1,-Math.PI/2,'#356a69','#f4edcc',node);
  for(let k=0;k<4;k++){const body=box(node,.5,.4,.5,0x293e48,-.1,6.65,19),lens=box(node,.08,.13,.17,0xe0bf77,-.4,6.65,19);cameras.push({body,lens});}
  const warningPost=box(warning,.18,4,.18,0x789598,0,2,0);warningPost.userData.driveCollider='wall';const warningFaces=[];
  warningFaces.push(sign('前方 300 m 监控',0,3.4,0,MONITOR_WARNING_WIDTH,1.1,-Math.PI/2,'#eee8c7','#3e6561',warning));
  warningFaces.push(sign('游戏规则 · 保持车道',0,2.2,0,MONITOR_WARNING_WIDTH,.8,-Math.PI/2,'#eee8c7','#3e6561',warning));
  for(const[y,h]of[[3.4,1.1],[2.2,.8]]){const panel=box(warning,.12,h,MONITOR_WARNING_WIDTH,0x71847d,.07,y,0);panel.userData.driveCollider='wall';panel.userData.signRole='monitor-warning-panel';warningFaces.push(panel);}
  monitorPool.push({node,warning,warningPost,warningFaces,post,beam,cameras,index:-1});
 }
 const junctions=createInterchanges(T,scene,{sign,box,sharedGeometries:[geo],buildQueue,prepareSlice});
 // Lightweight cars share all geometry and materials. The visual child bounces, the root keeps its lane.
 const colors=[0xe9d8ac,0xb7d2d0,0xc0b8cb,0xcd9c88,0xe4e8dc,0x87aab9];
 for(let i=0;i<21;i++){
  const t=initTrafficClass({id:i,eligible:false,direction:i<15?1:-1,x:0,z:i<15?LANES[i%3]:[-14,-8,-2][i%3],cooldown:0,passed:false});Object.assign(t,createTrafficModel(T,t.type,colors[i%6],{box,material,wheelGeo}));root.add(t.node);if(t.trailerNode)root.add(t.trailerNode);traffic.push(t);
 }
 const tollWorld=createTollWorld(T,scene,{sign,toast}),networkWorld=createNetworkWorld(T,scene,{sign,buildQueue,prepareSlice}),graphTraffic=createNetworkTraffic(traffic,{speedLimit:t=>tollWorld.speedLimit(t)}),localWorld=createLocalRoadWorld(T,scene,{buildQueue,prepareSlice,groundHeight:networkWorld.groundHeight});let localGraph=null,lastLocalRequest=null;const localLoader=createLocalRoadLoader({buildSync:({index})=>localCellCorridors(index,{getAccess:i=>junctions.dataAt(i)})});
 function seedTraffic(x){graphTraffic.seed(x,19);}
 const trafficRoadHistory=new Map();
 function trafficKeeps(){const keep=new Set();for(const t of traffic){let h=trafficRoadHistory.get(t.id);if(!h||h.generation!==t.generation){h={generation:t.generation,current:t.roadId,x:t.x,z:t.z,previous:null,distance:Infinity};trafficRoadHistory.set(t.id,h);}else{h.distance+=Math.hypot(t.x-h.x,t.z-h.z);if(h.current!==t.roadId){h.previous=h.current;h.current=t.roadId;h.distance=0;}h.x=t.x;h.z=t.z;}keep.add(t.roadId);if(h.previous&&h.distance<t.length+(t.trailer?.length||0)+8)keep.add(h.previous);else h.previous=null;}return [...keep].filter(Boolean);}
 function stream(x,z=19){const keep=trafficKeeps();if(route?.id&&(connectorById(route.id)?.service||connectorById(route.id)?.local)&&!keep.includes(route.id))keep.push(route.id);
  // Every side-facing village resolves the same deterministic cell matching.
  // Keep already occupied components until the last actor leaves its graph.
  if(mode!=='city')lastLocalRequest=null;
  if(mode==='city'&&town.index!==null&&lastLocalRequest!==town.index&&(!localGraph||!localGraph.regionIndices.includes(town.index))){const owner=localOwnerCell(town.index),plan=owner&&localCellPlan(owner.i,owner.k),types=Object.fromEntries((plan?.nodes||[]).map(n=>[n.index,junctions.actualTypeAt(n.index)])),key=(plan?.id||String(town.index))+'|'+JSON.stringify(types),generated=localLoader.request(key,{index:town.index,types});if(generated){lastLocalRequest=town.index;localGraph=generated.graphs.find(g=>g.regionIndices.includes(town.index))||null;const retained=LOCAL_COMPONENTS.filter(g=>keep.some(id=>connectorById(id)?.componentId===g.id));setLocalComponents([...new Map([...retained,...generated.graphs].map(g=>[g.id,g])).values()]);if(generated.error)toast('地方公路准备失败，当前街区与高速入口仍可通行');}}
  const nearbyGraphs=LOCAL_COMPONENTS.filter(g=>g===localGraph&&(mode==='local'||mode==='city'&&g.regionIndices.includes(town.index))||keep.some(id=>connectorById(id)?.componentId===g.id)||g.ports.some(p=>Math.hypot(x-p.point.x,z-p.point.z)<1800));if(nearbyGraphs.length!==LOCAL_COMPONENTS.length){if(localGraph&&!nearbyGraphs.includes(localGraph)){localGraph=null;lastLocalRequest=null;}setLocalComponents(nearbyGraphs);}
  const townGraph=LOCAL_COMPONENTS.find(g=>g.regionIndices.includes(town.index));if(regionForIndex(town.index).kind==='village'&&!!town.localConnected!==!!townGraph)loadTown({...town,localConnected:!!townGraph,localTargetName:townGraph?.ports.find(p=>p.pose.index!==town.index)?.region.name});
  junctions.update(x,lockedJunction,z,keep,route?.id,[...new Set(LOCAL_COMPONENTS.flatMap(g=>g.regionIndices))]);const localRoutes=junctions.networkRoutes();for(const p of localRoutes){const port=LOCAL_COMPONENTS.flatMap(g=>g.ports).find(q=>q.pose.index===p.localIndex);if(port&&!p.controls.some(c=>c.node===port.node.id)){const node=LOCAL_COMPONENTS.flatMap(g=>g.nodes).find(n=>n.id===port.node.id);p.controls.push({node:node.id,point:node.point,radius:48,priority:0,s:p.townEntryS+port.mainStartS-12,endS:p.townEntryS+port.mainEndS+12});}}setLocalRoutes(localRoutes,keep);
  localWorld.update(LOCAL_COMPONENTS,{x,z},traffic.flatMap(t=>[t.physical||t,...(t.physical?.trailer?[t.physical.trailer]:t.trailerPose?[t.trailerPose]:[])]));
  networkWorld.update({x,z},keep);
  tollWorld.update([...ARCHIVE_ACCESS.tollPlazas||[],...junctions.slots.flatMap(s=>s.data.tollPlazas||[])],{x,z},traffic);
  if(!deferBuild){const occupied=traffic.filter(t=>Math.hypot(t.x-x,t.z-z)<250&&!MOTORWAYS.includes(t.roadId)).map(t=>t.roadId?.startsWith('town:')?'local:'+t.roadId.split(':').slice(1,3).join(':'):t.roadId).filter(Boolean);buildQueue.ensure({x,z},occupied,traffic.flatMap(t=>[t.physical||t,...(t.physical?.trailer?[t.physical.trailer]:t.trailerPose?[t.trailerPose]:[])]));}
  const wanted=chunkIndices(x);
  const stale=chunks.filter(c=>!wanted.includes(c.index));
  for(const index of wanted)if(!chunks.some(c=>c.index===index)){
   const c=stale.pop();if(c.index>=0)recycled++;c.index=index;
  }
  const id=route?.network&&MOTORWAYS.includes(route.id)?route.id:monitorRoad;monitorRoad=id;const along=projectMain(id,x,z,0).s+NETWORK_CENTRE.x,n=Math.floor((along-40)/1440),monitors=[n-1,n,n+1].filter(i=>id!=='A+'||monitorAt(i).x>=600);
  monitorPool.forEach((p,i)=>{p.node.visible=p.warning.visible=i<monitors.length;if(i<monitors.length&&(p.index!==monitors[i]||p.roadId!==id)){p.index=monitors[i];p.roadId=id;const section=roadSection(id),lanes=laneOffsets(id);p.post.position.z=19+section.inner-1;p.beam.scale.z=section.width+3;p.beam.position.z=20;p.cameras.forEach((camera,k)=>{for(const mesh of [camera.body,camera.lens]){mesh.visible=k<lanes.length;mesh.position.z=19+(lanes[k]||0);}});const m=monitorAt(p.index),s=m.x-NETWORK_CENTRE.x,q=mainPoint(id,s),warningStation=stationBefore(id,s,300),wp=monitorWarningPlacement(id,warningStation),w=wp.point;p.warning.userData.placement=wp;p.warningPost.position.set(MONITOR_WARNING_POST_BACK,(4.05+wp.base)/2,19+wp.offset);p.warningPost.scale.y=4.05-wp.base;for(const face of p.warningFaces)if(face)face.position.z=19+wp.offset;for(const [g,v]of [[p.node,q],[p.warning,w]]){g.rotation.y=v.heading-Math.PI/2;const a=g.rotation.y;g.position.set(v.x-19*Math.sin(a),v.y,v.z-19*Math.cos(a));}}p.warning.visible=p.warning.visible&&p.warning.userData.placement?.valid!==false;});
 }
 seedTraffic(40);stream(40);
 function enter(s){resetMonitorJourney(monitor);mode='highway';lockedJunction=null;route=null;s.roadY=0;s.roadGrade=0;entries++;trip=0;seedTraffic(s.x);stream(s.x,s.z);toast('云岭高速 · 右侧应急车道 · 沿指路牌驶入互通或回城');}
 function reset(){tollWorld.reset();resetMonitorJourney(monitor);mode='city';lockedJunction=null;route=null;wallContact=false;challenge.active=false;challenge.combo=0;exitTimer=0;exitMoved=false;impact=0;loadTown({x:0,z:0,y:0,angle:0,index:null});progress=0;trip=0;challengeProgress=0;stream(40);seedTraffic(40);}
 const physicsKey=()=>`${Math.floor(simulationTime*2)}:${graphTraffic.recycles}:${townVersion}:${networkRevision()}:${junctions.renderRevision}:${networkWorld.physicsRevision}:${localWorld.revision}:${tollWorld.revision}:${mode}:${networkWorld.recycled}:${Math.floor((route?.s||0)/80)}:${junctions.slots.map(p=>p.index+':'+p.type).join(',')}`;
 function step(s,input,dt,boxes){
  physicsState=s;simulationTime+=dt;
  tollWorld.step(s,traffic,dt,contextFor(s));
  if(mode==='city'){
   const urban=town.index!==null&&!!regionLayout(town.index)?.viaduct,pavement=town.index===null?null:regionPavementAt(s,town,urban&&Number.isFinite(s.chassisY)?s.chassisY-.22:s.roadY);if(pavement?.inside){const points=pavement.road.points;let lo=1,hi=points.length-1;while(lo<hi){const m=(lo+hi)>>1;if(points[m].s<pavement.s)lo=m+1;else hi=m;}const a=points[lo-1],b=points[lo];s.roadY=pavement.y;s.roadGrade=(b.y-a.y)/Math.max(.001,Math.hypot(b.x-a.x,b.z-a.z));}else if(!urban){s.roadY=town.y;s.roadGrade=0;}else{const c=contextFor(s),ground=[];if(c)for(let i=0;i<c.units[0].wheels.length;i++)if(c.vehicle.wheelIsInContact(i)){const p=c.vehicle.wheelContactPoint(i);if(p)ground.push(p.y-.22);}if(ground.length){s.roadY=ground.reduce((a,b)=>a+b)/ground.length;s.roadGrade=0;}}graphTraffic.step(s,dt);stepCar(s,input,dt,boxes,{scene,mode,spatialStreaming:true,physicsKey:physicsKey(),traffic});const p=townLocal(s);
   const port=localGraph?.ports.find(port=>port.pose.index===town.index),physical=port&&projectNetwork(s.x,s.z,s.roadY,localGraph.id);
   if(port&&physical?.id===localGraph.id&&Math.hypot(s.x-port.point.x,s.z-port.point.z)<25&&Math.sin(port.heading)*(s.vx||0)+Math.cos(port.heading)*(s.vz||0)>.1){mode='local';lockedJunction=null;route=physical;toast('沿地方公路驶往'+localGraph.ports.find(q=>q!==port).region.name);}
   if(mode==='city'&&p.x>42&&p.x<60&&(s.vx*Math.cos(town.angle)-s.vz*Math.sin(town.angle))>.1&&(Math.abs(p.z-19)<4.5||Math.abs(p.z+19)<4.5)){
    mode='ramp';entries++;resetMonitorJourney(monitor);route=null;lockedJunction=town.index;
    if(town.index===null)route={...projectNetwork(s.x,s.z,s.roadY,'archive:A->A+'),id:'archive:A->A+',network:true};
    stream(s.x,s.z);toast('沿接入匝道驶入高速 · 场景已提前加载');
   }
   stream(s.x,s.z);return;
  }
  const prev={x:s.x,z:s.z,speed:s.speed},before=s.collisions;
  let destination=null;
  const roadAt=(x,z)=>{
   const height=s.roadY||0,net=projectNetwork(x,z,height,route?.network?route.id:'');
   // Local exit templates may share the same running-lane pavement too.
   // Do not undo the graph's lane ownership by comparing their centre-lines.
   if(net?.runningLane)return net;
   let best=net,score=net?net.distance+Math.abs(net.y-height)*5:Infinity;
   const indices=lockedJunction?[lockedJunction]:junctions.slots.map(p=>p.index);
   for(const index of indices){const p=junctions.project(index,x,z,height,route?.network?'':route?.id);if(p){const rank=p.distance+Math.abs(p.y-height)*5-(lockedJunction===index?.2:0);if(rank<score){best=p;score=rank;}}}
   return best;
  };
  graphTraffic.step(s,dt);
  stepCar(s,input,dt,[],{maxSpeed:Infinity,scene,mode,spatialStreaming:true,physicsKey:physicsKey(),traffic});
  destination=roadAt(s.x,s.z);
  if(s.collisions>before){impact=1;contacts++;challengeContact(challenge);}
  const dimensions=vehicleSpec(s.vehicle);for(const pass of passTracker.step({...s,width:dimensions.width,length:dimensions.length},traffic)){if(safePass(challenge,pass.points)){nearMisses++;toast(`安全超车 · 车身间隙 ${pass.gap.toFixed(2)} m · 基础 +${pass.points}`);}}
  if(destination){if(destination.network&&physicalLocalById(destination.id))localGraph=localComponentById(destination.id);s.roadGrade=destination.grade??Math.max(-.25,Math.min(.25,(destination.y-(s.roadY||0))/Math.max(.1,Math.hypot(s.x-prev.x,s.z-prev.z))));s.roadY=destination.y;route=destination;if(destination.network){mode=physicalLocalById(destination.id)?'local':MOTORWAYS.includes(destination.id)?'highway':'ramp';lockedJunction=null;}else{lockedJunction=destination.index;mode='ramp';}}
  const moved=Math.hypot(s.x-prev.x,s.z-prev.z);progress+=moved;trip+=moved;challengeProgress+=moved*Math.sign(s.speed);stepChallenge(challenge,challengeProgress,dt);
  // Scene streaming happens on the connecting road. Each district keeps its
  // own pose; chassis position, velocity and orientation are untouched.
  if(route?.network&&route.id.startsWith('archive:')){
   if(Math.hypot(s.x-44,s.z+19)<260)loadTown({x:0,z:0,y:0,angle:0,index:null});
  }else if(mode==='ramp'&&lockedJunction){const pose=junctions.town(lockedJunction),end=junctions.finish(lockedJunction);if(Math.hypot(s.x-end.x,s.z-end.z)<260)loadTown(pose);}
  if(mode==='local'&&localGraph){for(const port of localGraph.ports){const distance=Math.hypot(s.x-port.point.x,s.z-port.point.z);if(distance<260)loadTown(port.pose);if(distance<12&&(s.vx*Math.sin(port.heading)+s.vz*Math.cos(port.heading))<-.1){mode='city';lockedJunction=port.pose.index;route=null;loadTown(port.pose);toast('已沿地方公路进入'+port.region.name);break;}}}
  const nearbyTown=junctions.slots.map(slot=>slot.data.town).find(p=>Math.hypot(s.x-p.x,s.z-p.z)<620);if(nearbyTown&&mode!=='local'&&!route?.id?.startsWith('archive:'))loadTown(nearbyTown);
  const townPoint=townLocal(s);if((s.vx*Math.cos(town.angle)-s.vz*Math.sin(town.angle))<-.1&&townPoint.x<43&&townPoint.x>35&&Math.abs(townPoint.z+19)<4.3&&Math.abs((s.roadY||0)-town.y)<1.5){mode='city';exits++;challenge.active=false;route=null;toast('已沿立交驶入'+regionForIndex(town.index).name);}
  if(mode==='highway'&&route?.network&&MOTORWAYS.includes(route.id)){
  const id=route?.network&&MOTORWAYS.includes(route.id)?route.id:monitorRoad,spec=vehicleSpec(s.vehicle),local=projectMain(id,s.x,s.z,s.roadY||0),relativeHeading=s.heading-local.heading+Math.PI/2,bodyOccupancy=vehicleBodies(s).map(b=>{const q=projectMain(id,b.x,b.z,s.roadY||0);return{x:q.s+NETWORK_CENTRE.x,z:q.lane,width:b.width,length:b.length,heading:b.heading-q.heading+Math.PI/2};});const events=stepMonitor(monitor,{...s,roadId:id,unbounded:true,laneCenters:laneOffsets(id),speed:Math.sign(s.speed)*(s.groundSpeed??Math.abs(s.speed)),x:local.s+NETWORK_CENTRE.x,z:local.lane,heading:relativeHeading,width:spec.width,length:spec.length,bodyOccupancy,signalSide:input.signalSide,monitorAt:i=>id==='A+'&&monitorAt(i).x<600?{...monitorAt(i),x:-Infinity}:monitorAt(i)},traffic.filter(t=>t.roadId===id).map(t=>({...t,direction:1,x:t.s+NETWORK_CENTRE.x,z:(t.v.z-19)*LANE_SCALE,bodyOccupancy:trafficBodies(t).map(b=>{const q=projectMain(id,b.x,b.z,b.y??s.roadY??0);return{x:q.s+NETWORK_CENTRE.x,z:q.lane,width:b.width,length:b.length,heading:b.heading-q.heading+Math.PI/2};})})),dt,mode==='highway'&&route?.id===id&&local.lane>=roadSection(id).inner&&local.lane<=roadSection(id).outer);
  if(events.length)toast(events.map(e=>`${e.label} ${e.points>0?'+':''}${e.points}`).join(' · '));
  }else stepMonitor(monitor,{},[],dt,false);
  stream(s.x,s.z);
 }
 let navCache={x:Infinity,z:Infinity,key:'',data:{},navigation:null};
 function navigation(s){
  const key=[mode,route?.id,networkRevision(),townVersion,lockedJunction].join('|');
  if(Math.hypot(s.x-navCache.x,s.z-navCache.z)<.5&&navCache.key===key)return navCache.data;
  const index=lockedJunction??town.index,localRoute=index===null?null:CONNECTORS.find(p=>p.local&&p.junctionId===`town:${index}`),nav=routeNavigation({state:s,mode,route,town,localRoute});
  navCache={x:s.x,z:s.z,key,data:navigationStats(nav),navigation:nav};return navCache.data;
 }
 function mapContext(s){navigation(s);return{mode,route,town,revision:networkRevision(),navigation:navCache.navigation,physicalRoads:LOCAL_ROAD_SURFACES,knownTowns:[{x:0,z:0,y:0,angle:0,index:null},...junctions.slots.map(p=>({...p.data.town,localConnected:LOCAL_COMPONENTS.some(g=>g.regionIndices.includes(p.index)),type:p.type}))],localRoads:junctions.slots.flatMap(p=>(p.data?.renderRoads||p.data?.roads||[]).map(r=>({...r,townIndex:p.index,townType:p.type})))};}

 function animate(s,dt,clock,bouncing,motion){
  buildQueue.pump(s);
  impact=Math.max(0,impact-dt*3);
  trafficClock+=dt;
  for(const t of traffic){
   const delay=(t.id%7)*.032+Math.floor(t.id/7)*.014;
   const {compression:c,rebound:r}=bouncing&&motion&&clock>=delay?sampleYarisBounce(clock-delay,YARIS_PLAY_SPEED):{compression:0,rebound:0};
   t.node.visible=Math.hypot(t.x-s.x,t.z-s.z)<650;const pose=t.physical||t;t.node.position.set(pose.x,(pose.y||0)+.2,pose.z);t.node.rotation.order='YXZ';t.node.rotation.set(-Math.atan(t.grade||0),pose.heading??0,0);t.visual.scale.set(1+c*.11,1-c*.30+r*.12,1+c*.10);t.visual.position.y=r*.065;t.sprung.position.y=0;t.sprung.rotation.x=c*.035-r*.045;
   if(t.trailerNode){const q=pose.trailer||t.trailerPose;t.trailerNode.visible=t.node.visible&&!!q;if(q){t.trailerNode.position.set(q.x,(q.y||0)+.2,q.z);t.trailerNode.rotation.order='YXZ';t.trailerNode.rotation.set(-Math.atan(q.grade??t.grade??0),q.heading,0);t.trailerVisual.scale.copy(t.visual.scale);t.trailerVisual.position.y=t.visual.position.y;}}
   for(const [side,m] of t.lamps)m.emissiveIntensity=t.signal===side&&trafficClock%.8<.4?2.5:0;
  }
  for(const p of monitorPool){p.node.visible=p.warning.visible=p.roadId===route?.id&&mode==='highway';}
  root.visible=true;networkWorld.root.visible=true;
  const localSurface=physicalLocalById(route?.id),localPoint=localSurface?.points.reduce((a,p)=>Math.abs(p.s-(route?.s||0))<Math.abs(a.s-(route?.s||0))?p:a,localSurface.points[0]);const localIndex=lockedJunction??connectorById(route?.id)?.localIndex??town.index??junctions.slots[0]?.index??1;
  return {...navigation(s),tollStations:tollWorld.count,tollLanes:JSON.stringify([...tollWorld.stations.values()].flatMap(s=>s.lanes.map(l=>({...l.controller.state})))),roadBuildPending:buildQueue.size,localRoadPlanning:localLoader.pending,roadBuildMaxSlice:buildQueue.stats.maxSliceMs.toFixed(2),roadBuildForced:buildQueue.stats.forcedJobs,monitorScore:monitor.total,monitorEvents:JSON.stringify(monitor.events.slice(-4)),monitorSettled:monitor.settled.size,monitorPool:monitorPool.length,monitorPositions:JSON.stringify(monitorPool.filter(p=>p.node.visible).map(p=>({...monitorAt(p.index),roadId:p.roadId}))),trafficChanges:traffic.reduce((n,t)=>n+t.changes,0),trafficState:JSON.stringify(traffic.map(t=>({id:t.id,type:t.type,width:t.width,length:t.length,roadId:t.roadId,s:+t.s.toFixed(2),y:+(t.y||0).toFixed(2),heading:+t.heading.toFixed(3),x:+t.x.toFixed(2),z:+t.z.toFixed(2),speed:+t.velocity.toFixed(2),direction:t.direction,signal:t.signal,change:t.change?{from:t.change.from,to:t.change.to,time:+t.change.time.toFixed(2)}:null,bounce:+t.visual.scale.y.toFixed(4)}))),highwayMode:mode,junctionSelectable:String(mode==='city'&&town.index===null),roadY:(s.roadY||0).toFixed(3),highwayRoute:route?.id||'main',highwayRouteS:(route?.s||0).toFixed(1),highwayRouteLength:(route?.total||0).toFixed(1),highwayJunction:lockedJunction||0,highwayJunctionType:junctions.typeAt(localIndex),localRoadType:localPoint?.roadType||'',localRoadSlices:localWorld.stats.resident,highwayJunctionName:localSurface?'地方公路 · '+(localPoint?.roadType==='elevated'?'高架段':localPoint?.roadType==='rural'?'乡村段':'市政段'):route?.network?(MOTORWAYS.includes(route.id)?MOTORWAY_NAMES[roadFamily(route.id)]:connectorById(route.id).service?connectorById(route.id).serviceName:`${JUNCTIONS.find(j=>j.id===connectorById(route.id).junctionId)?.name||'互通'} · ${MOTORWAY_NAMES[roadFamily(connectorById(route.id).to)]}`):INTERCHANGE_NAMES[junctions.typeAt(localIndex)],townLoaded:town.index??'origin',townRegion:regionForIndex(town.index).id,townName:regionForIndex(town.index).name,townX:town.x.toFixed(3),townZ:town.z.toFixed(3),highwayJunctionPool:junctions.slots.length,highwayProgress:progress.toFixed(1),highwayTrip:trip.toFixed(1),highwayNextExit:navigation(s).nextExitDistance,highwayLanes:localSurface?2:route?.network?roadSection(MOTORWAYS.includes(route.id)?route.id:connectorById(route.id).to).lanes*2:0,highwayRoadNumber:localSurface?'LOCAL':route?.network?MOTORWAY_DEFS[roadFamily(MOTORWAYS.includes(route.id)?route.id:connectorById(route.id).to)].number:(MOTORWAY_DEFS[localSite(localIndex)?.host||'A']?.number||'S01'),highwayChunks:networkWorld.chunkCount,highwayTerrain:networkWorld.terrainCount,networkTransitions:graphTraffic.transitions,networkMerges:graphTraffic.merges,networkRoad:route?.network?route.id:'',networkRecycled:graphTraffic.recycles,highwayRecycled:recycled+networkWorld.recycled,highwayTraffic:traffic.length,highwayContacts:contacts,highwayNearMisses:nearMisses,highwayEntries:entries,highwayExits:exits,trafficBounceY:(traffic[0]?.visual.scale.y??1).toFixed(4),trafficLift:(traffic[0]?.visual.position.y??0).toFixed(4),trafficSuspension:(traffic[0]?.sprung.position.y??0).toFixed(4),challengeActive:String(challenge.active),challengeDistance:Math.min(1000,Math.max(0,challenge.furthest-challenge.startX)).toFixed(0),challengeTime:(challenge.elapsed+challenge.penalty).toFixed(1),challengePenalty:challenge.penalty,challengeFinished:String(challenge.finished),overtakeScore:challenge.score,overtakeCombo:challenge.combo,highwayChunkMin:Math.min(...chunks.map(c=>c.index)),highwayChunkMax:Math.max(...chunks.map(c=>c.index)),highwayImpact:impact.toFixed(2),highwayFade:mode==='returning'?Math.min(1,exitTimer/.3,(.85-exitTimer)/.28):0};
 }
 return {async preparePhysics(s,yieldTask=()=>Promise.resolve()){while(buildQueue.size){buildQueue.pump(s,10);await yieldTask();}deferBuild=false;physicsState=s;const options={scene,mode,spatialStreaming:true,physicsKey:physicsKey(),traffic},c=contextFor(s)||createRigidContext(s,options);let at=performance.now();for(const mesh of c.prepareScene(scene,options.physicsKey,mode)){if(performance.now()-at>4){await yieldTask();at=performance.now();}}c.syncTraffic(traffic,1/120);tollWorld.step(s,traffic,0,c);},step,animate,reset,mapContext,startInRegion(s,index){if(!localSite(index)){reset();respawnCar(s);toast('该位置保留为道路与河流安全区，已返回原街区');return false;}const d=junctions.dataAt(index),p=d.town,spawn=regionLayout(index).spawn,q=regionWorldPoint(spawn,p);loadTown(p);Object.assign(s,{x:q.x,z:q.z,roadY:q.y,heading:spawn.heading+p.angle,speed:0,vx:0,vz:0});mode='city';lockedJunction=index;route=null;seedTraffic(s.x);stream(s.x,s.z);},startInService(s,{recovery=false}={}){if(physicsState&&(!recovery||contextFor(s)))return false;const {path,pose}=jiangwanStartPose();Object.assign(s,pose);mode='ramp';route={...projectNetwork(s.x,s.z,s.roadY,path.id),network:true};seedTraffic(s.x);stream(s.x,s.z);return true;},startOnRoad(s,id='A+',station=-1550,lane=0){const p=mainPoint(id,station,lane);Object.assign(s,{x:p.x,z:p.z,roadY:p.y,heading:p.heading,speed:0,vx:0,vz:0});mode='highway';route={...projectMain(id,p.x,p.z,p.y),network:true};seedTraffic(s.x);stream(s.x,s.z);},get buildStats(){return buildQueue.stats;},get traffic(){return traffic;},get route(){return route;},cameraRoadOwners(){if(!route?.id)return[];const owners=new Set([route.id]),p=connectorById(route.id);if(p?.physicalLocal)return [...owners];if(p){if(route.s<60)owners.add(p.from);if(p.length-route.s<60)owners.add(p.to);for(const e of p.physicalSegments||[])if(route.s>=e.startS-55&&route.s<=e.endS+55)owners.add(e.edgeId);}else for(const p of CONNECTORS){if(p.from===route.id&&Math.abs(p.startS-route.s)<55)owners.add(p.id);if(p.to===route.id&&Math.abs(p.joinS-route.s)<55)owners.add(p.id);}return [...owners];},get localInterchanges(){return junctions;},get localGraph(){return localGraph;},get localWorld(){return localWorld;},get tollWorld(){return tollWorld;},recoverLocal(){challenge.active=false;impact=0;passTracker.invalidate();},setJunction(type){if(mode==='city'&&town.index===null){junctions.setFirstType(type);stream(40);return true;}return false;},startChallenge(x){if(mode!=='highway')return false;startChallenge(challenge,challengeProgress);return true;},get mode(){return mode;}};
}
