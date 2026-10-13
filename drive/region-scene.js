import{projectPath}from'./interchange-logic.mjs?rev=world21d';
import{createRoadStructureFactory}from'./road-structures.js?rev=world21d';
import{createFlatSurfaceCutter,cutFlatGeometry}from'./junction-surface.mjs?rev=world21d';
import{createCrabbayEnvironment}from'./crabbay/scene.js?rev=world21d';
import {regionLayout,regionWorldPoint} from './region-roads.mjs?rev=world21d';
import {regionForIndex,regionGeometryKey} from './regions.mjs?rev=world21d';
import {batchStaticVisualsSteps} from './mesh-batching.js?rev=world21d';
// Each destination owns its metric road mesh, scenery and collision resources.
// The original archive never moves; at most two generated districts are resident.
function* createRegionSceneSteps(T,parent,pose,{sign}){
 const baseLayout=regionLayout(pose.index),layout={...baseLayout,roads:baseLayout.roads.filter(r=>pose.localConnected||!r.localPort&&!r.junction)},root=new T.Group(),materials=new Map(),geometries=new Set(),textures=new Set();root.name=layout.region.id;root.position.set(pose.x,pose.y,pose.z);root.rotation.y=pose.angle;root.userData.regionId=layout.region.id;parent.add(root);
 const material=(c,opts={})=>{const key=c+JSON.stringify(opts);if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color:c,roughness:.85,...opts}));return materials.get(key);};
 const mesh=(g,c,x=0,y=0,z=0,owner=root,opts={})=>{geometries.add(g);const m=new T.Mesh(g,material(c,opts));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;m.userData.cameraOccluderRole=owner.userData.cameraOccluderRole;owner.add(m);return m;};
 const box=(w,h,d,c,x,y,z,owner=root)=>mesh(new T.BoxGeometry(w,h,d),c,x,y,z,owner);
 const cyl=(r,h,c,x,y,z,owner=root)=>mesh(new T.CylinderGeometry(r,r,h,10),c,x,y,z,owner);
 const board=(label,x,y,z,w=5,h=1,rot=0,owner=root)=>{const m=sign(label,x,y,z,w,h,rot,'#e5ddc9','#344b46',owner);m.userData.cameraOccluderRole=owner.userData.cameraOccluderRole||'furniture';m.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material){if(o.material.map)textures.add(o.material.map);materials.set(o.material.uuid,o.material);}});if(owner===root&&y>1){const support=y-h/2,span=Math.max(.6,w*.35);for(const side of[-1,1]){const pole=cyl(.07,support,0x667570,x+Math.cos(rot)*span*side,support/2,z-Math.sin(rot)*span*side,root);pole.userData.driveCollider='wall';pole.userData.cameraOccluderRole='furniture';}if(m.isMesh)m.userData.driveCollider='wall';}return m;};
 const interactions=layout.landmarks.map(l=>({...l,radius:13,tag:layout.region.name,text:l.description,links:[]}));
 const api={root,region:layout.region,layout,interactions,geometryKey:regionGeometryKey(layout.region,pose),dispose(){root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});parent.remove(root);for(const g of geometries)g.dispose();for(const m of new Set(materials.values()))m.dispose();for(const t of textures)t.dispose();}};yield api;
 const urban=!!layout.viaduct,village=layout.region.kind==='village',graded=urban||village,bounds=layout.groundBounds,depth=Math.max(10,pose.y+6),ground=layout.region.kind==='crabbay'?null:graded?box(bounds.maxX-bounds.minX,depth,bounds.maxZ-bounds.minZ,0xa8b49e,(bounds.minX+bounds.maxX)/2,.02-depth/2,(bounds.minZ+bounds.maxZ)/2):box(126,.45,112,layout.region.kind==='baker'?0xaabd9d:0x8fa77b,0,-.205,0);if(ground){ground.userData.driveCollider=urban?'wall':'ground';ground.userData.cameraOccluderRole='road';if(graded){const g=ground.geometry,a=g.attributes.position,idx=g.index;ground.userData.driveTopTriangles=[];for(let i=0;i<idx.count;i+=3)if([0,1,2].every(k=>a.getY(idx.getX(i+k))>depth/2-.001))ground.userData.driveTopTriangles.push(i/3);}}yield 'region-ground';
 // Shared samples and metric width drive pavement, marks and the route graph.
 function strip(path,width,y,color,offset=0,collision=false){const v=[],ix=[];for(const p of path){for(const side of[-1,1])v.push(p.x+Math.cos(p.heading)*((typeof offset==='function'?offset(p):offset)+side*(typeof width==='function'?width(p):width)/2),(p.y||0)+y,p.z-Math.sin(p.heading)*((typeof offset==='function'?offset(p):offset)+side*(typeof width==='function'?width(p):width)/2));if(v.length>6){const k=v.length/3-2;ix.push(k-2,k,k-1,k-1,k,k+1);}}if(collision&&y>.1){const bottom=y>.21&&y<.25?.19:.02,face=(a,b,c,d)=>{const k=v.length/3;v.push(...a,...b,...c,...d);ix.push(k,k+1,k+2,k,k+2,k+3);},top=i=>v.slice(i*3,i*3+3),low=p=>[p[0],p[1]-y+bottom,p[2]],count=path.length;for(let i=1;i<count;i++){const l0=top((i-1)*2),l1=top(i*2),r0=top((i-1)*2+1),r1=top(i*2+1);face(l0,low(l0),low(l1),l1);face(r1,low(r1),low(r0),r0);}const a=top(0),b=top(1),c=top((count-1)*2),d=top((count-1)*2+1);face(b,low(b),low(a),a);face(c,low(c),low(d),d);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();const m=mesh(g,color);if(collision)m.userData.driveCollider='ground';m.userData.cameraOccluderRole='road';return m;}
 const sections=(points,valid)=>{const out=[];let chunk=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(valid(a,b)){if(!chunk.length)chunk.push(a);chunk.push(b);}else if(chunk.length){out.push(chunk);chunk=[];}}if(chunk.length)out.push(chunk);return out;};
 let primaryPavement=null;const priorPavements=[];const roadBoxes=new Map(layout.roads.map(r=>[r,{minX:Math.min(...r.points.map(p=>p.x))-r.width,maxX:Math.max(...r.points.map(p=>p.x))+r.width,minZ:Math.min(...r.points.map(p=>p.z))-r.width,maxZ:Math.max(...r.points.map(p=>p.z))+r.width}]));
 const openMark=(road,a,b,offset)=>{if(!village)return true;const x=(a.x+b.x)/2+Math.cos(a.heading)*offset,z=(a.z+b.z)/2-Math.sin(a.heading)*offset;return !layout.roads.some(other=>{if(other===road)return false;const box=roadBoxes.get(other);if(x<box.minX||x>box.maxX||z<box.minZ||z>box.maxZ)return false;const q=projectPath(other,x,z,0);return q.distance<other.width/2+.2;});};
 for(const road of layout.roads){
  const p=road.points,isMain=road===layout.roads[0],parking=layout.parking[0],parkingHalf=(layout.roads[1]?.width||6)/2+.6,leftSections=isMain?sections(p,(a,b)=>!(Math.abs((a.y||0)-(layout.roads[1]?.points[0].y||0))<.01&&Math.abs(a.z-(layout.roads[1]?.points[0].z||0))<road.width*1.6&&a.z<0&&Math.min(a.x,b.x)<parking.x+parkingHalf&&Math.max(a.x,b.x)>parking.x-parkingHalf)):[p];
  strip(p,q=>road.width+(q.rightApron||0)+.7,isMain?(urban?.205:.19):.18,0xc0bdae,q=>(q.rightApron||0)/2,true);yield 'region-apron';
  const pavement=strip(p,road.width,.22,0x59656a,0,true);if(isMain)primaryPavement=pavement.geometry;else if(layout.region.kind==='crabbay'||urban||village){pavement.geometry=cutFlatGeometry(T,pavement.geometry,createFlatSurfaceCutter(null,{geometries:village?priorPavements:[primaryPavement]}));geometries.add(pavement.geometry);}priorPavements.push(pavement.geometry);yield 'region-pavement';
  for(const side of[-1,1])for(const part of side<0?leftSections:[p])for(const visible of village?sections(part,(a,b)=>openMark(road,a,b,side*(road.width/2-.22))):[part]){strip(visible,.1,.232,0xe1e0cb,side*(road.width/2-.22));yield 'region-edge-line';}
  if(isMain){for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1];if(Math.floor(a.s/5)%2===0&&openMark(road,a,b,0))strip([a,b],.11,.234,0xd9c271);if(i%12===11)yield 'region-centre-line';}
   if(road.sidewalk)for(const side of[-1,1])for(const part of side<0?leftSections:[p]){strip(part,road.sidewalk,.33,0xc9c4b5,q=>side*(road.width/2+road.sidewalk/2+.35)+(side>0?(q.rightApron||0):0),true);yield 'region-sidewalk';}}
 }
 yield 'region-roads';
 if(urban){
  const all=layout.roads[0].points,raised=all.filter((p,i)=>p.y>.0001||all[i-1]?.y>.0001||all[i+1]?.y>.0001),width=layout.roads[0].width+1.8+2*layout.roads[0].sidewalk+1.4,offset=-.9,bridgeWeight=p=>Math.max(0,Math.min(1,(p.y-1.6)/1.4)),structure=createRoadStructureFactory(T,{metal:material(0xb9c8c7,{side:T.DoubleSide}),concrete:material(0x9baaa3,{side:T.DoubleSide})});
  const segments=[];for(let i=1;i<all.length;i++)segments.push({a:all[i-1],b:all[i]});
  const clear=(x,z,height)=>{for(const{a,b}of segments){if(Math.max(a.y,b.y)>height-3||x<Math.min(a.x,b.x)-12||x>Math.max(a.x,b.x)+12||z<Math.min(a.z,b.z)-12||z>Math.max(a.z,b.z)+12)continue;const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(x-a.x-dx*t,z-a.z-dz*t)<10.7)return false;}return true;};
  const add=m=>{m.userData.cameraRoadId=layout.roads[0].id;geometries.add(m.geometry);root.add(m);};
  add(structure.deck(raised,width,offset));yield 'urban-box-girder';
  for(const side of[-1,1]){for(const m of structure.barriers(raised,offset+side*width/2,{bridgeWeight}))add(m);yield 'urban-barrier';}
  for(const m of structure.supports(raised,width,{groundHeight:()=>.02,clear,bridgeWeight}))add(m);yield 'urban-piers';
 }

 // Earth shoulders cover the flat-town/terrain transition with actual geometry.
 if(layout.region.kind!=='crabbay'&&!urban){const q=layout.groundBounds||{minX:-63,maxX:63,minZ:-56,maxZ:56},v=[],top=[[q.minX,-.1,q.minZ],[q.maxX,-.1,q.minZ],[q.maxX,-.1,q.maxZ],[q.minX,-.1,q.maxZ]],bottom=[[q.minX-21,-pose.y-4,q.minZ-21],[q.maxX+21,-pose.y-4,q.minZ-21],[q.maxX+21,-pose.y-4,q.maxZ+21],[q.minX-21,-pose.y-4,q.maxZ+21]];for(let i=0;i<4;i++){const j=(i+1)%4;v.push(...top[i],...bottom[i],...top[j],...top[j],...bottom[i],...bottom[j]);}const eg=new T.BufferGeometry();eg.setAttribute('position',new T.Float32BufferAttribute(v,3));eg.computeVertexNormals();const earth=mesh(eg,0x92a77d);earth.userData.driveCollider='ground';yield 'region-earth';}
 const building=(x,z,w,d,h,color,{pub=false,rotation=0}={})=>{const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;g.userData.cameraOccluderRole='building';root.add(g);const foundation=box(w+.4,.32,d+.4,0xb8b3a2,0,.18,0,g);foundation.userData.driveCollider='wall';const wall=box(w,h,d,color,0,h/2+.3,0,g);wall.userData.driveCollider='wall';{const rw=w/2+.35,rd=d/2+.35,base=h+.3,rise=pub?2:1.4,rg=new T.BufferGeometry();rg.setAttribute('position',new T.Float32BufferAttribute([-rw,base,-rd,rw,base,-rd,-rw,base,rd,rw,base,rd,-rw,base+rise,0,rw,base+rise,0],3));rg.setIndex([0,4,1,1,4,5,2,3,4,3,5,4,0,2,4,1,5,3]);rg.computeVertexNormals();const roof=mesh(rg,0x50585a,0,0,0,g);roof.userData.driveCollider='wall';}box(w+.2,.24,d+.2,0xbdb7a4,0,3.7,0,g);for(const yy of[1.8,5.1,7.7].filter(y=>y<h-.5))for(let xx=-w/2+1.3;xx<w/2-1;xx+=2.6){box(1.35,1.8,.12,0xd3cbb5,xx,yy,d/2+.08,g);box(1.1,1.5,.14,0x4a636d,xx,yy,d/2+.16,g);box(.08,1.5,.16,0xd3cbb5,xx,yy,d/2+.24,g);}box(1.6,2.6,.15,pub?0x244c3d:0x69564a,0,1.6,d/2+.15,g);if(pub){box(w+.4,.2,1.4,0x284f42,0,3.2,d/2+.6,g);board('Owl 侦探社',0,6.65,d/2+.26,w-1,1,0,g);board('楼下酒馆 · 楼上办公室',0,3.9,d/2+.29,w-.5,.75,0,g);}return g;};
 const tree=(x,z,size=1)=>{const g=new T.Group();g.userData.cameraOccluderRole='tree';root.add(g);const trunk=cyl(.22,2.8*size,0x796854,x,1.4*size,z,g);trunk.userData.driveCollider='wall';mesh(new T.IcosahedronGeometry(1.8*size,1),0x68896a,x,3.8*size,z,g);};
 if(layout.region.kind==='baker'){
  building(20,-45,14,10,9,0x907364,{pub:true});yield 'region-building';building(-8,-39,12,9,8,0x9b856f);yield 'region-building';building(42,-43,10,11,7,0x8b8175);yield 'region-building';
  building(-18,38,11,10,8,0xaa917a,{rotation:Math.PI});yield 'region-building';building(2,39,12,10,7,0xa09d8a,{rotation:Math.PI});yield 'region-building';building(24,39,12,11,8,0x8c7f73,{rotation:Math.PI});yield 'region-building';
  box(20,.15,14,0xb7b5a7,-21,.1,0);for(const[x,z]of[[-19,-4],[-10,4],[25,8],[-40,-37],[-43,36]])tree(x,z,.85);
  for(const p of layout.roads[0].points.filter((_,i)=>i%18===9)){const side=1,off=layout.roads[0].width/2+1.2+(p.rightApron||0),x=p.x+Math.cos(p.heading)*off*side,z=p.z-Math.sin(p.heading)*off*side;const pole=cyl(.075,4.4,0x425452,x,2.2,z);pole.userData.driveCollider='wall';pole.userData.cameraOccluderRole='furniture';box(.65,.25,.65,0xe6cf93,x,4.45,z).userData.cameraOccluderRole='furniture';}
  board('迷你贝克街',38,2.4,-7,5,1.2,Math.PI/2);board('原型街区 · 外观与布局原创',20,2,-38.5,9,.65);
 }else if(urban){
  for(const[x,z,w,d,h]of[[-170,-58,28,17,9],[-245,-62,30,20,12],[-300,70,32,28,11],[-190,95,28,24,14],[-100,80,32,23,10],[-225,-100,27,20,8]]){building(x,z,w,d,h,0xb6ada0);yield 'urban-building';}
  for(const[x,z]of[[-110,-38],[-150,43],[-240,43],[-300,-38],[-70,48],[-310,160],[-60,-65]])tree(x,z);
  board(layout.region.name,-170,3.2,-47,9,1.3);board('城市高架 · 上下接续',-355,2.8,130,8,1.2,Math.PI/2);
 }else if(layout.region.kind==='crabbay'){
  yield*createCrabbayEnvironment(T,root,{layout,pose,box,cyl,mesh,board});
 }else{
  for(const b of layout.buildings){building(b.x,b.z,b.w,b.d,b.h,b.color,{rotation:b.rotation});yield 'village-building';}
  for(const f of layout.fields){box(f.w,.08,f.d,f.color,f.x,.085,f.z);for(let row=0;row<6;row++)box(f.w-.6,.08,.11,0xb6b780,f.x,.16,f.z-f.d/2+1.7+row*3.2);yield 'village-field';}
  for(const t of layout.trees){tree(t.x,t.z,t.size);yield 'village-tree';}
  board(layout.region.name,38,2.2,-8,7,1.2,Math.PI/2);if(pose.localConnected){const n=layout.externalPort.node;board('← '+(pose.localTargetName||'地方公路'),n.x+10,2.4,n.z-15,8,1.25,Math.PI);board('高速入口 ↑',n.x+10,1.25,n.z-15,6,.75,Math.PI);}

 }
 board('高速入口 →',32,2.1,7,5,1,-Math.PI/2);
 yield 'region-details';yield*batchStaticVisualsSteps(T,root);root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});root.updateMatrixWorld(true);api.ready=true;

}
export function createRegionScene(T,parent,pose,options={}){const task=createRegionSceneSteps(T,parent,pose,options),api=task.next().value;api.prepare=task;if(!options.defer)for(const _ of task){}return api;}
export function createRegionScenes(T,parent,origin,{sign,maxGenerated=2,defer=false}={}){
 const cache=new Map();let current=origin,clock=0;
 return{load(pose){const region=regionForIndex(pose.index);if(region.kind==='archive'){current=origin;return origin;}const key=regionGeometryKey(region,pose);for(const[k,e]of cache)if(k!==key&&e.region.id===region.id){e.prepare.return();e.dispose();cache.delete(k);}let entry=cache.get(key);if(!entry){entry=createRegionScene(T,parent,pose,{sign,defer});cache.set(key,entry);}entry.used=++clock;current=entry;for(const[k,e]of[...cache].sort((a,b)=>a[1].used-b[1].used)){if(cache.size<=maxGenerated)break;if(e!==current){e.prepare.return();e.dispose();cache.delete(k);}}return entry;},get current(){return current;},get size(){return cache.size;},dispose(){for(const e of cache.values()){e.prepare.return();e.dispose();}cache.clear();}};
}
