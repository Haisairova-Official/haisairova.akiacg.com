import {tollEdgePoints,tollMixedMarking} from './toll-layout.mjs?rev=world21d';
import{localSite,stableNearbyLocalSites,siteType,closestMotorwayFamily}from'./local-sites.mjs?rev=world21d';
import {createFlatSurfaceCutter,cutFlatGeometry} from './junction-surface.mjs?rev=world21d';
import {buildDirectionalInterchange} from './directional-interchange-network.mjs?rev=world21d';
import {roadBuildSlices} from './road-build-queue.mjs?rev=world21d';
import {batchStaticVisualsSteps} from './mesh-batching.js?rev=world21d';
import {buildLocalInterchange} from './local-interchange-network.mjs?rev=world21d';
import {createRoadStructureFactory} from './road-structures.js?rev=world21d';
import {INTERCHANGE_TYPES,projectPath} from './interchange-logic.mjs?rev=world21d';
import {roadFamily,pathSection,connectorById,supportClear,networkInternalBoundary,terrainHeight} from './road-network.mjs?rev=world21d';
// Two reusable local-interchange slots. Every surface, projection and stream
// boundary uses world-space sampled geometry from the same motorway centreline.
export function createInterchanges(T,scene,{sign,box,sharedGeometries=[],buildQueue=null,prepareSlice=null}){
 const borrowedGeometry=new Set(sharedGeometries);
 const slots=[0,1].map(()=>{const holder=new T.Group();scene.add(holder);return{holder,index:-1,type:'',data:null};});let firstType=0,renderSerial=0;const familyWindows=new Map();
 const asphalt=new T.MeshStandardMaterial({color:0x627e88,roughness:.94,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}),white=new T.MeshStandardMaterial({color:0xeceede,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8}),rail=new T.MeshStandardMaterial({color:0xb2c7c1,roughness:.8,side:T.DoubleSide}),concrete=new T.MeshStandardMaterial({color:0x8da09b,side:T.DoubleSide});
 const structure=createRoadStructureFactory(T,{metal:rail,concrete}),weight=p=>p.bridge??Math.max(0,Math.min(1,(p.y-terrainHeight(p.x,p.z)-2.3)/1.5));
 const typeAt=index=>siteType(index,firstType);
 function geometry(points,width,offset=0,lift=.22,height=0){const v=[],indices=[];for(let i=0;i<points.length;i++){const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],h=p.heading??Math.atan2(b.x-a.x,b.z-a.z);const bounds=typeof width==='function'?width(p,i):{inner:offset-width/2,outer:offset+width/2};for(const side of [-1,1]){const o=height?offset:side<0?bounds.inner:bounds.outer;v.push(p.x-Math.cos(h)*o,p.y+lift+(height&&side===1?height:0),p.z+Math.sin(h)*o);}if(i){const k=i*2;indices.push(k-2,k-1,k,k-1,k+1,k);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();return g;}
 function build(index){const site=localSite(index);if(!site)throw new RangeError('No safe local site: '+index);const type=typeAt(index),options={anchor:site.anchor,reach:site.reach??(type==='directional'?null:1444),naturalPlacement:site.placement!=='legacy-special',exitNumber:site.exitNumber};const data=type==='directional'?buildDirectionalInterchange(index,site.station,options):buildLocalInterchange(type,index,site.station,options);data.site=site;return data;}

 const disposeChildren=g=>{const geometries=new Set(),textures=new Set(),materials=new Set();for(const child of [...g.children]){child.traverse(o=>{if(o.geometry&&!borrowedGeometry.has(o.geometry))geometries.add(o.geometry);const material=o.userData.cameraFadeOriginalMaterial||o.material;if(material?.map)textures.add(material.map);if(o.userData.ownedSignMaterial&&material)materials.add(material);});g.remove(child);}for(const g of geometries)g.dispose();for(const t of textures)t.dispose();for(const m of materials)m.dispose();};
 function* render(slot){const g=slot.holder;disposeChildren(g);const data=slot.data;let surfaceGroup=g,surfaceOwner='';
  const add=(points,width,mat,offset=0,lift=.22,height=0)=>{const m=new T.Mesh(geometry(points,width,offset,lift,height),mat);m.receiveShadow=true;m.userData.cameraOccluderRole=mat===asphalt?'pavement':mat===white?'marking':undefined;m.userData.cameraRoadId=surfaceOwner;if(mat===asphalt)m.userData.driveCollider='ground';if(mat===rail)m.userData.driveCollider='wall';surfaceGroup.add(m);return m;};
  const owner=data.routes[0].id,geometryRoads=data.renderRoads||data.roads;
  const renderedSurfaces=new Map();
  const localSupportClear=(x,z,y)=>supportClear(x,z,y)&&!geometryRoads.some(other=>{const q=projectPath(other,x,z);if(q.y>=y-3)return false;const distance=Math.hypot(Math.sqrt(Math.max(0,q.distance*q.distance-q.lane*q.lane)),q.lane-(other.offset||0));return distance<other.width/2+1.5;});
  for(const path of geometryRoads){const primary=data.type==='directional'&&path.id.includes(':west-')?geometryRoads.find(p=>p.id===path.id.replace(':west-',':east-')):null,ownerSurfaces=primary?renderedSurfaces.get(primary.id):null,cutters=primary?{asphalt:createFlatSurfaceCutter(primary,{geometries:ownerSurfaces.asphalt}),deck:createFlatSurfaceCutter(primary,{geometries:ownerSurfaces.deck}),white:createFlatSurfaceCutter(primary,{lift:.245})}:null,ownSurfaces={asphalt:[],deck:[]};renderedSurfaces.set(path.id,ownSurfaces);for(const points of roadBuildSlices(path.points)){surfaceOwner=path.id;const chunk=new T.Group();chunk.userData.cameraRoadId=path.id;chunk.visible=false;g.add(chunk);surfaceGroup=chunk;const offset=path.offset||0,pts=points.map(p=>({...p,bridge:weight(p)}));const pavement=add(pts,p=>pathSection(path,p.s),asphalt,offset);if(cutters)pavement.geometry=cutFlatGeometry(T,pavement.geometry,cutters.asphalt);ownSurfaces.asphalt.push(pavement.geometry);yield;if(path.tollSections?.length){const mark=add(pts,p=>tollMixedMarking(path,p),white,0,.247);mark.userData.tollMarking=true;}

   const deck=structure.deck(pts,p=>pathSection(path,p.s),offset);if(cutters){deck.geometry=cutFlatGeometry(T,deck.geometry,cutters.deck);const p=deck.geometry.attributes.position,top=[];for(let i=0;i<p.count;i+=3){const ax=p.getX(i+1)-p.getX(i),ay=p.getY(i+1)-p.getY(i),az=p.getZ(i+1)-p.getZ(i),bx=p.getX(i+2)-p.getX(i),by=p.getY(i+2)-p.getY(i),bz=p.getZ(i+2)-p.getZ(i),nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;if(ny>Math.hypot(nx,ny,nz)*.9)top.push(i/3);}deck.userData.driveTopTriangles=top;}ownSurfaces.deck.push(deck.geometry);chunk.add(deck);yield;chunk.add(...structure.supports(pts,path.width,{groundHeight:terrainHeight,clear:localSupportClear,bridgeWeight:weight}));yield;
   for(const side of [-1,1]){surfaceGroup=chunk;const markingOffset=side*(path.laneWidth?path.laneWidth/2:path.width/2-.25);const marking=add(pts,.13,white,markingOffset,.245);if(cutters)marking.geometry=cutFlatGeometry(T,marking.geometry,cutters.white);const edgeAt=p=>(side<0?pathSection(path,p.s).inner:pathSection(path,p.s).outer)+side*.28,mask=(p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],h=p.heading??Math.atan2(b.x-a.x,b.z-a.z),edge=edgeAt(p),x=p.x-Math.cos(h)*edge,z=p.z+Math.sin(h)*edge;
    return !geometryRoads.some(other=>other.id!==path.id&&(()=>{const q=projectPath(other,x,z,p.y);return Math.hypot(Math.sqrt(Math.max(0,q.distance*q.distance-q.lane*q.lane)),q.lane-(other.offset||0))<other.width/2+.25&&Math.abs(q.y-p.y)<.7;})())&&!networkInternalBoundary(owner,x,z,p.y,other=>other.local&&other.junctionId===`town:${slot.index}`);};
    chunk.add(...structure.barriers(tollEdgePoints(path,pts,side),0,{mask:(p,i)=>mask(pts[i]||p,i),bridgeWeight:weight}));yield;
   }
   if(prepareSlice)yield*prepareSlice(chunk);chunk.visible=true;renderSerial++;yield;
  }}yield*batchStaticVisualsSteps(T,g);renderSerial++;
  const p=data.exit.points[Math.min(15,data.exit.points.length-1)],h=Math.atan2(data.exit.points[16].x-p.x,data.exit.points[16].z-p.z),offset=data.exit.width/2+4.2,sx=p.x-Math.cos(h)*offset,sz=p.z+Math.sin(h)*offset;
  sign(`${data.name} · ${data.region?.name||'存档街区'}`,sx,p.y+3.5,sz,6.5,1.5,h-Math.PI,'#087449','#ffffff',g);box(g,.18,3.5,.18,0x9caeae,sx,p.y+1.75,sz).userData.driveCollider='wall';
 }
 const clearSlot=slot=>{buildQueue?.cancel(`local:${slot.index}:${slot.type}`);disposeChildren(slot.holder);slot.rendered=false;slot.queued=false;renderSerial++;};
 function update(x,locked=null,z=19,keep=[],activeRoad=null,requiredIndices=[]){
  const path=activeRoad&&connectorById(activeRoad),families=locked!==null?[localSite(locked)?.host]:path?.physicalLocal?path.regionIndices.map(i=>localSite(i)?.host):path?[roadFamily(path.from),roadFamily(path.to)]:activeRoad&&!activeRoad.includes('>')?[roadFamily(activeRoad)]:[closestMotorwayFamily(x,z)];
  const wanted=[...new Set([...(locked!==null?[locked]:[]),...requiredIndices,...families.filter(Boolean).flatMap(f=>{const window=stableNearbyLocalSites(f,x,z,familyWindows.get(f)||[],2);familyWindows.set(f,window);if(familyWindows.size>12)familyWindows.delete(familyWindows.keys().next().value);return window;})])];
  const occupied=slot=>keep.some(id=>id?.startsWith(`town:${slot.index}:`)||(connectorById(id)?.dependencies?.regionIndices||connectorById(id)?.regionIndices)?.includes(slot.index));
  const neededSlots=[];for(const index of wanted){let slot=slots.find(s=>s.index===index);if(!slot){slot=slots.find(s=>!wanted.includes(s.index)&&!occupied(s)&&!neededSlots.includes(s));if(!slot){const holder=new T.Group();scene.add(holder);slot={holder,index:-1,type:'',data:null};slots.push(slot);}}neededSlots.push(slot);
   const type=slot.index===index&&(requiredIndices.includes(index)||occupied(slot))?slot.type:typeAt(index);if(slot.index!==index||slot.type!==type){clearSlot(slot);slot.index=index;slot.type=type;slot.data=build(index);const ps=slot.data.roads.flatMap(r=>r.points);slot.bounds={minX:Math.min(...ps.map(p=>p.x)),maxX:Math.max(...ps.map(p=>p.x)),minZ:Math.min(...ps.map(p=>p.z)),maxZ:Math.max(...ps.map(p=>p.z))};slot.networkRoute=null;}
  }
  for(const slot of [...slots]){
   if(!neededSlots.includes(slot)&&!occupied(slot)){clearSlot(slot);scene.remove(slot.holder);slots.splice(slots.indexOf(slot),1);continue;}
   const {minX,maxX,minZ,maxZ}=slot.bounds,pad=slot.rendered||slot.queued?2200:1800,distance=Math.hypot(Math.max(minX-x,0,x-maxX),Math.max(minZ-z,0,z-maxZ)),needed=distance<pad||occupied(slot);
   if(needed&&!slot.rendered&&!slot.queued){slot.queued=true;const done=()=>{slot.queued=false;slot.rendered=true;renderSerial++;},task=render(slot);if(buildQueue)buildQueue.add(`local:${slot.index}:${slot.type}`,task,slot.bounds,done);else{for(const _ of task){}done();}}
   else if(!needed&&(slot.rendered||slot.queued))clearSlot(slot);
  }
 }
 const dataAt=index=>slots.find(p=>p.index===index)?.data||build(index);

 update(40);
 return{update,typeAt,actualTypeAt:index=>slots.find(s=>s.index===index)?.type||typeAt(index),slots,dataAt,get renderRevision(){return renderSerial;},networkRoutes:()=>slots.flatMap(s=>s.data.routes),setFirstType(type){firstType=(Math.max(0,INTERCHANGE_TYPES.indexOf(type))+2)%3;},project(index,x,z,height,currentId){const data=dataAt(index);let best=null,score=Infinity;for(const path of data.roads){const p=projectPath(path,x,z,height);const section=pathSection(path,p.s),offset=section.centre,pavedDistance=Math.hypot(Math.sqrt(Math.max(0,p.distance*p.distance-p.lane*p.lane)),p.lane-offset);if(pavedDistance>section.width/2+.2||Math.abs(p.y-height)>2)continue;const rank=p.distance+Math.abs(p.y-height)*4-(currentId===path.id?.2:0);if(rank<score){best={...p,index,type:data.type};score=rank;}}return best;},finish(index){return dataAt(index).finish;},town(index){return dataAt(index).town;}};
}
