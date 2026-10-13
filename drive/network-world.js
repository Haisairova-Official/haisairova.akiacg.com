import {tollEdgePoints,tollMixedMarking} from './toll-layout.mjs?rev=world21d';
import {createYSurfaceBounds} from './junction-surface.mjs?rev=world21d';
import{regionPadDistance,regionPadBounds}from'./region-terrain.mjs?rev=world21d';
import{sceneryPlan,sceneryResolution,stitchSceneryTileEdges,scenicMeshHeight,scenicHeight,scenicFieldColor,scenicVegetationAllowed}from'./scenic-plan.mjs?rev=world21d';
import{createScenicMaterials,buildScenicMeshes}from'./scenic-mesh.js?rev=world21d';
import{basinTerrainHeight,basinVegetationAllowed}from'./crabbay/terrain.mjs?rev=world21d';
import {buildServiceFacilities} from './service-scene.js?rev=world21d';
import {regionLayout} from './region-roads.mjs?rev=world21d';
import {roadBuildSlices} from './road-build-queue.mjs?rev=world21d';
import {batchStaticVisualsSteps} from './mesh-batching.js?rev=world21d';
import {connectionFeatures} from './road-connections.mjs?rev=world21d';
import {createRoadStructureFactory} from './road-structures.js?rev=world21d';
import {localExitX,localExitIndex} from './interchange-logic.mjs?rev=world21d';
import {createMotorwaySigns} from './road-signs.js?rev=world21d';
import {roadsideFootprintClear,physicalNetworkRoads,NETWORK_CENTRE,MOTORWAYS,RENDER_MOTORWAYS,ensureNetwork,networkRevision,roadFamily,roadSign,roadSection,pathSection,MOTORWAY_DEFS,JUNCTIONS,junctionStation,projectMain,MAIN_WIDTH,MOTORWAY_NAMES,CONNECTORS,mainPoint,mainHeight,terrainHeight,riverAX,riverDistance,networkInternalBoundary,earthworkClear,supportClear,vegetationSite,seededNoise} from './road-network.mjs?rev=world21d';
// Pooled geometry uses the same 3D centreline functions as collision and traffic.
export function createNetworkWorld(T,scene,{sign,initial={x:-14,z:19},buildQueue=null,prepareSlice=null}){
 // Select the actual starting topology before allocating its furniture/pools.
 // Building the module-default quadrant first used to throw half of it away.
 ensureNetwork(initial.x,initial.z);
 const root=new T.Group();scene.add(root);let surfaceRoot=root,surfaceOwner='';const asphalt=new T.MeshStandardMaterial({color:0x526a75,roughness:.95,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}),white=new T.MeshStandardMaterial({color:0xf1f1dc,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8}),yellow=new T.MeshStandardMaterial({color:0xdacb89,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8}),railMat=new T.MeshStandardMaterial({color:0xb9c8c7,side:T.DoubleSide}),bridgeMat=new T.MeshStandardMaterial({color:0x809997,side:T.DoubleSide}),soilMat=new T.MeshStandardMaterial({vertexColors:true,flatShading:true}),bankMat=new T.MeshStandardMaterial({color:0xa0b695,roughness:1,side:T.DoubleSide}),waterMat=new T.MeshStandardMaterial({color:0x568d9c,roughness:.26,metalness:.12});
 const structure=createRoadStructureFactory(T,{metal:railMat,concrete:bridgeMat}),weight=p=>p.bridge??Math.max(0,Math.min(1,(p.y-terrainHeight(p.x,p.z)-2.3)/1.5)),structuralPoints=pts=>pts.map(p=>({...p,bridge:weight(p)}));
 const ribbon=(points,width,offset=0,lift=.22,vertical=0,mask=()=>true,splitDash=false)=>{
  if(splitDash){const expanded=[];for(let i=0;i<points.length-1;i++){const p=points[i],q=points[i+1],cuts=[p.s];for(let k=Math.floor(p.s/15);k<=Math.ceil(q.s/15);k++)for(const d of [k*15,k*15+6])if(d>p.s+1e-7&&d<q.s-1e-7)cuts.push(d);cuts.sort((a,b)=>a-b);for(const s of cuts){const t=(s-p.s)/(q.s-p.s);expanded.push({...p,x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t,z:p.z+(q.z-p.z)*t,s,heading:p.heading+(q.heading-p.heading)*t});}}expanded.push(points.at(-1));points=expanded;}
  const a=[];for(let i=0;i<points.length-1;i++){const p=points[i],q=points[i+1],dx=q.x-p.x,dz=q.z-p.z,len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len;
   const v=(r,o,y)=>{const j=r===p?i:i+1,a=points[Math.max(0,j-1)],b=points[Math.min(points.length-1,j+1)],h=r.heading??Math.atan2(b.x-a.x,b.z-a.z);return[r.x-Math.cos(h)*o,r.y+y,r.z+Math.sin(h)*o];};let v0,v1,v2,v3;
   if(vertical){v0=v(p,offset,lift);v1=v(p,offset,lift+vertical);v2=v(q,offset,lift);v3=v(q,offset,lift+vertical);}
   else{const pb=typeof width==='function'?width(p,i):{inner:offset-width/2,outer:offset+width/2},qb=typeof width==='function'?width(q,i+1):{inner:offset-width/2,outer:offset+width/2};v0=v(p,pb.inner,lift+(pb.innerY||0));v1=v(p,pb.outer,lift+(pb.outerY||0));v2=v(q,qb.inner,lift+(qb.innerY||0));v3=v(q,qb.outer,lift+(qb.outerY||0));}
   if(!mask(splitDash?{...p,s:(p.s+q.s)/2}:p,i))v1=v2=v3=v0;a.push(...v0,...v1,...v2,...v1,...v3,...v2);
  }return new Float32Array(a);
 };
 function surface(points,width,material,offset=0,lift=.22,vertical=0,mask){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(ribbon(points,width,offset,lift,vertical,mask),3));g.computeVertexNormals();g.computeBoundingBox();const m=new T.Mesh(g,material);if(material===asphalt||material===bankMat)m.userData.driveCollider='ground';else if(material===railMat)m.userData.driveCollider='wall';m.userData.cameraOccluderRole=material===asphalt?'pavement':material===white||material===yellow?'marking':undefined;m.userData.cameraRoadId=surfaceOwner;m.receiveShadow=true;surfaceRoot.add(m);return m;}
 // Low roadbeds meet graded terrain with drivable cut/fill slopes. Raised
 // bridge decks and rivers retain their open space and original ground below.
 const bankVertices=(points,owner,edge,side)=>{
  const out=[],heights=new Map(),height=(x,z)=>{const key=x+","+z;if(!heights.has(key))heights.set(key,terrainHeight(x,z));return heights.get(key);};for(let i=0;i<points.length-1;i++){const p=points[i],q=points[i+1];
   const v=(r,offset,y)=>{const h=r.heading??Math.atan2(q.x-p.x,q.z-p.z);return[r.x-Math.cos(h)*offset,y,r.z+Math.sin(h)*offset];};
   const a=v(p,edge,p.y+.12),b=v(q,edge,q.y+.12),c=v(p,edge+side*7,0),d=v(q,edge+side*7,0);
   const active=weight(p)<.8&&weight(q)<.8&&riverDistance(p.x,p.z)>66&&riverDistance(q.x,q.z)>66&&[0,.5,1].every(t=>[0,.5,1].every(u=>earthworkClear(owner,(a[0]*(1-u)+c[0]*u)*(1-t)+(b[0]*(1-u)+d[0]*u)*t,(a[2]*(1-u)+c[2]*u)*(1-t)+(b[2]*(1-u)+d[2]*u)*t)));
   if(active){c[1]=height(c[0],c[2]);d[1]=height(d[0],d[2]);}
   // A closed earth prism, including its start/end, never exposes a paper slope.
   const e=[a[0],active?Math.min(height(a[0],a[2]),a[1]-.02):a[1],a[2]],f=[b[0],active?Math.min(height(b[0],b[2]),b[1]-.02):b[1],b[2]];
   for(const triangle of [[a,c,b],[b,c,d],[e,f,c],[f,d,c],[a,b,e],[b,f,e],[a,e,c],[b,d,f]]){const [u,v,w]=active?triangle:[a,a,a];out.push(...u,...(side<0?w:v),...(side<0?v:w));}
  }return new Float32Array(out);
 };
 const bank=(points,owner,edge,side,defer=false)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(defer?new Float32Array((points.length-1)*72):bankVertices(points,owner,edge,side),3));g.computeVertexNormals();const m=new T.Mesh(g,bankMat);m.userData.driveCollider='ground';m.userData.structureType='earthwork-bank';m.userData.earthworkSide=side;m.receiveShadow=true;surfaceRoot.add(m);return m;};
 const chunks=[];const empty=Array.from({length:17},(_,i)=>({x:i*5,z:0,y:0,s:i*5}));
 const cubeGeo=new T.BoxGeometry(1,1,1);
 const outerRailAllowed=(id,s)=>!CONNECTORS.some(c=>c.auxiliary?.some(a=>a.roadId===id&&s>a.startS-3&&s<a.endS+3)||c.from===id&&s>c.startS-3&&s<(c.departureEndS??c.startS+200)+3||c.to===id&&s>(c.mergeStartS??c.joinS-200)-3&&s<c.joinS+3);
 for(const id of RENDER_MOTORWAYS)for(let k=0;k<10;k++){surfaceOwner=id;
  const members=[surface(empty,MAIN_WIDTH,asphalt,1),surface(empty,.17,yellow,-6.3,.245),surface(empty,.20,white,5.7,.245),surface(empty,.14,white,-1.875,.245),surface(empty,.14,white,1.875,.245),surface(empty,.14,white,5.625,.245),surface(empty,.75,bankMat,0,.12),surface(empty,1,bankMat,0,.12)];
  const structures=new T.Group();root.add(structures);const banks=[bank(empty,id,-6.625,-1,true),bank(empty,id,8.625,1,true)];chunks.push({id,index:null,members,structures,banks});
 }
 const updateChunk=(c,index)=>{
  const section=roadSection(c.id),half=section.half;const permitted=p=>true;const points=Array.from({length:17},(_,i)=>mainPoint(c.id,index*80+i*5));
  const specs=[[section.width,section.centre,.22], [.17,-half-.15,.245],[.20,half+.075,.245],[.14,-half+3.75,.245],[.14,-half+7.5,.245],[.14,-half+11.25,.245],[.75,section.outer+.375,.12],[1,section.inner-.5,.12]];
  c.structures.userData.cameraRoadId=c.id;c.members.forEach((m,i)=>{m.userData.cameraRoadId=c.id;const[w,o,l]=specs[i],dash=i===3?1:i===4?2:i===5?3:0,filter=dash?p=>dash<section.lanes&&((p.s%15)+15)%15<6:i===2?p=>outerRailAllowed(c.id,p.s)||((p.s%15)+15)%15<6:()=>true,a=ribbon(points,w,o,l,0,filter,i>=2&&i<=5);if(m.geometry.attributes.position.array.length!==a.length){const old=m.geometry;m.geometry=new T.BufferGeometry();m.geometry.setAttribute('position',new T.BufferAttribute(a,3));old.dispose();}else m.geometry.attributes.position.array.set(a);m.geometry.attributes.position.needsUpdate=true;m.geometry.computeVertexNormals();m.geometry.computeBoundingSphere();m.geometry.computeBoundingBox();});
  for(const m of [...c.structures.children]){m.geometry?.dispose();c.structures.remove(m);}const sp=structuralPoints(points);
  for(const side of [-1,1]){const edge=side<0?section.inner-.28:section.outer+.28,mask=p=>!networkInternalBoundary(c.id,p.x-Math.cos(p.heading)*edge,p.z+Math.sin(p.heading)*edge,p.y);c.structures.add(...structure.barriers(sp,edge,{mask,bridgeWeight:weight}));}
  c.structures.add(structure.deck(sp,section.width,section.centre),...structure.supports(sp,section.width,{groundHeight:terrainHeight,clear:supportClear,bridgeWeight:weight}));
  c.banks.forEach((m,i)=>{const a=bankVertices(sp,c.id,i?section.outer+.75:section.inner,i?1:-1);m.geometry.attributes.position.array.set(a);m.geometry.attributes.position.needsUpdate=true;m.geometry.computeVertexNormals();m.geometry.computeBoundingSphere();m.geometry.computeBoundingBox();});
  c.index=index;c.prewarmRevision=null;
 };
 // All eight connectors are continuous, fixed meshes. Their start/end lanes
 // exactly match directed mainline coordinates; no road-side transport trigger.
 const connectorGroups=new Map();let physicsRevision=0;let motorwaySigns=null,connectionGroup=null;
 const cancelWarm=c=>{if(c.warm){buildQueue?.cancel(c.warm.key);c.warm=null;}};
 const warmChunk=(c,id,index)=>{const key=`warm-main:${id}:${index}`,token={key,id,index};c.warm=token;const p=mainPoint(id,index*80+40);function* task(){if(c.warm!==token||c.id!==id)return;if(c.index!==null)recycled++;updateChunk(c,index);c.prewarmRevision=networkRevision();physicsRevision++;c.warm=null;yield 'mainline-prewarm';}buildQueue.add(key,task(),{minX:p.x-80,maxX:p.x+80,minZ:p.z-80,maxZ:p.z+80},()=>{},{forceDistance:0});};
 const disposeGroup=g=>{const geometries=new Set(),materials=new Set(g.userData.serviceMaterials?.values()||[]),textures=new Set();g.traverse(m=>{if(m.geometry&&m.geometry!==cubeGeo)geometries.add(m.geometry);const original=m.userData.cameraFadeOriginalMaterial||m.material;for(const material of[original].flat().filter(Boolean))if(m.userData.ownedSignMaterial)materials.add(material);});for(const material of materials)if(material.map)textures.add(material.map);root.remove(g);for(const g of geometries)g.dispose();for(const t of textures)t.dispose();for(const m of materials)m.dispose();};
 let furnitureKey='',furnitureRevision=-1;
 const boundsDistance=(b,p)=>Math.hypot(Math.max(b.minX-p.x,0,p.x-b.maxX),Math.max(b.minZ-p.z,0,p.z-b.maxZ));
 function* buildConnector(path,group){
  const peers=CONNECTORS.filter(p=>p.junctionId===path.junctionId&&!p.city),commonOwner=members=>[...members].sort((a,b)=>(a.turn==='right'?0:1)-(b.turn==='right'?0:1)||a.id.localeCompare(b.id))[0]?.id;
  const ownsStart=path.city||commonOwner(peers.filter(p=>p.from===path.from))===path.id,ownsEnd=path.city||commonOwner(peers.filter(p=>p.to===path.to))===path.id;
  const startPrimary=!ownsStart?peers.find(p=>p.id===commonOwner(peers.filter(p=>p.from===path.from))):null,endPrimary=!ownsEnd?peers.find(p=>p.id===commonOwner(peers.filter(p=>p.to===path.to))):null;
  const startBounds=startPrimary?createYSurfaceBounds(path,startPrimary,{heightTolerance:.10}):null,endBounds=endPrimary?createYSurfaceBounds(path,endPrimary,{heightTolerance:.10}):null;
  const allPoints=(path.renderPoints||path.points).filter(p=>(ownsStart||p.s>=path.departLength-.001)&&(ownsEnd||p.s<=path.accelerationStartS+.001)),section=pathSection(path),sameSharedLane=(p,other)=>other.junctionId===path.junctionId&&!path.city&&((other.from===path.from&&p.s<=path.departLength+.01)||(other.to===path.to&&p.s>=path.accelerationStartS-.01));
  for(const pts of roadBuildSlices(allPoints)){surfaceOwner=path.id;const chunk=new T.Group();chunk.userData.cameraRoadId=path.id;chunk.visible=false;group.add(chunk);const sp=structuralPoints(pts),addSurface=(...args)=>{surfaceRoot=chunk;return surface(...args);},addBank=(...args)=>{surfaceRoot=chunk;return bank(...args);};
const pavementMemo=new WeakMap(),pavementBounds=(p,i)=>{if(pavementMemo.has(p))return pavementMemo.get(p);const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],h=p.heading??Math.atan2(b.x-a.x,b.z-a.z);const dynamicSection=pathSection(path,p.s);let inner=dynamicSection.inner;for(const id of [path.from,path.to]){const m=projectMain(id,p.x,p.z,p.y);if(Math.abs(m.y-p.y)>.045)continue;const edge=mainPoint(id,m.s,roadSection(id).outer),along=(edge.x-p.x)*Math.sin(h)+(edge.z-p.z)*Math.cos(h),cross=(edge.x-p.x)*-Math.cos(h)+(edge.z-p.z)*Math.sin(h),parallel=Math.cos(h-m.heading);if(parallel>.94&&Math.abs(along)<2&&m.lane>0)inner=Math.max(inner,Math.min(section.outer,cross));}let outer=dynamicSection.outer,outerY=0;for(const [fn,active]of[[startBounds,p.s<path.departLength+180],[endBounds,p.s>path.accelerationStartS-180]])if(fn&&active){const edge=fn(p,i);if(edge.outer<outer){outer=edge.outer;outerY=edge.outerY||0;}}const bounds={inner,outer:Math.max(inner,outer),outerY,innerY:outer<=inner+1e-8?outerY:0};pavementMemo.set(p,bounds);return bounds;};addSurface(pts,pavementBounds,asphalt,section.centre);yield;if(path.tollSections?.length)addSurface(pts,p=>tollMixedMarking(path,p),white,0,.247);for(const side of [-1,1]){addBank(sp,path.id,side<0?section.inner:section.outer,side);yield;}
  chunk.add(structure.deck(sp,pavementBounds,section.centre));yield;chunk.add(...structure.supports(sp,path.width,{groundHeight:terrainHeight,clear:supportClear,bridgeWeight:weight}));yield;
  for(const side of [-1,1]){const lineEdge=side*(path.laneWidth?path.laneWidth/2:path.width/2-.22);addSurface(pts,.14,white,lineEdge,.245,0,(p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],h=p.heading??Math.atan2(b.x-a.x,b.z-a.z);return !networkInternalBoundary(path.id,p.x-Math.cos(h)*lineEdge,p.z+Math.sin(h)*lineEdge,p.y,other=>sameSharedLane(p,other));});const edgeAt=p=>(side<0?pathSection(path,p.s).inner:pathSection(path,p.s).outer)+side*.28,mask=(p,i)=>{if(path.noBarrier?.some(r=>r.side===side&&p.s>=r.startS&&p.s<=r.endS))return false;const a=sp[Math.max(0,i-1)],b=sp[Math.min(sp.length-1,i+1)],h=p.heading??Math.atan2(b.x-a.x,b.z-a.z),edge=edgeAt(p),x=p.x-Math.cos(h)*edge,z=p.z+Math.sin(h)*edge;return !(path.junctionId==='archive'&&p.x>-44&&p.x<48&&Math.abs(p.z)<42&&Math.abs(p.y)<1.5)&&!networkInternalBoundary(path.id,x,z,p.y,other=>sameSharedLane(p,other));};chunk.add(...structure.barriers(tollEdgePoints(path,sp,side),0,{mask:(p,i)=>mask(sp[i]||p,i),bridgeWeight:weight}));yield;}


   if(prepareSlice)yield*prepareSlice(chunk);chunk.visible=true;physicsRevision++;yield;
  }if(path.service)yield*buildServiceFacilities(T,path,group,{sign,prepareSlice});yield*batchStaticVisualsSteps(T,group);physicsRevision++;surfaceRoot=root;
 }
 function syncRoadFurniture(position=initial,keep=[]){
  const selected=CONNECTORS.filter(p=>!p.local&&!p.renderSuppressed&&(keep.includes(p.id)||boundsDistance(p.bounds,position)<(connectorGroups.has(p.id)?2200:1800))),required=new Set(selected.map(p=>p.id));
  // An occupied secondary route still needs the actual owner of each common
  // departure/arrival deck even when that owner's bounds are outside the LOD.
  for(const path of selected){if(path.city)continue;for(const role of['from','to']){const owner=CONNECTORS.filter(p=>!p.city&&!p.local&&!p.renderSuppressed&&p.junctionId===path.junctionId&&p[role]===path[role]).sort((a,b)=>(a.turn==='right'?0:1)-(b.turn==='right'?0:1)||a.id.localeCompare(b.id))[0];if(owner)required.add(owner.id);}}
  const paths=CONNECTORS.filter(p=>required.has(p.id)),key=paths.map(p=>p.id+':'+(p.geometryKey||'')).join('|');
  if(furnitureRevision!==networkRevision()){if(motorwaySigns)motorwaySigns.sync(position);else motorwaySigns=createMotorwaySigns(T,root,{position});furnitureRevision=networkRevision();physicsRevision++;}
  if(key===furnitureKey)return;furnitureKey=key;
  const ids=new Map(paths.map(p=>[p.id,p.geometryKey||'']));for(const [id,g]of connectorGroups)if(!ids.has(id)||g.userData.geometryKey!==ids.get(id)){buildQueue?.cancel(id);disposeGroup(g);connectorGroups.delete(id);physicsRevision++;}
  for(const path of paths)if(!connectorGroups.has(path.id)){const group=new T.Group();group.userData.geometryKey=path.geometryKey||'';root.add(group);connectorGroups.set(path.id,group);const task=buildConnector(path,group);if(buildQueue)buildQueue.add(path.id,task,path.bounds);else for(const _ of task){} }
  if(connectionGroup)disposeGroup(connectionGroup);connectionGroup=new T.Group();root.add(connectionGroup);
  const markings=[],goreTop=[],goreBody=[],goreSoil=[],goreSoilBody=[];const gv=(p,y)=>[p.x,p.y+y,p.z],gt=(out,a,b,c)=>out.push(...a,...b,...c);for(const feature of connectionFeatures(paths)){
   for(let i=1;i<feature.bedRings.length;i++){const p=feature.bedRings[i-1],q=feature.bedRings[i],soil=p.soil||q.soil,top=soil?goreSoil:goreTop,body=soil?goreSoilBody:goreBody,pr=p.mid?[p.a,p.mid,p.b]:[p.a,p.b],qr=q.mid?[q.a,q.mid,q.b]:[q.a,q.b],base=Math.min(...pr.map(v=>v.y),...qr.map(v=>v.y))-1.58,low=v=>[v.x,base,v.z];
    for(let j=1;j<pr.length;j++){const a=gv(pr[j-1],.22),b=gv(pr[j],.22),c=gv(qr[j-1],.22),d=gv(qr[j],.22),aa=low(pr[j-1]),bb=low(pr[j]),cc=low(qr[j-1]),dd=low(qr[j]);gt(top,a,b,c);gt(top,b,d,c);gt(body,aa,cc,bb);gt(body,bb,cc,dd);for(const[u,v,w,z]of[...(j===1?[[a,c,aa,cc]]:[]),...(j===pr.length-1?[[b,bb,d,dd]]:[]),...(i===1?[[a,aa,b,bb]]:[]),...(i===feature.bedRings.length-1?[[c,d,cc,dd]]:[])]){gt(body,u,v,w);gt(body,v,z,w);}}
   }
   for(const triangle of feature.stripes)for(const p of triangle)markings.push(p.x,p.y+.255,p.z);
   const c=feature.cushion;if(c){const g=new T.Group();g.position.set(c.x,c.y+.22,c.z);g.rotation.y=c.heading;connectionGroup.add(g);const body=new T.Mesh(new T.BoxGeometry(c.width,c.height,c.length),railMat);body.position.y=c.height/2;body.userData.driveCollider='wall';body.userData.structureType='gore-cushion';body.userData.connectionId=feature.id;g.add(body);
    // High-contrast face stays inside the already checked physical envelope.
    const face=new T.Mesh(new T.PlaneGeometry(c.width*.94,c.height*.86),yellow);face.position.set(0,c.height/2,feature.kind==='departure'?-c.length/2-.006:c.length/2+.006);if(feature.kind==='departure')face.rotation.y=Math.PI;g.add(face);
    for(const side of [-1,1]){const stripe=new T.Mesh(new T.PlaneGeometry(.12,c.height*.95),bridgeMat);stripe.position.copy(face.position);stripe.position.x=side*.18;stripe.position.z+=feature.kind==='departure'?-.004:.004;stripe.rotation.copy(face.rotation);stripe.rotation.z=side*.35;g.add(stripe);}
   }
  }for(const[v,mat,kind]of[[goreTop,asphalt,'ground'],[goreBody,bridgeMat,'wall'],[goreSoil,bankMat,'ground'],[goreSoilBody,bankMat,'wall']]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();const m=new T.Mesh(g,mat);m.userData.driveCollider=kind;m.userData.structureType='gore-bridge-base';m.userData.cameraOccluderRole=kind==='wall'?'structure':undefined;m.receiveShadow=m.castShadow=true;connectionGroup.add(m);}const marked=new T.BufferGeometry();marked.setAttribute('position',new T.Float32BufferAttribute(markings,3));marked.computeVertexNormals();connectionGroup.add(new T.Mesh(marked,white));physicsRevision++;
 }
 syncRoadFurniture();
 const townPads=new Map([['origin',{x:0,z:0,y:0,angle:0,index:null}]]);let townTilesChanged=0;
 const terrainY=(x,z)=>{const h=terrainHeight(x,z);let result=h;for(const town of townPads.values()){const d=regionPadDistance(town,x,z),blend=Math.max(0,Math.min(1,d/35));if(!town.pad?.preserveRiver||riverDistance(x,z)>66)result=Math.min(result,(town.y-.5)*(1-blend)+h*blend);result=basinTerrainHeight(town,x,z,result);}return result;};
 const terrain=[];const size=320,steps=24,plantsPerTile=20,scenicMaterials=createScenicMaterials(T);
 const terrainStamp=(ix,iz)=>{const a={minX:ix*size-80,maxX:(ix+1)*size+80,minZ:iz*size-80,maxZ:(iz+1)*size+80};return physicalNetworkRoads().filter(p=>p.bounds.maxX>=a.minX&&p.bounds.minX<=a.maxX&&p.bounds.maxZ>=a.minZ&&p.bounds.minZ<=a.maxZ).map(p=>p.id+':'+(p.geometryKey||'')).sort().join('|')+'#'+[...townPads.values()].filter(p=>{const b=regionPadBounds(p);return b.maxX>=a.minX&&b.minX<=a.maxX&&b.maxZ>=a.minZ&&b.minZ<=a.maxZ;}).map(p=>[p.index??'origin',p.x,p.z,p.y,p.angle,JSON.stringify(p.pad||{})].join(':')).sort().join('|');};
 const trunks=new T.InstancedMesh(new T.CylinderGeometry(.22,.36,3,5),new T.MeshStandardMaterial({color:0x766e52}),25*plantsPerTile),leaves=new T.InstancedMesh(new T.IcosahedronGeometry(2.3,0),new T.MeshStandardMaterial({color:0x718b59,roughness:1}),25*plantsPerTile);trunks.userData.cameraOccluderRole=leaves.userData.cameraOccluderRole='tree';trunks.castShadow=leaves.castShadow=false;root.add(trunks,leaves);const plantPose=new T.Object3D();
 for(let i=0;i<25;i++){
  const g=new T.BufferGeometry(),positions=new Float32Array(steps*steps*18),colors=new Float32Array(positions.length);g.setAttribute('position',new T.BufferAttribute(positions,3));g.setAttribute('color',new T.BufferAttribute(colors,3));const mesh=new T.Mesh(g,soilMat);mesh.userData.driveCollider='ground';mesh.receiveShadow=true;root.add(mesh);terrain.push({mesh,key:'',index:i});
 }
 // Build recycled ground off-scene, one row at a time. Keep the previous
 // physical tile until its replacement has complete matching visual/collision
 // geometry; near-player/NPC safety forces only genuinely needed tile jobs.
 const effectiveSceneryPlan=(ix,iz)=>{const base=sceneryPlan(ix,iz);return{...base,houses:base.houses.filter(h=>roadsideFootprintClear(h.x,h.z,Math.hypot(h.width,h.depth)/2+8)&&[...townPads.values()].every(p=>regionPadDistance(p,h.x,h.z)>Math.hypot(h.width,h.depth)/2+8))};};
 const groundHeight=(x,z)=>scenicMeshHeight(effectiveSceneryPlan(Math.floor(x/320),Math.floor(z/320)),x,z,terrainY);
 function* buildTerrain(t,ix,iz,stamp){
  const plan=effectiveSceneryPlan(ix,iz),steps=sceneryResolution(plan);const verts=new Float32Array(steps*steps*18),cols=new Float32Array(verts.length),heights=new Float64Array((steps+1)*(steps+1)),color=new T.Color();
  let holder=null,published=false,preparing=false;
  try{
   for(let z=0;z<=steps;z++){for(let x=0;x<=steps;x++)heights[z*(steps+1)+x]=scenicHeight(plan,(ix+x/steps)*size,(iz+z/steps)*size,terrainY((ix+x/steps)*size,(iz+z/steps)*size));yield 'terrain-height-row';}
   stitchSceneryTileEdges(heights,steps);
   let at=0;for(let z=0;z<steps;z++){for(let x=0;x<steps;x++)for(const[dx,dz]of[[0,0],[0,1],[1,0],[1,0],[0,1],[1,1]]){const h=heights[(z+dz)*(steps+1)+x+dx];verts[at]=(ix+(x+dx)/steps)*size;verts[at+1]=h;verts[at+2]=(iz+(z+dz)/steps)*size;color.setHex(scenicFieldColor(plan,verts[at],verts[at+2])??(h>12?0x8fa793:h< -2?0x8ea9a1:0xa8c0a4));color.multiplyScalar(.92+Math.max(-.1,Math.min(.12,h*.004)));cols[at]=color.r;cols[at+1]=color.g;cols[at+2]=color.b;at+=3;}yield 'terrain-mesh-row';}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(verts,3));g.setAttribute('color',new T.BufferAttribute(cols,3));g.computeVertexNormals();g.computeBoundingSphere();const mesh=new T.Mesh(g,soilMat);mesh.userData.driveCollider='ground';mesh.userData.terrainTile=`${ix},${iz}`;mesh.receiveShadow=true;holder=new T.Group();holder.visible=false;holder.add(mesh);root.add(holder);yield 'terrain-geometry';
   for(const m of buildScenicMeshes(T,plan,verts,scenicMaterials))holder.add(m);yield 'terrain-scenery';
   const plants=[];for(let k=0;k<plantsPerTile;k++){const x=(ix+seededNoise(ix*37+k,iz,7127))*size,z=(iz+seededNoise(ix,iz*41+k,7129))*size,h=scenicHeight(plan,x,z,terrainY(x,z)),scale=scenicVegetationAllowed(plan,x,z)&&vegetationSite(x,z)&&[...townPads.values()].every(p=>regionPadDistance(p,x,z)>15&&basinVegetationAllowed(p,x,z))?(.75+seededNoise(ix+k,iz-k,7131)*.85)*(k%4===0?.38:1):0;plants.push({x,z,h,scale});if(k%5===4)yield 'terrain-plants';}
   if(prepareSlice){preparing=true;yield*prepareSlice(holder);}
   const old=t.mesh;old.parent?.remove(old);old.geometry.dispose();if(t.holder){t.holder.traverse(m=>m.geometry?.dispose());root.remove(t.holder);}t.plan=plan;t.mesh=mesh;t.holder=holder;holder.visible=true;t.key=`${ix},${iz}`;t.pathStamp=stamp;t.targetKey=null;t.targetStamp=null;published=true;physicsRevision++;
   for(let k=0;k<plants.length;k++){const{x,z,h,scale}=plants[k],id=t.index*plantsPerTile+k;plantPose.position.set(x,h+1.5*scale,z);plantPose.scale.setScalar(scale);plantPose.updateMatrix();trunks.setMatrixAt(id,plantPose.matrix);plantPose.position.y=h+4.1*scale;plantPose.scale.set(scale,scale*1.2,scale);plantPose.updateMatrix();leaves.setMatrixAt(id,plantPose.matrix);leaves.setColorAt(id,new T.Color(k%3===0?0x91a56e:k%3===1?0x63875e:0x809b66));}
   trunks.instanceMatrix.needsUpdate=leaves.instanceMatrix.needsUpdate=true;if(leaves.instanceColor)leaves.instanceColor.needsUpdate=true;trunks.computeBoundingSphere();leaves.computeBoundingSphere();
  }finally{if(holder&&!published){root.remove(holder);holder.traverse(m=>m.geometry?.dispose());if(preparing)physicsRevision++;}}
 }
 const cancelTerrain=t=>{buildQueue?.cancel('terrain:'+t.index);t.targetKey=null;t.targetStamp=null;};
 const updateTerrain=(t,ix,iz,stamp=terrainStamp(ix,iz))=>{cancelTerrain(t);t.targetKey=`${ix},${iz}`;t.targetStamp=stamp;const task=buildTerrain(t,ix,iz,stamp);if(buildQueue)buildQueue.add('terrain:'+t.index,task,{minX:ix*size,maxX:(ix+1)*size,minZ:iz*size,maxZ:(iz+1)*size},()=>{},{forceDistance:240});else for(const _ of task){}};
 const riverA=new T.Mesh(new T.PlaneGeometry(78,4000),waterMat),riverB=new T.Mesh(new T.PlaneGeometry(4000,78),waterMat);for(const r of [riverA,riverB]){r.rotation.x=-Math.PI/2;r.position.y=-1.6;root.add(r);}
 let recycled=0,lastCell='',lastKeep='',lastTerrainArea='',lastGraphRevision=-1;
 function update(s,keep=[]){
  const ensured=ensureNetwork(s.x,s.z,keep),changed=ensured||lastGraphRevision!==networkRevision();lastGraphRevision=networkRevision();if(changed){
   // Preserve retained corridors and their collider identities. Only recycled
   // road families require new geometry; a distant graph node is not a reason
   // to discard every visible road and terrain tile at once.
   const stale=chunks.filter(c=>!RENDER_MOTORWAYS.includes(c.id));for(const id of RENDER_MOTORWAYS)if(!chunks.some(c=>c.id===id))for(let i=0;i<10;i++){const c=stale.pop();cancelWarm(c);c.id=id;c.index=null;}recycled++;
  }
  const cell=`${networkRevision()}:${Math.floor(s.x/80)},${Math.floor(s.z/80)}`,keepKey=keep.join('|');if(cell!==lastCell||keepKey!==lastKeep){syncRoadFurniture(s,keep);lastKeep=keepKey;}if(cell===lastCell)return;lastCell=cell;
  for(const id of RENDER_MOTORWAYS){const projection=projectMain(id,s.x,s.z,0),pool=chunks.filter(c=>c.id===id),needed=projection.distance<1100||keep.includes(id),along=projection.s,first=Math.floor(along/80)-5,wanted=Array.from({length:10},(_,i)=>first+i),stale=pool.filter(c=>!wanted.includes(c.index));
  if(!needed){
   // Warm an approaching perpendicular corridor a few milliseconds at a
   // time. Its surfaces remain hidden and unallocated to near-car physics.
   // Entering the visible/occupied envelope cancels pending work below and
   // finishes required chunks synchronously, preserving the safety fallback.
   for(const c of pool)if(c.warm&&!wanted.includes(c.warm.index))cancelWarm(c);
   if(projection.distance<2100){
    if(buildQueue){const available=stale.filter(c=>!c.warm);for(const idx of wanted)if(!pool.some(c=>c.index===idx||c.warm?.index===idx)){const c=available.pop();if(c)warmChunk(c,id,idx);}}
    else {let budget=2;for(const idx of wanted)if(!pool.some(c=>c.index===idx)&&budget-->0){const c=stale.pop();if(c.index!==null)recycled++;updateChunk(c,idx);c.prewarmRevision=networkRevision();physicsRevision++;}}
   }else for(const c of pool)cancelWarm(c);
   pool.forEach(c=>[...c.members,...c.banks,c.structures].forEach(m=>m.visible=false));continue;
  }
  for(const c of pool)cancelWarm(c);
   // Local exits can arrive after an invisible segment was prepared. Its
   // guardrail openings, shoulders and support masks must be rebuilt against
   // that graph before activation, even when the segment index is unchanged.
   for(const c of pool)if(wanted.includes(c.index)&&c.prewarmRevision!==null&&c.prewarmRevision!==undefined){if(c.prewarmRevision!==networkRevision()){updateChunk(c,c.index);physicsRevision++;}c.prewarmRevision=null;}
   for(const idx of wanted)if(!pool.some(c=>c.index===idx)){const c=stale.pop();if(c.index!==null)recycled++;updateChunk(c,idx);}
   // Remote perpendicular corridor remains pooled but need not cast shadows.
   const visible=needed;pool.forEach(c=>[...c.members,...c.banks,c.structures].forEach(m=>m.visible=visible));
  }
  const cx=Math.floor(s.x/size),cz=Math.floor(s.z/size),area=cx+','+cz,wanted=[];if(area!==lastTerrainArea){for(const t of terrain)if(t.targetKey)cancelTerrain(t);lastTerrainArea=area;}for(let z=-2;z<=2;z++)for(let x=-2;x<=2;x++)wanted.push([cx+x,cz+z]);const keys=new Set(wanted.map(p=>p.join(',')));
  for(const t of terrain)if(t.targetKey&&!keys.has(t.targetKey))cancelTerrain(t);
  const assigned=t=>t.targetKey||t.key,stale=terrain.filter(t=>!keys.has(assigned(t)));for(const[x,z]of wanted)if(!terrain.some(t=>assigned(t)===`${x},${z}`))updateTerrain(stale.pop(),x,z);
  if(changed)for(const t of terrain){const key=assigned(t);if(!key)continue;const[x,z]=key.split(',').map(Number),stamp=terrainStamp(x,z);if((t.targetStamp??t.pathStamp)!==stamp)updateTerrain(t,x,z,stamp);}
  motorwaySigns.update(s);riverA.position.x=riverAX(s.x);riverA.position.z=s.z;riverB.position.x=s.x;riverB.position.z=1500;
 }
 update(initial);root.visible=true;
 return {root,update,groundHeight,setTown(p){const key=p.index??'origin';townPads.delete(key);townPads.set(key,{...p,pad:regionLayout(p.index)?.terrainPad});while(townPads.size>3){const oldest=[...townPads.keys()].find(k=>k!=='origin');townPads.delete(oldest);}townTilesChanged=0;for(const t of terrain){const key=t.targetKey||t.key;if(!key)continue;const[x,z]=key.split(',').map(Number),stamp=terrainStamp(x,z);if((t.targetStamp??t.pathStamp)!==stamp){updateTerrain(t,x,z,stamp);townTilesChanged++;}}},get regionTerrainStats(){return{pads:townPads.size,invalidated:townTilesChanged};},get physicsRevision(){return physicsRevision+(motorwaySigns?.revision||0);},get recycled(){return recycled;},get chunkCount(){return chunks.length;},get terrainCount(){return terrain.length;},get sceneryStats(){return terrain.reduce((s,t)=>{s.houses+=t.plan?.houses.length||0;s.fields+=t.plan?.fields.length||0;s.lakes+=t.plan?.lakes.length||0;return s;},{houses:0,fields:0,lakes:0});}};
}
