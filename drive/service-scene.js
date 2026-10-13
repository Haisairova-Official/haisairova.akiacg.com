import{createYaris}from'./yaris-model.js?rev=world21d';
import{batchStaticVisualsSteps}from'./mesh-batching.js?rev=world21d';
import{SERVICE_FUEL_PUMPS,SERVICE_SHOWROOM}from'./service-network.mjs?rev=world21d';
// Scenery on the shared service branch. Road and parking remain its real pavement.
// A later interaction layer uses these stable facility locations without moving cars.
export function* buildServiceFacilities(T,path,group,{sign,prepareSlice}){
 const materials=new Map(),material=color=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.82}));return materials.get(color);};group.userData.serviceMaterials=materials;
 const root=new T.Group();root.name=path.destinationId;root.position.set(path.centre.x,path.centre.y,path.centre.z);root.rotation.y=path.centre.heading;group.add(root);
 const box=(w,h,d,color,lane,y,along,kind='wall',role='building')=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),material(color));m.position.set(-lane,y,along);if(kind)m.userData.driveCollider=kind;m.userData.cameraOccluderRole=role;m.castShadow=m.receiveShadow=true;root.add(m);return m;};
 const label=(text,lane,y,along,w=7,h=1,rotation=Math.PI/2)=>{const m=sign(text,-lane,y,along,w,h,rotation,'#e8ead9','#285046',root);if(m)m.userData.cameraOccluderRole='furniture';return m;};
 // Contiguous road, parking apron and footway use the exact shared graph samples.
 const points=path.apron.points;
 function band(inner,outer,top,base,color){const verts=[],v=(p,o,h,y)=>[p.x-Math.cos(h)*o,p.y+y,p.z+Math.sin(h)*o],face=(a,b,c,d)=>verts.push(...a,...b,...c,...b,...d,...c);
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],h=Math.atan2(b.x-a.x,b.z-a.z),q=[v(a,inner,a.heading,top),v(a,outer,a.heading,top),v(b,inner,b.heading,top),v(b,outer,b.heading,top)],low=p=>[p[0],path.centre.y+base,p[2]];face(q[0],q[1],q[2],q[3]);face(q[0],q[2],low(q[0]),low(q[2]));face(q[1],low(q[1]),q[3],low(q[3]));if(i===1)face(q[0],low(q[0]),q[1],low(q[1]));if(i===points.length-1)face(q[2],q[3],low(q[2]),low(q[3]));}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.computeVertexNormals();const m=new T.Mesh(g,material(color));m.userData.driveCollider='ground';m.userData.cameraOccluderRole='road';m.receiveShadow=true;group.add(m);return m;
 }
 band(path.apron.inner,path.apron.outer,.22,-1.23,0x59666b);yield 'parking-apron';band(37,43,.32,-1.23,0xc9c5b4);yield 'service-footway';
 box(18,1.45,156,0xc4bda8,51,.22-1.45/2,21,'ground','road');yield;
 // Physical curb cuts and doorway ramp, not a teleport or invisible step boost.
 const ramp=(a,b,ya,yb,z,w)=>{const points=[[-a,ya,z-w/2],[-b,yb,z-w/2],[-a,ya,z+w/2],[-b,yb,z+w/2]],v=points.flat().concat(points.flatMap(p=>[p[0],.15,p[2]])),idx=[0,1,2,1,3,2,0,2,4,2,6,4,1,5,3,3,5,7,0,4,1,1,4,5,2,3,6,3,7,6,4,6,5,5,6,7],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();const m=new T.Mesh(g,material(0xc9c5b4));m.userData.driveCollider='ground';m.userData.cameraOccluderRole='road';m.receiveShadow=true;root.add(m);};
 ramp(35.3,36.6,.225,.325,36,4.4);box(1.9,.175,4.4,0xc9c5b4,37.55,.2375,36,'ground','road');ramp(40.5,43.6,.325,.465,36,4.35);yield 'doorway-ramps';
 // Parallel heavy-vehicle bays and a separate perpendicular car row leave a 7m aisle.
 for(const along of[-16,13,42,71]){for(const z of[along-12,along+12])box(4,.018,.12,0xeee8d1,8.3,.255,z,null,'road');yield;}
 for(let along=-8;along<95;along+=3.2){box(6,.018,.12,0xeee8d1,32,.255,along,null,'road');yield;}box(.12,.018,105,0xeee8d1,35,.255,43,null,'road');
 for(const along of[-18,75]){box(.08,1,.08,0x718383,39,.5,along,'wall','furniture');label('P',39,1.5,along,1,1);yield;}
 // Fuel roof clears the tallest existing combination. Columns sit outside pavement.
 box(15,.55,32,0x47756e,21,6.7,-30);for(const z of[-43,-17])for(const lane of[14.1,27.9])box(.32,6.35,.32,0x708580,lane,3.175,z);yield;
 for(const pump of SERVICE_FUEL_PUMPS){box(.9,1.65,.62,0xdfe5d7,pump.lane,1.145,pump.along);box(.65,.45,.1,0x365552,pump.lane-.49,1.6,pump.along);yield;}
 label(path.serviceName+' · 加油',21,6.65,-46.1,12,.75,Math.PI);yield;
 // Open, full-size pavilion on the existing parking slab. No raised showroom floor.
 const sh=SERVICE_SHOWROOM;box(sh.width,.35,sh.length,0x58776e,sh.lane,sh.roofY,sh.along);
 for(const lane of[19.6,35.7])for(const along of[-93.7,-60.3])box(.26,4.75,.26,0x8a9992,lane,2.595,along);
 box(.7,1.15,1.2,0x50645d,sh.terminalLane,.795,sh.terminalAlong,'wall','furniture');box(.05,.45,.8,0xbad3ca,sh.terminalLane-.38,1.16,sh.terminalAlong,'wall','furniture');
 // One lightweight static exhibit; all seven detailed choices live in the paused viewer.
 const exhibit=createYaris(T),bounds=new T.Box3().setFromObject(exhibit,true),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());exhibit.userData.cameraOccluderRole='furniture';
 exhibit.traverse(m=>{if(m.material)materials.set('exhibit:'+m.material.uuid,m.material);});yield*batchStaticVisualsSteps(T,exhibit);exhibit.position.set(-sh.displayLane,.22-bounds.min.y,sh.displayAlong);root.add(exhibit);
 const hull=box(size.x,size.y,size.z,0x59666b,sh.displayLane-center.x,.22-bounds.min.y+center.y,sh.displayAlong+center.z,'wall','furniture');hull.visible=false;hull.userData.collisionOnly=true;hull.userData.exhibitCollider=true;
 label(path.showroomName,sh.lane,4.82,-95.1,11,.75,Math.PI);label('停稳 G 下车 · F 观车',sh.terminalLane-.43,1.48,sh.terminalAlong,2.8,.33);yield 'showroom-pavilion';
 // Real doorway between two front walls leads into the small rest/archive room.
 box(15,.24,66,0xb5b1a3,51,.34,36,'ground','road');for(const z of[18.4,53.6])box(.32,4.82,30.8,0xd7d3bb,43.5,2.86,z);box(.32,1.75,4.4,0xd7d3bb,43.5,4.395,36);box(.32,4.82,66,0xd7d3bb,58.5,2.86,36);for(const z of[3,69])box(15,4.82,.32,0xd7d3bb,51,2.86,z);box(16,.38,68,0x47756e,51,5.46,36);yield;
 for(const z of[11,22,47,60])box(.14,2.25,6.6,0x58757b,43.43,2.5,z);label(path.restName,43.32,4.65,36,18,1.05);yield;for(const z of[16.6,19,21.4]){box(.65,.1,2,0x927a59,53,.85,z);box(.1,.65,2,0x7c684f,53.3,1.14,z);for(const dz of[-.75,.75])box(.5,.38,.12,0x556a5d,53,.65,z+dz);}label('F · 休息片刻',54.4,2.2,19,5,.7);box(.18,2.8,10,0x6a7c72,57.9,2.1,48);label('秋月的不知名存档',57.78,2.5,48,9,1);label('F · 阅读原站与作品入口',57.77,1.3,48,9,.65);yield;
 for(const z of[-97,-89])box(.1,2.6,.1,0x718383,40,1.3,z,'wall','furniture');label('停车 / 加油 / 休息',40,3.1,-93,12,1);for(const z of[92,100])box(.1,2.5,.1,0x718383,40,1.25,z,'wall','furniture');label(path.exitLabel,40,3.0,96,10,1,Math.PI/2);yield;
 for(const z of[-102,0,96]){box(.14,5.8,.14,0x718383,40,2.9,z);box(1.6,.18,.5,0xe6d9a7,39.3,5.8,z,null,'furniture');yield;}
 if(prepareSlice)yield*prepareSlice(group);root.updateMatrixWorld(true);group.userData.serviceReady=true;
}
