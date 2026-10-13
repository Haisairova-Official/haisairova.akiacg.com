import {batchStaticVisuals} from './mesh-batching.js?rev=world21d';
import {approachTurretYaw} from './bt7-controls.mjs?rev=world21d';
// Original 1935 BT-7 visual model, metres. Historical shape references are
// documented separately; small fittings/armour facets are photographic estimates.
export function createBT7(T,spec,{color=0x63734c}={}){
 const car=new T.Group(),body=new T.Group(),wheels=[];car.add(body);Object.assign(car.userData,{kind:'bt7',body,wheels,rollAngle:0});
 const mat=(c,r=.8,m=.15)=>new T.MeshStandardMaterial({color:c,roughness:r,metalness:m,side:T.DoubleSide}),paint=mat(color),edge=mat(0x455238),rubber=mat(0x20251e,.98,0),steel=mat(0x465049,.85,.45),dark=mat(0x19211c),glass=mat(0xaab5a0,.35,.1);
 paint.userData.paintRole='body';
 const mesh=(g,m,parent=body)=>{const o=new T.Mesh(g,m);o.castShadow=o.receiveShadow=true;parent.add(o);return o;},box=(w,h,d,m,x,y,z,parent=body)=>{const o=mesh(new T.BoxGeometry(w,h,d),m,parent);o.position.set(x,y,z);return o;},cylinder=(r1,r2,h,m,x,y,z,parent=body,n=24)=>{const o=mesh(new T.CylinderGeometry(r1,r2,h,n),m,parent);o.position.set(x,y,z);return o;};
 function hull(rows,m=paint,parent=body){const vertices=[],ix=[];for(const[z,lower,upper,half,topHalf]of rows)vertices.push(-half,lower,z,half,lower,z,half,upper,z,topHalf,upper+.025,z,-topHalf,upper+.025,z,-half,upper,z);for(let i=0;i<rows.length-1;i++)for(let j=0;j<6;j++){const a=i*6+j,b=i*6+(j+1)%6,c=a+6,d=b+6;ix.push(a,b,c,b,d,c);}for(const k of[0,(rows.length-1)*6])for(let j=1;j<5;j++)ix.push(k,k+j,k+j+1);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(ix);const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return mesh(flat,m,parent);}
 // Narrow central bow with a rolled-under lower nose, not a thin flat beak.
 // Photographic shape refinement; axle layout and physical hull are unchanged.
 hull([[-2.80,.53,1.16,.71,.67],[-2.34,.42,1.28,.86,.81],[-.25,.42,1.38,.87,.81],[.90,.45,1.27,.83,.72],[1.45,.48,1.10,.70,.62],[2.10,.435,.90,.57,.53],[2.39,.455,.80,.505,.475],[2.54,.49,.755,.48,.457],[2.64,.54,.715,.47,.451],[2.70,.59,.68,.463,.448],[2.72,.627,.65,.46,.446]]);
 // Continuous crew roof supports the turret ring; the rear bustle overhangs
 // the lower engine deck, but the ring itself must never float above the hull.
 hull([[-.72,1.25,1.455,.80,.76],[.74,1.20,1.455,.76,.70],[1.03,1.10,1.36,.65,.60]]);
 hull([[.58,1.21,1.48,.49,.44],[1.32,1.13,1.47,.49,.44],[1.64,.99,1.05,.45,.41]]);
 box(.52,.19,.035,edge,0,1.365,1.393);box(.38,.043,.042,dark,0,1.37,1.416);
 const engineCover=box(1.54,.055,1.54,edge,0,1.36,-1.42);for(let i=0;i<12;i++)box(1.39,.025,.025,dark,0,1.402,-2.12+i*.119);

 // Thin flared front wings turn downward around the nose. Cross-sections remain
 // inside the configured 2.23m overall width; they do not steer with the wheels.
 function frontWing(side){
  const rows=[[1.20,.69,1.095,1.145],[1.80,.61,1.11,1.145],[2.20,.60,1.115,1.13],[2.45,.63,1.115,1.085],[2.64,.685,1.11,.965],[2.76,.735,1.08,.815],[2.80,.77,1.045,.74]],rings=[];
  const blend=(a,b,c,d,t)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
  for(let k=0;k<rows.length-1;k++)for(let j=0;j<7;j++){const t=j/7,a=rows[Math.max(0,k-1)],b=rows[k],c=rows[k+1],d=rows[Math.min(rows.length-1,k+2)],z=b[0]+(c[0]-b[0])*t,v=[0,1,2,3].map(n=>n?Math.max(Math.min(b[n],c[n]),Math.min(Math.max(b[n],c[n]),blend(a[n],b[n],c[n],d[n],t))):z);rings.push(v);}rings.push(rows.at(-1));
  const vertices=[],faces=[];for(const[z,inside,outside,y]of rings)vertices.push(side*inside,y,z,side*outside,y-.015,z,side*outside,y-.040,z,side*inside,y-.025,z);
  for(let i=1;i<rings.length;i++)for(let k=0;k<4;k++){const a=(i-1)*4+k,b=(i-1)*4+(k+1)%4,c=i*4+k,d=i*4+(k+1)%4;faces.push(a,b,c,b,d,c);}for(const k of[0,(rings.length-1)*4])faces.push(k,k+1,k+2,k,k+2,k+3);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(faces);const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();const o=mesh(flat,paint);o.userData.modelPart='flared-front-wing';return o;
 }
 for(const side of[-1,1]){
  box(.28,.045,3.70,paint,side*.97,1.12,-.635);box(.025,.095,3.70,edge,side*1.095,1.09,-.59);
  frontWing(side);
  box(.29,.05,.56,paint,side*.97,1.06,-2.52).rotation.x=-.35;
  box(.23,.16,1.16,paint,side*.91,1.255,-1.55);
  const exhaust=cylinder(.085,.085,.70,steel,side*.61,1.20,-2.46);exhaust.rotation.x=Math.PI/2;
  cylinder(.019,.019,.14,paint,side*.68,1.10,1.83);
  const light=cylinder(.095,.095,.085,dark,side*.68,1.21,1.84);light.rotation.x=Math.PI/2;
  const lens=cylinder(.074,.074,.006,glass,side*.68,1.21,1.886);lens.rotation.x=Math.PI/2;
  for(const axle of spec.physical.axles){const pivot=new T.Group(),spin=new T.Group();pivot.position.set(side*.98,.415,axle.z);pivot.add(spin);car.add(pivot);const tyre=cylinder(.415,.415,.19,rubber,0,0,0,spin);tyre.rotation.z=Math.PI/2;const disk=cylinder(.357,.357,.202,paint,0,0,0,spin,32);disk.rotation.z=Math.PI/2;const rim=mesh(new T.TorusGeometry(.341,.015,6,32),edge,spin);rim.rotation.y=Math.PI/2;rim.position.x=side*.108;const hub=cylinder(.074,.092,.23,paint,0,0,0,spin,16);hub.rotation.z=Math.PI/2;for(let k=0;k<8;k++){const a=k*Math.PI/4,b=cylinder(.014,.014,.012,edge,side*.118,Math.cos(a)*.20,Math.sin(a)*.20,spin,6);b.rotation.z=Math.PI/2;}wheels.push({pivot,spin,front:axle.z>1,radius:.415,side});}
  for(const[z,r]of[[2.35,.275],[-2.4,.32]]){const idler=cylinder(r,r,.21,paint,side*.98,.65,z,car);idler.rotation.z=Math.PI/2;const hub=cylinder(r*.30,r*.30,.225,edge,side*.98,.65,z,car,12);hub.rotation.z=Math.PI/2;}
 }
 // Forward turret ring, cylindrical fighting compartment and real rear bustle.
 const turret=new T.Group();turret.position.set(0,1.47,.55);body.add(turret);car.userData.turretPivot=turret;
 cylinder(.69,.72,.095,edge,0,.02,0,turret,32);cylinder(.665,.68,.72,paint,0,.405,0,turret,32);
 box(1.11,.56,.99,paint,0,.44,-.79,turret);box(1.12,.035,1.0,edge,0,.745,-.79,turret);
 cylinder(.265,.265,.055,paint,.12,.798,-.12,turret,24);box(.16,.09,.14,edge,.15,.86,-.12,turret);
 cylinder(.095,.095,.18,edge,-.23,.87,.19,turret,16);cylinder(.13,.13,.04,paint,-.23,.975,.19,turret,16);
 const shield=box(.43,.38,.25,edge,0,.39,.71,turret);shield.rotation.x=.04;
 // Historical exterior barrel only. No firing, ballistic or combat behaviour.
 for(const[r,length,at,m]of[[.091,.48,.995,paint],[.053,1.11,1.765,steel]]){const tube=cylinder(r,r,length,m,0,.41,at,turret,16);tube.rotation.x=Math.PI/2;}
 const muzzle=cylinder(.039,.039,.005,dark,0,.41,2.323,turret,16);muzzle.rotation.x=Math.PI/2;
 for(const side of[-1,1]){for(let i=0;i<10;i++){const a=-Math.PI*.30+i*Math.PI*.13,rivet=cylinder(.013,.013,.016,edge,side*Math.abs(Math.cos(a))*.668,.41,Math.sin(a)*.668,turret,6);rivet.rotation.z=Math.PI/2;}}
 // 260mm shoes, eight 830mm road wheels. Pitch and small return-run sag are
 // visual fits to the 1935 references, not a suspension/track-link simulation.
 const belts=new T.Group(),stowed=new T.Group();car.add(belts);body.add(stowed);car.userData.tracks=belts;car.userData.stowedTracks=stowed;
 const profile=[];for(let i=0;i<=12;i++){const a=Math.PI/2-i*Math.PI/12;profile.push(new T.Vector3(0,.65+Math.sin(a)*.30,2.35+Math.cos(a)*.30));}for(let i=0;i<=18;i++)profile.push(new T.Vector3(0,.0285,1.65-3.42*i/18));for(let i=0;i<=12;i++){const a=-Math.PI/2-i*Math.PI/12;profile.push(new T.Vector3(0,.65+Math.sin(a)*.34,-2.4+Math.cos(a)*.34));}for(const[z,y]of[[-1.77,.858],[-1.15,.829],[-.55,.858],[0,.825],[.55,.858],[1.10,.827],[1.65,.858]])profile.push(new T.Vector3(0,y,z));
 // The load-bearing lower run is straight. Dense bottom controls prevent the
 // free Catmull span from sagging through the road; clamp numerical overshoot,
 // then resample by the corrected arc length so link speed stays continuous.
 const curve=new T.CatmullRomCurve3(profile,true,'centripetal'),rawCount=4096,sampleCount=1024,raw=[],arc=[0],point=new T.Vector3();
 for(let i=0;i<=rawCount;i++){curve.getPoint(i/rawCount,point);const p=point.clone();p.y=Math.max(.0285,p.y);raw.push(p);if(i)arc.push(arc[i-1]+p.distanceTo(raw[i-1]));}
 const length=arc.at(-1),route=new Float32Array((sampleCount+1)*6);let cursor=1;
 for(let i=0;i<=sampleCount;i++){const distance=i/sampleCount*length;while(cursor<rawCount&&arc[cursor]<distance)cursor++;point.copy(raw[cursor-1]).lerp(raw[cursor],(distance-arc[cursor-1])/(arc[cursor]-arc[cursor-1]));route.set([point.x,point.y,point.z,0,0,0],i*6);}
 for(let i=0;i<sampleCount;i++){const a=((i+sampleCount-1)%sampleCount)*6,b=((i+1)%sampleCount)*6;point.set(route[b]-route[a],route[b+1]-route[a+1],route[b+2]-route[a+2]).normalize();route.set([point.x,point.y,point.z],i*6+3);}route.set(route.subarray(0,6),sampleCount*6);
 const shoeHalfThickness=.0275,shoeHalfLength=(length/46+.012)/2,shoeGeometry=new T.BoxGeometry(.26,shoeHalfThickness*2,shoeHalfLength*2),shoes=new T.InstancedMesh(shoeGeometry,steel,92),pose=new T.Object3D(),phases={left:0,right:0};shoes.castShadow=shoes.receiveShadow=true;belts.add(shoes);
 function updateTracks(left=0,right=left){phases.left=left;phases.right=right;for(let side=0;side<2;side++)for(let i=0;i<46;i++){const phase=(i/46+(side?left:right)/length)%1,t=((phase+1)%1)*sampleCount,a=Math.floor(t),u=t-a,k=a*6;const at=j=>route[k+j]+(route[k+j+6]-route[k+j])*u,ty=at(4),tz=at(5),norm=Math.hypot(ty,tz),extent=(shoeHalfThickness*Math.abs(tz)+shoeHalfLength*Math.abs(ty))/norm;
   // A finite rigid shoe at the bend has a lower corner below its centreline.
   // Respect its full rotated envelope, without lifting the vehicle or wheels.
   pose.position.set((side?1:-1)*.98,Math.max(at(1),extent+.001),at(2));pose.rotation.set(-Math.atan2(ty,tz),0,0);pose.updateMatrix();shoes.setMatrixAt(side*46+i,pose.matrix);}shoes.instanceMatrix.needsUpdate=true;}
 car.userData.trackLoopLength=length;

 updateTracks();
 // One conservative bound covers every animated phase. A bound computed only
 // at the initial link positions can incorrectly cull a later moving shoe.
 const radius=Math.hypot(shoeHalfThickness,shoeHalfLength),trackBounds=new T.Box3();for(let i=0;i<=sampleCount;i++){const k=i*6;trackBounds.expandByPoint(new T.Vector3(-1.11,Math.max(route[k+1],radius+.001)-radius,route[k+2]-radius));trackBounds.expandByPoint(new T.Vector3(1.11,Math.max(route[k+1],radius+.001)+radius,route[k+2]+radius));}trackBounds.min.y=0;trackBounds.min.x-=1e-6;trackBounds.max.x+=1e-6;shoes.boundingBox=trackBounds;shoes.boundingSphere=trackBounds.getBoundingSphere(new T.Sphere());car.userData.updateTracks=updateTracks;car.userData.trackPhases=phases;
 for(const side of[-1,1])for(let row=0;row<3;row++)for(let i=0;i<5;i++)box(.26,.05,.24,steel,side*.97,1.39+row*.052,-1.85+i*.25,stowed);stowed.visible=false;
 for(const w of wheels)batchStaticVisuals(T,w.spin);batchStaticVisuals(T,turret);batchStaticVisuals(T,stowed);batchStaticVisuals(T,body,{exclude:new Set([turret,stowed])});batchStaticVisuals(T,car,{exclude:new Set([body,belts,...wheels.map(w=>w.pivot)])});
 return car;
}

export function createTurretFollower(T){const direction=new T.Vector3(),inverse=new T.Matrix4();return(car,camera,dt)=>{const pivot=car.userData.turretPivot;if(!pivot)return;car.updateMatrixWorld(true);camera.getWorldDirection(direction);inverse.copy(pivot.parent.matrixWorld).invert();direction.transformDirection(inverse);pivot.rotation.y=approachTurretYaw(pivot.rotation.y,Math.atan2(direction.x,direction.z),dt);};}
