import {createMovingObstacleSet} from './moving-obstacles.mjs?rev=world21d';
import {solveParkingContacts,clearParkingContacts} from './parking-contact.mjs?rev=world21d';
import {createActorProximity} from './spatial-proximity.mjs?rev=world21d';
import {vehicleBodies} from './vehicle-footprint.mjs?rev=world21d';
import {fleetSpec} from './fleet-specs.mjs?rev=world21d';
import {wheelLayout} from './wheel-layout.mjs?rev=world21d';
// Rapier handles all chassis pose integration and rigid contacts. The four ray
// wheels apply suspension, drive and combined-grip impulses to that same body.
import R from './vendor/rapier-0.19.3.mjs';
import {vehicleSpec} from './vehicle-specs.mjs?rev=world21d';
import {powertrainSpec} from './powertrain-specs.mjs?rev=world21d';
await R.init();
export {R};
export const rotate=(q,v)=>{const tx=2*(q.y*v.z-q.z*v.y),ty=2*(q.z*v.x-q.x*v.z),tz=2*(q.x*v.y-q.y*v.x);return{x:v.x+q.w*tx+q.y*tz-q.z*ty,y:v.y+q.w*ty+q.z*tx-q.x*tz,z:v.z+q.w*tz+q.x*ty-q.y*tx};};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
export function physicalProperties(kind,tuning='arcade'){
 const p=vehicleSpec(kind),e=powertrainSpec(kind,tuning),f=fleetSpec(kind)?.physical,m=e.mass,h=f?.cgHeight??(kind==='chr'?.66:.54);
 return{...p,mass:m,cgHeight:h,cgForward:p.wheelbase*.1,radius:e.tyreRadius,
 inertia:{x:m*(p.length*p.length+p.height*p.height)/12*.8,y:m*(p.length*p.length+p.width*p.width)/12*.85,z:m*(p.width*p.width+p.height*p.height)/12*.85},
 suspensionRest:.3,suspensionSag:.06,mu:1.00,corneringStiffness:kind==='chr'?43000:33000,...f,radius:kind==='bt7'?.415:e.tyreRadius};
}
const contexts=new WeakMap();
export function contextFor(s){return contexts.get(s);}
export function releaseRigid(s){const c=contexts.get(s);if(c){c.world.free();c.events.free();contexts.delete(s);}}
export function fitsVehicle(s,kind){const c=contexts.get(s);if(!c)return true;let clear=true;
 for(const box of vehicleBodies({...s,trailer:undefined},kind)){const q={x:0,y:Math.sin(box.heading/2),z:0,w:Math.cos(box.heading/2)},pos={x:box.x,y:box.y+box.height/2+.1,z:box.z};c.world.intersectionsWithShape(c.toLocal(pos),q,new R.Cuboid(box.width/2+.10,box.height/2-.1,box.length/2+.15),col=>{if(!c.owned.has(col.handle)&&['wall','traffic'].includes(c.tags.get(col.handle)))clear=false;return clear;});}
 return clear;
}
export function stopRigid(s){const c=contexts.get(s);if(c)for(const u of c.units){u.body.setLinvel({x:0,y:0,z:0},true);u.body.setAngvel({x:0,y:0,z:0},true);}}
export function rightRigid(s){const c=contexts.get(s);if(!c)return;
 // Choose the nearest same-layer upward ground, not the first roof/upper bridge.
 const origin={x:s.x,y:(s.roadY||0)+12,z:s.z},hits=[];
 c.world.intersectionsWithRay(new R.Ray(c.toLocal(origin),{x:0,y:-1,z:0}),30,false,hit=>{const y=origin.y-hit.timeOfImpact-.22;if(hit.normal.y>.45&&Math.abs(y-(s.roadY||0))<3)hits.push(y);return true;},R.QueryFilterFlags.EXCLUDE_DYNAMIC,undefined,undefined,c.body,col=>c.tags.get(col.handle)==='ground');
 if(hits.length)s.roadY=hits.sort((a,b)=>Math.abs(a-(s.roadY||0))-Math.abs(b-(s.roadY||0)))[0];
 c.reposition(s,.10);s.chassisY=s.roadY+.32;
}
export function createRigidContext(s,options={},boxes=[]){
 const prop=physicalProperties(s.vehicle,s.tuning),world=new R.World({x:0,y:-9.81,z:0}),events=new R.EventQueue(true);world.timestep=1/120;world.integrationParameters.numSolverIterations=8;world.integrationParameters.maxCcdSubsteps=4;
 const originWorld={x:Math.round(s.x/256)*256,z:Math.round(s.z/256)*256},toLocal=p=>({...p,x:p.x-originWorld.x,z:p.z-originWorld.z}),toWorld=p=>({...p,x:p.x+originWorld.x,z:p.z+originWorld.z});
 const owned=new Set(),tags=new Map(),fleet=fleetSpec(s.vehicle),units=[];
 function unit(p,isTrailer=false){
  const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setCanSleep(false).setCcdEnabled(true).setAngularDamping(.18).setAdditionalMassProperties(p.mass,{x:0,y:0,z:0},p.inertia,{x:0,y:0,z:0,w:1}));
  const chassis=(hx,hy,hz,y,z)=>{const col=world.createCollider(R.ColliderDesc.cuboid(hx,hy,hz).setTranslation(0,y-p.cgHeight,z-p.cgForward).setDensity(0).setCollisionGroups((1<<16)|(fleet?.trailer?15:14)).setFriction(.35).setRestitution(.08).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS|R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(p.mass*3),body);owned.add(col.handle);};
  if(isTrailer){chassis(p.width*.49,.11,p.length*.5,1.46,0);chassis(p.width*.48,(p.height-1.57)/2,p.length*.49,(p.height+1.57)/2,0);}
  else if(s.vehicle==='dayun'){chassis(.96,.18,3.4,.95,0);chassis(1.22,1.2,1.25,2.3,1.9);}
  else if(s.vehicle==='bt7'){chassis(1.10,.44,2.75,.94,0);chassis(.68,.51,.93,1.99,.20);}
  else{chassis(p.width*.49,.29,p.length*.49,.60,0);chassis(p.width*.41,(p.height-.89)/2,p.length*.26,(p.height+.89)/2,-.17);}
  const vehicle=world.createVehicleController(body);vehicle.indexUpAxis=1;vehicle.setIndexForwardAxis=2;
  const wheels=wheelLayout(s.vehicle,p,{trailer:isTrailer,driveMode:s.driveMode});
  for(const w of wheels){const i=vehicle.numWheels();vehicle.addWheel({x:w.x,y:p.radius+p.suspensionRest-p.suspensionSag-p.cgHeight,z:w.z-p.cgForward},{x:0,y:-1,z:0},{x:-1,y:0,z:0},p.suspensionRest,p.radius);
   vehicle.setWheelSuspensionStiffness(i,w.referenceLoad/(p.mass*p.suspensionSag));vehicle.setWheelSuspensionCompression(i,4.3*4/wheels.length);vehicle.setWheelSuspensionRelaxation(i,5*4/wheels.length);vehicle.setWheelMaxSuspensionTravel(i,p.suspensionRest*.6);vehicle.setWheelMaxSuspensionForce(i,fleet?w.referenceLoad*4:p.mass*9.81*1.5);vehicle.setWheelFrictionSlip(i,p.mu);vehicle.setWheelSideFrictionStiffness(i,1);
  }
  const u={body,vehicle,prop:p,wheels,trailer:isTrailer};units.push(u);return u;
 }
 const primary=unit(prop),{body,vehicle}=primary;
 let hitch=null;
 if(fleet?.trailer){const t=fleet.trailer,m=t.mass,pr={...prop,...t,cgForward:t.cgForward,suspensionRest:.36,suspensionSag:.09,mu:.86,corneringStiffness:95000,inertia:{x:m*(t.length**2+t.height**2)/12*.8,y:m*(t.length**2+t.width**2)/12*.85,z:m*(t.width**2+t.height**2)/12*.85}};const trailer=unit(pr,true);
  const local=(a,p)=>({x:a.x,y:a.y-p.cgHeight,z:a.z-p.cgForward});
  hitch=world.createImpulseJoint(R.JointData.generic(local(t.hitch.tractor,prop),local(t.hitch.trailer,pr),{x:0,y:0,z:1},R.JointAxesMask.LinX|R.JointAxesMask.LinY|R.JointAxesMask.LinZ|R.JointAxesMask.AngX),body,trailer.body,true);hitch.setContactsEnabled(true);
 }
 const surfaces=new Map(),npcs=new Map(),boundsCache=new WeakMap();let revision='',last=null,standaloneFloor=null,actorProximity=null;
 if(!options.scene){standaloneFloor=world.createCollider(R.ColliderDesc.cuboid(100000,.1,100000).setCollisionGroups((4<<16)|1).setTranslation(0,(s.roadY||0)+.12,0));tags.set(standaloneFloor.handle,'ground');}

 for(const b of options.scene?[]:boxes){const col=world.createCollider(R.ColliderDesc.cuboid(b.w/2,b.h||5,b.d/2).setCollisionGroups((8<<16)|3).setTranslation(b.x-originWorld.x,b.h||5,b.z-originWorld.z).setFriction(.22).setRestitution(.08));tags.set(col.handle,'wall');}
 const c={world,body,vehicle,units,hitch,originWorld,toLocal,toWorld,rebases:0,
 rebaseIfNeeded(){const p=body.translation();if(Math.max(Math.abs(p.x),Math.abs(p.z))<384)return false;const dx=Math.round(p.x/256)*256,dz=Math.round(p.z/256)*256;
  world.forEachRigidBody(b=>{const p=b.translation(),next=b.isKinematic()?b.nextTranslation():null;b.setTranslation({x:p.x-dx,y:p.y,z:p.z-dz},false);if(next)b.setNextKinematicTranslation({x:next.x-dx,y:next.y,z:next.z-dz});});
  world.forEachCollider(col=>{if(col.parent())return;const p=col.translation();col.setTranslation({x:p.x-dx,y:p.y,z:p.z-dz});});
  for(const u of units)for(const a of u.parkingAnchors||[])if(a){a.point.x-=dx;a.point.z-=dz;}originWorld.x+=dx;originWorld.z+=dz;c.rebases++;return true;
 },spatialStreaming:!!options.spatialStreaming,sceneActors:options.traffic||[],driveMode:s.driveMode,systemMass:units.reduce((a,u)=>a+u.prop.mass,0),events,prop,kind:s.vehicle,tuning:s.tuning,owned,tags,npcs,surfaces,contacts:new Set(),lastPublic:null,
 reposition(state,lift=0,pose=null){for(const unit of units)clearParkingContacts(unit);
  const q=pose?.quaternion||{x:0,y:Math.sin(state.heading/2),z:0,w:Math.cos(state.heading/2)},off=rotate(q,{x:0,y:prop.cgHeight,z:prop.cgForward}),origin={x:state.x-originWorld.x,y:pose&&Number.isFinite(pose.chassisY)?pose.chassisY:(state.roadY||0)+.22+lift,z:state.z-originWorld.z};
  body.setRotation(q,true);body.setTranslation({x:origin.x+off.x,y:origin.y+off.y,z:origin.z+off.z},true);
  if(units.length>1){const u=units[1],heading=state.trailer?.heading??state.heading,tq={x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)},h=rotate(q,fleet.trailer.hitch.tractor),a=rotate(tq,fleet.trailer.hitch.trailer),o=rotate(tq,{x:0,y:u.prop.cgHeight,z:u.prop.cgForward});u.body.setRotation(tq,true);u.body.setTranslation({x:origin.x+h.x-a.x+o.x,y:origin.y+h.y-a.y+o.y,z:origin.z+h.z-a.z+o.z},true);}
  for(const u of units){u.body.setLinvel({x:state.vx||Math.sin(state.heading)*(state.speed||0),y:0,z:state.vz||Math.cos(state.heading)*(state.speed||0)},true);u.body.setAngvel({x:0,y:0,z:0},true);}
  c.lastPublic={x:state.x,z:state.z,speed:state.speed};c.contacts.clear();
 },
 isSceneMeshNear(mesh){
  if(!c.spatialStreaming)return true;
  const p=mesh.geometry.attributes.position,m=mesh.matrixWorld.elements;let cached=boundsCache.get(mesh);
  if(!cached||cached.geometry!==mesh.geometry||cached.version!==p.version||m.some((v,i)=>v!==cached.matrix[i])){
   mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox,lo={x:Infinity,z:Infinity},hi={x:-Infinity,z:-Infinity};
   for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z]){const wx=m[0]*x+m[4]*y+m[8]*z+m[12],wz=m[2]*x+m[6]*y+m[10]*z+m[14];lo.x=Math.min(lo.x,wx);lo.z=Math.min(lo.z,wz);hi.x=Math.max(hi.x,wx);hi.z=Math.max(hi.z,wz);}
   cached={geometry:mesh.geometry,version:p.version,matrix:m.slice(),lo,hi};boundsCache.set(mesh,cached);
  }
  const near=(p,r)=>{const dx=Math.max(cached.lo.x-p.x,0,p.x-cached.hi.x),dz=Math.max(cached.lo.z-p.z,0,p.z-cached.hi.z);return dx*dx+dz*dz<r*r;},margin=surfaces.get(mesh)?.enabled?60:0;
  if(near(s,220+margin))return true;if(actorProximity)return actorProximity(cached.lo,cached.hi,margin);for(const t of c.sceneActors){if(near(t.physical||t,100+margin))return true;const trailer=t.physical?.trailer||t.trailerPose;if(trailer&&near(trailer,100+margin))return true;}return false;
 },
 ensureSceneMesh(mesh,enabled,force=false){const kind=mesh.userData.driveCollider;
   const p=mesh.geometry.attributes.position,index=mesh.geometry.index,m=mesh.matrixWorld.elements,geometryId=mesh.geometry.id,positionVersion=p.version;let entry=surfaces.get(mesh);
   if(!enabled&&!force){if(entry?.enabled){entry.collider.setEnabled(false);entry.topCollider?.setEnabled(false);entry.enabled=false;}return entry;} // Never import hidden, unallocated distant pool geometry.
   if(!entry||entry.geometryId!==geometryId||entry.positionVersion!==positionVersion||m.some((v,i)=>v!==entry.matrix[i])){const v=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);v[i*3]=m[0]*x+m[4]*y+m[8]*z+m[12]-originWorld.x;v[i*3+1]=m[1]*x+m[5]*y+m[9]*z+m[13];v[i*3+2]=m[2]*x+m[6]*y+m[10]*z+m[14]-originWorld.z;}const ids=index?Uint32Array.from(index.array):Uint32Array.from({length:p.count},(_,i)=>i);
    if(entry)for(const col of [entry.collider,entry.topCollider].filter(Boolean)){tags.delete(col.handle);world.removeCollider(col,false);}
    // Bridge-box driving top is a ground surface, while sides, soffit and
    // end faces remain solid walls. NPCs follow road height and must not fight
    // their height controller against a duplicated sloping deck top.
    const topFaces=new Set(mesh.userData.driveTopTriangles||[]),wallIds=topFaces.size?Uint32Array.from(Array.from(ids).filter((_,i)=>!topFaces.has(Math.floor(i/3)))):ids;
    const collider=world.createCollider(R.ColliderDesc.trimesh(v,wallIds).setCollisionGroups(kind==='wall'?(8<<16)|3:(4<<16)|1).setFriction(kind==='wall'?.22:.95).setRestitution(kind==='wall'?.08:0));tags.set(collider.handle,kind);entry={collider,geometryId,positionVersion,matrix:m.slice()};
    if(topFaces.size){const topIds=Uint32Array.from(Array.from(ids).filter((_,i)=>topFaces.has(Math.floor(i/3))));entry.topCollider=world.createCollider(R.ColliderDesc.trimesh(v,topIds).setCollisionGroups((4<<16)|1).setFriction(.95));tags.set(entry.topCollider.handle,'ground');}surfaces.set(mesh,entry);
   }if(entry.enabled!==enabled){entry.collider.setEnabled(enabled);entry.topCollider?.setEnabled(enabled);entry.enabled=enabled;}return surfaces.get(mesh);},
 syncScene(scene,key,mode){for(const _ of this.prepareScene(scene,key,mode)){}},
 *prepareScene(scene,key,mode){
  if(!scene||key===revision)return;scene.updateMatrixWorld(true);actorProximity=c.spatialStreaming?createActorProximity(c.sceneActors):null;try{const seen=new Set();
  const meshes=[];scene.traverse(mesh=>{if(mesh.userData?.driveCollider&&mesh.geometry&&mesh.geometry.attributes.position?.count>=3)meshes.push(mesh);});
  for(const mesh of meshes){const kind=mesh.userData.driveCollider;
   seen.add(mesh);let enabled=mesh.visible||!!mesh.userData.collisionOnly;for(let a=mesh.parent;a;a=a.parent)if(!a.visible)enabled=false;
   enabled&&=this.isSceneMeshNear(mesh);this.ensureSceneMesh(mesh,enabled);yield mesh;
  }for(const [mesh,entry]of surfaces)if(!seen.has(mesh)){for(const col of [entry.collider,entry.topCollider].filter(Boolean)){tags.delete(col.handle);c.contacts.delete(col.handle);world.removeCollider(col,false);}surfaces.delete(mesh);yield mesh;}revision=key;}finally{actorProximity=null;}
 },
 syncTraffic(cars,dt){for(const t of cars||[]){let n=npcs.get(t.id);
  if(!n){const width=t.width||1.65,length=t.length||3.65,height=t.height||1.36,mass=t.mass||1100,I=mass*(width*width+length*length)/12;
   const make=(w,l,h,m,clearance=.24)=>{const rb=world.createRigidBody(R.RigidBodyDesc.dynamic().setGravityScale(0).setCanSleep(false).setCcdEnabled(true).setAdditionalMassProperties(m,{x:0,y:0,z:0},{x:m*(l*l+h*h)/12,y:m*(w*w+l*l)/12,z:m*(w*w+h*h)/12},{x:0,y:0,z:0,w:1}).enabledRotations(false,true,false));const col=world.createCollider(R.ColliderDesc.cuboid(w/2,(h-clearance)/2,l/2).setTranslation(0,clearance/2,0).setDensity(0).setCollisionGroups((2<<16)|11).setFriction(.25).setRestitution(.08),rb);tags.set(col.handle,'traffic');return rb;};
   const rb=make(width,length,height,mass,t.trailer?.70:.24);n={body:rb,mass,inertia:I,height,generation:-1,car:t,cooldown:0};
   if(t.trailer){const a=t.trailer,nrb=make(a.width,a.length,a.height,a.mass,1.40);n.trailerBody=nrb;n.trailerHeight=a.height;const joint=world.createImpulseJoint(R.JointData.revolute({x:0,y:1.25-height/2,z:a.tractorHitchZ},{x:0,y:1.25-a.height/2,z:a.hitchZ},{x:0,y:1,z:0}),rb,nrb,true);joint.setContactsEnabled(false);}
   npcs.set(t.id,n);
  }
  const rb=n.body,q={x:0,y:Math.sin(t.heading/2),z:0,w:Math.cos(t.heading/2)},velocity={x:Math.sin(t.heading)*t.velocity,y:0,z:Math.cos(t.heading)*t.velocity};
  if(n.generation!==t.generation){rb.setTranslation({x:t.x-originWorld.x,y:t.y+.22+n.height/2,z:t.z-originWorld.z},true);rb.setRotation(q,true);rb.setLinvel(velocity,true);rb.setAngvel({x:0,y:0,z:0},true);if(n.trailerBody){const p=t.trailerPose||t;n.trailerBody.setTranslation({x:p.x-originWorld.x,y:p.y+.22+n.trailerHeight/2,z:p.z-originWorld.z},true);n.trailerBody.setRotation({x:0,y:Math.sin(p.heading/2),z:0,w:Math.cos(p.heading/2)},true);n.trailerBody.setLinvel(velocity,true);n.trailerBody.setAngvel({x:0,y:0,z:0},true);}n.generation=t.generation;n.targetVelocity=t.velocity;}
  const alignRoad=(b,grade)=>{const f=rotate(b.rotation(),{x:0,y:0,z:1}),h=Math.atan2(f.x,f.z)/2,p=-Math.atan(grade||0)/2;b.setRotation({x:Math.sin(p)*Math.cos(h),y:Math.cos(p)*Math.sin(h),z:-Math.sin(p)*Math.sin(h),w:Math.cos(p)*Math.cos(h)},false);};
  const pos=rb.translation(),vel=rb.linvel();if(!n.trailerBody)alignRoad(rb,t.grade);rb.setTranslation({x:pos.x,y:t.y+.22+n.height/2,z:pos.z},false);n.cooldown=Math.max(0,n.cooldown-dt);
  if(!n.cooldown){const total=n.mass+(t.trailer?.mass||0),target={x:velocity.x+(t.x-originWorld.x-pos.x)*2,z:velocity.z+(t.z-originWorld.z-pos.z)*2};const f=rotate(rb.rotation(),{x:0,y:0,z:1}),right={x:f.z,z:-f.x},dv={x:target.x-vel.x,z:target.z-vel.z},feedForward=clamp((t.velocity-(n.targetVelocity??t.velocity))/dt,-(t.braking||8),5),longitudinal=clamp(feedForward+(dv.x*f.x+dv.z*f.z)*3,-(t.braking||8),5),lateral=clamp((dv.x*right.x+dv.z*right.z)*3,-8,8);rb.applyImpulse({x:(f.x*longitudinal+right.x*lateral)*total*dt,y:0,z:(f.z*longitudinal+right.z*lateral)*total*dt},true);const angle=Math.atan2(Math.sin(t.heading-Math.atan2(f.x,f.z)),Math.cos(t.heading-Math.atan2(f.x,f.z)));rb.applyTorqueImpulse({x:0,y:clamp(angle*16-rb.angvel().y*6,-12,12)*n.inertia*dt,z:0},true);}
  n.targetVelocity=t.velocity;t.physical={generation:t.generation,contactCooldown:n.cooldown,velocity:vel.x*Math.sin(t.heading)+vel.z*Math.cos(t.heading),vx:vel.x,vz:vel.z,x:pos.x+originWorld.x,z:pos.z+originWorld.z,y:t.y,heading:Math.atan2(rotate(rb.rotation(),{x:0,y:0,z:1}).x,rotate(rb.rotation(),{x:0,y:0,z:1}).z)};
  if(n.trailerBody){
   // The freely hinged trailer still has tyres: a lateral contact impulse at
   // its axle group resists sideslip without prescribing yaw or position.
   const axleGrip=(rb,z,m,I,normal)=>{const q=rb.rotation(),r=rotate(q,{x:0,y:0,z}),side=rotate(q,{x:1,y:0,z:0}),v=rb.linvel(),w=rb.angvel(),at=cross(w,r),speed=(v.x+at.x)*side.x+(v.z+at.z)*side.z,lever=r.z*side.x-r.x*side.z,impulse=clamp(-speed/(1/m+lever*lever/I),-.86*normal*9.81*dt,.86*normal*9.81*dt),pos=rb.translation();rb.applyImpulseAtPoint({x:side.x*impulse,y:0,z:side.z*impulse},{x:pos.x+r.x,y:pos.y,z:pos.z+r.z},true);};
   axleGrip(rb,-1.875,n.mass,n.inertia,n.mass*.75);const a=n.trailerBody;axleGrip(a,t.trailer.axleZ,t.trailer.mass,t.trailer.mass*(t.trailer.width**2+t.trailer.length**2)/12,t.trailer.mass*.52);
   const ap=a.translation(),aq=a.rotation(),af=rotate(aq,{x:0,y:0,z:1});a.setTranslation({x:ap.x,y:t.y+.22+n.trailerHeight/2,z:ap.z},false);a.applyTorqueImpulse({x:0,y:-a.angvel().y*t.trailer.mass*dt*.2,z:0},true);t.physical.trailer={x:ap.x+originWorld.x,z:ap.z+originWorld.z,y:t.trailerPose?.y??t.y,heading:Math.atan2(af.x,af.z)};}
 }},
 integrate(state,drive,dt){
  state.rearGripLoss??=0;state.rearGripLoss+=(state.handbrakePressure-state.rearGripLoss)*(1-Math.exp(-dt/(state.handbrakePressure>state.rearGripLoss?.08:.55)));
  const primaryQ=body.rotation(),up=rotate(primaryQ,{x:0,y:1,z:0}),vel=body.linvel();
  state.tyreImpulses=[];const totalLoad=units.reduce((n,u)=>n+u.wheels.reduce((a,w,i)=>a+(u.vehicle.wheelSuspensionForce(i)||w.referenceLoad),0),0),foot=drive.parking?c.systemMass*10.5*state.brakePressure:Math.abs(drive.brakeForce||0);
  for(const unit of units){const {body,vehicle,prop,wheels}=unit;if(!drive.parking)clearParkingContacts(unit);unit.parkingBrakeCaps=drive.parking?[]:null;const q=body.rotation(),up=rotate(q,{x:0,y:1,z:0}),fwd=rotate(q,{x:0,y:0,z:1}),vel=body.linvel(),angular=body.angvel(),tracked=s.vehicle==='bt7'&&s.driveMode!=='wheels';
   const loads=wheels.map((w,i)=>vehicle.wheelSuspensionForce(i)||w.referenceLoad),sum=loads.reduce((a,b)=>a+b,0),frontBias=clamp((loads[0]+loads[1])/Math.max(1,sum),.55,.85),engine=drive.wheelForce||0,hand=state.handbrakePressure*prop.mass*7.5;
   for(let i=0;i<wheels.length;i++){const w=wheels[i],rear=!w.front,inner=tracked&&w.side===(state.steer>0?1:-1),trackTurn=tracked?Math.abs(state.steer):0;
    const direction=Math.abs(state.speed)>.1?Math.sign(state.speed):Math.sign(state.gear)||1,cut=clamp(trackTurn/.3,0,1),trackBrake=inner?loads[i]*.85*trackTurn+Math.max(0,-engine*w.drive*direction)*cut:0,driveForce=(drive.axleForces?(drive.axleForces[w.front?'front':'rear']||0)/2+(drive.regenWheelForces?.[i]??(drive.regenAxleForces?.[w.front?'front':'rear']||0)/2):engine*w.drive)*(inner?1-cut:1),axleBrake=foot*(fleet?loads[i]/Math.max(1,totalLoad):(rear?1-frontBias:frontBias)*.5),totalBrake=axleBrake+hand*w.parking+trackBrake,net=driveForce-totalBrake*direction,braking=(totalBrake>1||driveForce*direction<0)&&net*direction<0;
    // Rapier ignores brake while engineForce is nonzero. Resolve all driven-axle
    // service/parking/track braking into one signed force before choosing API.
    vehicle.setWheelEngineForce(i,w.drive&&!braking?net:0);vehicle.setWheelSteering(i,w.steer?state.wheelAngle:0);const brakeImpulse=(!w.drive?totalBrake:braking?Math.abs(net):0)*dt;if(drive.parking)unit.parkingBrakeCaps[i]=brakeImpulse;vehicle.setWheelBrake(i,drive.parking?0:brakeImpulse);vehicle.setWheelFrictionSlip(i,w.parking?prop.mu*(1-state.rearGripLoss*.30):prop.mu);vehicle.setWheelSideFrictionStiffness(i,(drive.parking?0:tracked?.55:1)*(w.parking?1-state.rearGripLoss*.78:1));
   }
   const force=(-(drive.roadLoad||0)-(drive.governorForce||0))*prop.mass/c.systemMass;body.applyImpulse({x:fwd.x*force*dt,y:fwd.y*force*dt,z:fwd.z*force*dt},true);
   vehicle.updateVehicle(dt,R.QueryFilterFlags.EXCLUDE_DYNAMIC);
  // Rapier/Bullet has already applied and jointly saturated both tyre axes.
  // Undo those tangential impulses before solving our load/slip tyre model:
  // trimming its lateral result alone leaves most braking grip unused in a turn.
  // Suspension impulses stay intact, and all final forces act at real contact
  // height (Bullet's internal lateral roll lever is only 10% of that height).
  const contacts=[],com=body.worldCom(),inverse=body.effectiveWorldInvInertia().elements;
  const inverseMassAt=(point,axis)=>{const lever=cross({x:point.x-com.x,y:point.y-com.y,z:point.z-com.z},axis),m=inverse;
   const I={x:m[0]*lever.x+m[1]*lever.y+m[2]*lever.z,y:m[1]*lever.x+m[3]*lever.y+m[4]*lever.z,z:m[2]*lever.x+m[4]*lever.y+m[5]*lever.z};
   return body.invMass()+lever.x*I.x+lever.y*I.y+lever.z*I.z;};
  for(let i=0;i<wheels.length;i++){
   if(!vehicle.wheelIsInContact(i)){contacts.push(null);continue;}
   const point=vehicle.wheelContactPoint(i),normal=vehicle.wheelContactNormal(i);
   const height=(point.x-com.x)*up.x+(point.y-com.y)*up.y+(point.z-com.z)*up.z,a=wheels[i].steer?state.wheelAngle:0,axle=rotate(q,{x:-Math.cos(a),y:0,z:Math.sin(a)});
   const projection=axle.x*normal.x+axle.y*normal.y+axle.z*normal.z;axle.x-=normal.x*projection;axle.y-=normal.y*projection;axle.z-=normal.z*projection;const length=Math.hypot(axle.x,axle.y,axle.z)||1;for(const k of ['x','y','z'])axle[k]/=length;
   const direction=cross(normal,axle),side=vehicle.wheelSideImpulse(i)||0,forward=vehicle.wheelForwardImpulse(i)||0;
   const torque=cross({x:up.x*height*.9,y:up.y*height*.9,z:up.z*height*.9},{x:axle.x*side,y:axle.y*side,z:axle.z*side});body.applyTorqueImpulse(torque,true);
   body.applyImpulseAtPoint({x:-axle.x*side-direction.x*forward,y:-axle.y*side-direction.y*forward,z:-axle.z*side-direction.z*forward},point,true);
   contacts.push({i,point,axle,direction});
  }
  const contactCount=Math.max(1,contacts.filter(Boolean).length),solved=[];
  for(const contact of contacts){
   if(!contact){state.tyreImpulses.push({forward:0,side:0,limit:0});continue;}
   const {i,point,axle,direction}=contact,atPoint=body.velocityAtPoint(point),vSide=atPoint.x*axle.x+atPoint.y*axle.y+atPoint.z*axle.z,vForward=atPoint.x*direction.x+atPoint.y*direction.y+atPoint.z*direction.z;
   const slipAngle=Math.atan2(vSide,Math.max(2,Math.abs(vForward))),load=Math.min(vehicle.wheelSuspensionForce(i)||0,vehicle.wheelMaxSuspensionForce(i));
   const sliding=.82+.18*Math.exp(-((slipAngle/.14)**2)),mu=prop.mu*sliding*(wheels[i].parking?1-state.rearGripLoss*.30:1),limit=mu*load*dt;
   const stiffness=prop.corneringStiffness*4/wheels.length*(tracked?.30:1)*Math.pow(load/wheels[i].referenceLoad,.85)*(wheels[i].parking?1-state.rearGripLoss*.78:1);
   const sideStop=Math.abs(vSide)/Math.max(1e-9,inverseMassAt(point,axle)*contactCount);
   const wantedSide=drive.parking?0:-Math.sign(vSide)*Math.min(stiffness*Math.abs(slipAngle)*dt,sideStop);
   // Near-stop rolling resistance belongs inside the same contact budget,
   // not an extra chassis impulse after the tyres have already saturated.
   const rollingBrake=!drive.parking&&state.throttle<.01&&Math.hypot(vel.x,vel.z)<.12?load*.018*dt:0;
   const brake=vehicle.wheelBrake(i)+rollingBrake,engineImpulse=vehicle.wheelEngineForce(i)*dt;
   const forwardStop=Math.abs(vForward)/Math.max(1e-9,inverseMassAt(point,direction)*contactCount);
   const wantedForward=engineImpulse-Math.sign(vForward)*Math.min(brake,forwardStop);
   const scale=Math.min(1,limit/Math.max(1e-9,Math.hypot(wantedSide,wantedForward))),actualSide=wantedSide*scale,actualForward=wantedForward*scale;
   solved.push({point,impulse:{x:axle.x*actualSide+direction.x*actualForward,y:axle.y*actualSide+direction.y*actualForward,z:axle.z*actualSide+direction.z*actualForward}});
   state.tyreImpulses.push({forward:actualForward,side:actualSide,limit,slipAngle,requestedForward:wantedForward,requestedSide:wantedSide});
  }

  // Evaluate demands together, then apply: wheel ordering must not bias yaw.
  for(const {point,impulse} of solved)body.applyImpulseAtPoint(impulse,point,true);

  }
  if(drive.parking)for(const unit of units)solveParkingContacts(unit,dt,world.gravity);
  // Shift after all tyre/contact impulses, before broad-phase rebuild. This
  // keeps ray queries, contact handles and velocities in one coherent frame.
  c.rebaseIfNeeded();world.timestep=dt;world.step(events);
  events.drainCollisionEvents((a,b,started)=>{const other=owned.has(a)?b:owned.has(b)?a:null;if(other===null||owned.has(other))return;const tag=tags.get(other);if(started&&!c.contacts.has(other)){c.contacts.add(other);if(tag==='wall'||tag==='traffic'||up.y<.7){state.collisions++;state.lastImpactTag=tag;state.lastImpact=Math.hypot(vel.x,vel.z);if(tag==='traffic')for(const n of npcs.values())if(n.body.collider(0).handle===other||n.trailerBody?.collider(0).handle===other)n.cooldown=1.2;}}else if(!started)c.contacts.delete(other);});
  c.read(state,dt);
 },
 read(state,dt){const pos=body.translation(),q=body.rotation(),v=body.linvel(),ang=body.angvel(),forward=rotate(q,{x:0,y:0,z:1}),up=rotate(q,{x:0,y:1,z:0}),right=rotate(q,{x:1,y:0,z:0}),off=rotate(q,{x:0,y:prop.cgHeight,z:prop.cgForward}),old=state.speed;
  state.x=pos.x-off.x+originWorld.x;state.z=pos.z-off.z+originWorld.z;state.chassisY=pos.y-off.y;state.quaternion={x:q.x,y:q.y,z:q.z,w:q.w};state.vx=v.x;state.vy=v.y;state.vz=v.z;state.groundSpeed=Math.hypot(v.x,v.z);state.speed=v.x*forward.x+v.y*forward.y+v.z*forward.z;state.slip=v.x*right.x+v.y*right.y+v.z*right.z;state.heading=Math.atan2(forward.x,forward.z);state.yawRate=ang.y;state.rolloverAngle=Math.atan2(-right.y,up.y);state.pitch=Math.atan2(-forward.y,Math.hypot(forward.x,forward.z));state.roll=0;state.rolled=up.y<.25;state.upY=up.y;state.angularVelocity={...ang};
  const forces=Array.from({length:primary.wheels.length},(_,i)=>Math.min(vehicle.wheelSuspensionForce(i)||0,vehicle.wheelMaxSuspensionForce(i)));state.wheelLoads=forces;state.wheelContacts=Array.from({length:primary.wheels.length},(_,i)=>!!vehicle.wheelIsInContact(i));state.suspensionLengths=Array.from({length:primary.wheels.length},(_,i)=>vehicle.wheelSuspensionLength(i));state.loadTransfer=forces.reduce((n,f,i)=>n+f*primary.wheels[i].side,0)/Math.max(1,forces.reduce((a,b)=>a+b,0));if(units.length>1){const u=units[1],b=u.body,tq=b.rotation(),tf=rotate(tq,{x:0,y:0,z:1}),o=rotate(tq,{x:0,y:u.prop.cgHeight,z:u.prop.cgForward}),p=b.translation();if(rotate(tq,{x:0,y:1,z:0}).y<.25)state.rolled=true;state.trailer={x:p.x-o.x+originWorld.x,y:p.y-o.y,z:p.z-o.z+originWorld.z,heading:Math.atan2(tf.x,tf.z),quaternion:{...tq},wheelLoads:u.wheels.map((w,i)=>u.vehicle.wheelSuspensionForce(i)||0),wheelContacts:u.wheels.map((w,i)=>u.vehicle.wheelIsInContact(i))};}else delete state.trailer;state.acceleration=(state.speed-old)/dt;state.lateralAcceleration=last?((v.x-last.x)*right.x+(v.y-last.y)*right.y+(v.z-last.z)*right.z)/dt:0;last={x:v.x,y:v.y,z:v.z};c.lastPublic={x:state.x,z:state.z,speed:state.speed};
 }
 };
 c.movingObstacles=createMovingObstacleSet(R,world,tags,toLocal,h=>c.contacts.delete(h));
 c.reposition(s,0,s.modeChangePose);delete s.modeChangePose;contexts.set(s,c);return c;
}
