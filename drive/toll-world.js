import {TOLL_LAYOUT} from './toll-layout.mjs?rev=world21d';
import {createTollLane,TOLL_TUNING} from './toll-control.mjs?rev=world21d';
import {vehicleBodies} from './vehicle-footprint.mjs?rev=world21d';
import {trafficBodies} from './traffic-fleet.mjs?rev=world21d';
// All measurements use the same directed road frame as the physical pavement.
export function tollActor(plaza,lane,id,bodies,speed){
 const p=plaza.point,fx=Math.sin(p.heading),fz=Math.cos(p.heading),nx=-fz,nz=fx;let front=-Infinity,back=Infinity,left=Infinity,right=-Infinity,height=0;
 for(const b of bodies){const dx=b.x-p.x,dz=b.z-p.z,at=dx*fx+dz*fz,side=dx*nx+dz*nz,dh=b.heading-p.heading,hl=(Math.abs(Math.cos(dh))*b.length+Math.abs(Math.sin(dh))*b.width)/2,hw=(Math.abs(Math.cos(dh))*b.width+Math.abs(Math.sin(dh))*b.length)/2;front=Math.max(front,at+hl);back=Math.min(back,at-hl);left=Math.min(left,side-hw);right=Math.max(right,side+hw);height=Math.max(height,b.height||1.5);}
 const b=bodies[0],centre=(b.x-p.x)*nx+(b.z-p.z)*nz,vertical=Math.abs((b.y||0)-p.y),overlap=right>lane.offset-lane.width/2&&left<lane.offset+lane.width/2,primary=Math.abs(centre-lane.offset)<=lane.width/2;
 return{id,front,back,speed,direction:primary?Math.cos(b.heading-p.heading):0,height,overlap:overlap&&vertical<2,centre};
}
export function createTollWorld(T,scene,{sign=()=>{},toast=()=>{}}={}){
 const root=new T.Group();root.name='toll-stations';scene.add(root);const stations=new Map(),limits=new Map(),geo=new T.BoxGeometry(1,1,1),mats=new Map(),qYaw=new T.Quaternion(),qArm=new T.Quaternion(),axisY=new T.Vector3(0,1,0),axisZ=new T.Vector3(0,0,1),tmp=new T.Vector3();let revision=0,lastNotice='';
 const mat=color=>{if(!mats.has(color))mats.set(color,new T.MeshStandardMaterial({color,roughness:.65}));return mats.get(color);};
 const box=(g,w,h,d,color,x,y,z,collider=true)=>{const m=new T.Mesh(geo,mat(color));m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;m.userData.cameraOccluderRole='structure';if(collider)m.userData.driveCollider='wall';g.add(m);return m;};
 function build(p){const group=new T.Group();group.name=p.id;group.position.set(p.point.x,p.point.y+.22,p.point.z);group.rotation.y=p.point.heading;root.add(group);group.userData.cameraRoadId=p.edgeId;
  // Two independent directions have separate roofs and entrance faces.
  box(group,14,.55,13,0x557f86,-3.1,TOLL_LAYOUT.canopyClearance+.275,-5);
  for(const x of [3.25,-2.85,-9.05])box(group,.35,TOLL_LAYOUT.canopyClearance,.35,0xd4ddd5,x,TOLL_LAYOUT.canopyClearance/2,-9);
  const island=box(group,2.15,.24,23,0xc6c9ae,-2.85,.12,-7.5);island.userData.structureType='toll-island';
  box(group,1.5,2.75,3,0x81a09b,-2.85,1.495,-7.5);box(group,1.54,1.05,2.1,0x263f4c,-2.85,2.0,-7.3,false);
  const face=(text,x,y,z,w,h)=>{box(group,w,h,.06,0x087449,x,y,z+.035);const top=y+h/2;if(top<TOLL_LAYOUT.canopyClearance)for(const side of[-1,1])box(group,.065,TOLL_LAYOUT.canopyClearance-top,.065,0xc7d1ca,x+side*(w/2-.2),(top+TOLL_LAYOUT.canopyClearance)/2,z+.09);return sign(text,x,y,z,w,h,Math.PI,'#087449','#ffffff',group);};
  face(p.name,-3.1,TOLL_LAYOUT.canopyClearance+.27,-11.56,12.5,.9);
  face('模拟通行 · 无需支付',-3.1,6.35,-11.56,8.3,.65);
  const lanes=p.lanes.map(l=>{const controller=createTollLane({id:l.id,type:l.type,direction:p.direction}),width=l.width,hingeX=-l.offset+width/2,hinge=new T.Group();hinge.position.set(hingeX,1.05,0);group.add(hinge);box(group,.3,1.15,.4,0xe4b83c,hingeX,.575,0);const arm=box(hinge,width-.12,.11,.12,0xf4ead5,-(width-.12)/2,0,0,false);arm.userData.tollArm=l.id;for(let x=.35;x<width-.15;x+=.65)box(hinge,.25,.12,.13,0xdb4c47,-x,0,0,false);const indicator=box(group,.22,.22,.12,0xd94336,-l.offset,6.0,-11.65,false);indicator.material=indicator.material.clone();face(l.type==='etc'?'ETC · 20 km/h':'混合 · 停车通行',-l.offset,5.35,-11.6,l.type==='etc'?3.35:4.3,.68);
   const stop=box(group,width-.15,.008,.25,0xf2eadb,-l.offset,.028,-3,false);stop.userData.cameraOccluderRole='marking';return{...l,controller,hinge,arm,indicator};});group.updateMatrixWorld(true);return{plaza:p,group,lanes};}
 function remove(id,station){for(const lane of station.lanes)lane.indicator.material.dispose();station.group.traverse(o=>{if(o.geometry&&o.geometry!==geo)o.geometry.dispose();if(o.userData.ownedSignMaterial){o.material?.map?.dispose();o.material?.dispose();}});root.remove(station.group);stations.delete(id);revision++;}
 function update(plazas,player,traffic=[]){const wanted=new Set();for(const p of plazas){if(!p.valid)continue;const visible=Math.hypot(p.point.x-player.x,p.point.z-player.z)<750||traffic.some(t=>Math.hypot(t.x-p.point.x,t.z-p.point.z)<100);const old=stations.get(p.id);if(!visible&&(!old||Math.hypot(p.point.x-player.x,p.point.z-player.z)>950))continue;wanted.add(p.id);if(!old){stations.set(p.id,build(p));revision++;}}
  for(const[id,s]of stations)if(!wanted.has(id))remove(id,s);
 }
 function step(player,traffic,dt,context){limits.clear();if(!stations.size){if(context?.movingObstacles?.size)context.movingObstacles.sync([]);return [];}const all=[{id:'player',bodies:vehicleBodies(player),speed:player.speed||0,target:null},...traffic.map(t=>({id:`npc:${t.id}:${t.generation}`,bodies:trafficBodies(t),speed:t.physical?.velocity??t.velocity??0,target:t}))];const descriptors=[];
  for(const station of stations.values()){const p=station.plaza;for(const lane of station.lanes){const actors=all.map(a=>({...tollActor(p,lane,a.id,a.bodies,a.speed),target:a.target})).filter(a=>a.overlap&&a.front>-110&&a.back<80),events=lane.controller.step(dt,actors);for(const e of events)if(e.id==='player')toast(`${p.name} · ${p.direction==='entry'?'入口':'出口'}模拟通行完成`);
   for(const a of actors){if(a.direction<.5||a.front>15)continue;const limit=a.front< -35?Math.sqrt(TOLL_TUNING.approachSpeed**2+2*2.8*Math.max(0,-35-a.front)):lane.controller.speedLimit(a);if(a.target)limits.set(a.target,Math.min(limits.get(a.target)??Infinity,limit));else if(a.front> -65){const key=p.id+':'+lane.id;if(key!==lastNotice){lastNotice=key;toast(lane.type==='etc'?'收费站：ETC 车道请减速至 20 km/h':'收费站：在停止线前停车，模拟办理后抬杆');}}}
   const s=lane.controller.state;lane.hinge.rotation.z=-s.angle;lane.indicator.material.color.setHex(s.angle>1.45?0x5ed782:0xd94336);station.group.updateMatrixWorld(true);lane.arm.getWorldPosition(tmp);lane.arm.getWorldQuaternion(qArm);descriptors.push({id:lane.id,position:{x:tmp.x,y:tmp.y,z:tmp.z},rotation:{x:qArm.x,y:qArm.y,z:qArm.z,w:qArm.w},halfExtents:{x:(lane.width-.12)/2,y:.055,z:.06},enabled:true});
  }}context?.movingObstacles?.sync(descriptors);return descriptors;
 }
 return{update,step,speedLimit:t=>limits.get(t)??Infinity,reset(){lastNotice='';for(const station of stations.values())for(const l of station.lanes)l.controller.reset({preserveArm:true});},get revision(){return revision;},get stations(){return stations;},get count(){return stations.size;},dispose(){for(const[id,s]of [...stations])remove(id,s);geo.dispose();for(const m of mats.values())m.dispose();scene.remove(root);}};
}
