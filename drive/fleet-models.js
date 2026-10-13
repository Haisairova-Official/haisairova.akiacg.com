import {createEVVehicle} from './ev-models.js?rev=world21d';
import {createBT7} from './bt7-model.js?rev=world21d';
import {fleetSpec} from './fleet-specs.mjs?rev=world21d';
// Original lightweight meshes in metres; wheel and hitch positions match physics.
export function createFleetVehicle(T,kind,{color}={}){
 const f=fleetSpec(kind);if(f.powertrain?.type==='ev')return createEVVehicle(T,kind,f,{color});if(kind==='bt7')return createBT7(T,f,{color});const p=f.geometry,car=new T.Group(),body=new T.Group(),wheels=[];car.add(body);Object.assign(car.userData,{kind,body,wheels,rollAngle:0});
 const mat=(c,r=.55,m=.15)=>new T.MeshStandardMaterial({color:c,roughness:r,metalness:m});
 const paint=mat(color??({lynk03:0xe8ba32,civic8:0x8dacc0,santana2000:0x29353f,dayun:0xb62d35,bt7:0x65724b})[kind]),black=mat(0x1e2930,.85,0),glass=mat(0x182e3d,.22,.28),silver=mat(0xb7c2c5,.3,.65),white=mat(0xe9f1e8,.28),red=mat(0xa92931,.4),amber=mat(0xc77c25,.4),rubber=mat(0x182028,1,0);
 paint.userData.paintRole=kind==='dayun'?'cab':'body';
 function mesh(g,m,parent=body){const a=new T.Mesh(g,m);a.castShadow=a.receiveShadow=true;parent.add(a);return a;}
 function box(w,h,d,m,x,y,z,parent=body){const a=mesh(new T.BoxGeometry(w,h,d),m,parent);a.position.set(x,y,z);return a;}
 function poly(v,m,parent=body){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v.flat(),3));g.setIndex(Array.from({length:v.length-2},(_,i)=>[0,i+1,i+2]).flat());g.computeVertexNormals();const a=mesh(g,m.clone(),parent);a.material.side=T.DoubleSide;return a;}
 function loft(stations,m){const rings=stations.map(([z,y0,half,y1,top])=>[[-half,y0,z],[half,y0,z],[half,y1,z],[top,y1+.035,z],[-top,y1+.035,z],[-half,y1,z]]),v=rings.flat(2),ix=[];for(let i=0;i<rings.length-1;i++)for(let j=0;j<6;j++){const a=i*6+j,b=i*6+(j+1)%6,c=(i+1)*6+j,d=(i+1)*6+(j+1)%6;ix.push(a,b,c,b,d,c);}for(const k of [0,(rings.length-1)*6])for(let j=1;j<5;j++)ix.push(k,k+j,k+j+1);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();const flat=g.toNonIndexed();flat.computeVertexNormals();g.dispose();const a=mesh(flat,m);a.material.side=T.DoubleSide;return a;}
 function roundedCab(w,h,d,m,x,y,z){const rings=[],v=[],ix=[];for(const [dy,inset] of [[-h/2,.08],[-h/2+.14,0],[h/2-.14,0],[h/2,.07]]){const a=w/2-inset,b=d/2-inset,c=.16;rings.push([[-a+c,dy,b],[a-c,dy,b],[a,dy,b-c],[a,dy,-b+c],[a-c,dy,-b],[-a+c,dy,-b],[-a,dy,-b+c],[-a,dy,b-c]]);}v.push(...rings.flat(2));for(let k=0;k<3;k++)for(let j=0;j<8;j++){const a=k*8+j,b=k*8+(j+1)%8,c=a+8,e=b+8;ix.push(a,b,c,b,e,c);}for(const k of[0,24])for(let j=1;j<7;j++)ix.push(k,k+j,k+j+1);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);const flat=g.toNonIndexed();flat.computeVertexNormals();g.dispose();const a=mesh(flat,m);a.material.side=T.DoubleSide;a.position.set(x,y,z);return a;}
 function wheel(x,z,r,front=false,root=car,collection=wheels,dual=false){const pivot=new T.Group(),spin=new T.Group();pivot.position.set(x,r,z);pivot.add(spin);root.add(pivot);const tire=mesh(new T.CylinderGeometry(r,r,dual?.39:.22,20),rubber,spin);tire.rotation.z=Math.PI/2;const rim=mesh(new T.CylinderGeometry(r*.68,r*.68,dual?.40:.23,16),kind==='bt7'?paint:silver,spin);rim.rotation.z=Math.PI/2;if(kind==='bt7'){for(let k=0;k<6;k++){const a=k*Math.PI/3,bolt=mesh(new T.CylinderGeometry(r*.04,r*.04,.015,8),black,spin);bolt.rotation.z=Math.PI/2;bolt.position.set(Math.sign(x)*.126,r*.46*Math.cos(a),r*.46*Math.sin(a));}}else for(let k=0;k<5;k++){const a=k*Math.PI/2.5,sp=box(dual?.405:.235,r*.10,r*1.12,black,0,0,0,spin);sp.rotation.x=a;}const hub=mesh(new T.CylinderGeometry(r*.19,r*.19,dual?.412:.245,12),kind==='bt7'?paint:silver,spin);hub.rotation.z=Math.PI/2;collection.push({pivot,spin,front,radius:r});}
 if(['lynk03','civic8','santana2000'].includes(kind)){
  const l=p.length/2,w=p.width/2,h=p.height,classic=kind==='santana2000',civic=kind==='civic8',belt=classic?.90:.96;
  const shell=[[-l,.28,w*(classic?.96:.90),belt-.07,w*(classic?.94:.88)],[-l+.35,.24,w*.98,belt,w*.96],[-.8,.24,w,belt,w*.97],[.8,.24,w,belt,w*.97],[l-.35,.28,w*.96,belt-(classic?.02:.09),w*.92],[l,.36,w*(classic?.96:.88),belt-(classic?.04:.20),w*(classic?.94:.86)]],r=f.engine.tyreRadius,arch=r+.055;
  const samples=new Set(shell.map(a=>a[0]));for(const axle of [-p.wheelbase/2,p.wheelbase/2])for(let i=0;i<=18;i++)samples.add(axle-arch+2*arch*i/18);
  const skinned=[...samples].sort((a,b)=>a-b).map(z=>{let i=shell.findIndex(a=>a[0]>=z);if(i<=0)i=1;const a=shell[i-1],b=shell[i],u=(z-a[0])/(b[0]-a[0]),row=a.map((v,k)=>k?v+(b[k]-v)*u:z);for(const axle of[-p.wheelbase/2,p.wheelbase/2])if(Math.abs(z-axle)<arch)row[1]=Math.max(row[1],r+Math.sqrt(Math.max(0,arch*arch-(z-axle)**2)));return row;});loft(skinned,paint);
  const windBase=civic?1.43:1.04,windTop=civic?.30:.38,rearBase=classic?-1.22:-1.65,rearTop=classic?-.73:-.82,roofW=w*.76;
  poly([[-w*.90,belt,windBase],[w*.90,belt,windBase],[roofW,h-.03,windTop],[-roofW,h-.03,windTop]],glass);
  poly([[-roofW,h-.03,windTop],[roofW,h-.03,windTop],[roofW,h,rearTop],[-roofW,h,rearTop]],paint);
  poly([[-roofW,h,rearTop],[roofW,h,rearTop],[w*.90,belt,rearBase],[-w*.90,belt,rearBase]],glass);
  for(const side of [-1,1]){
   const v=(x,y,z)=>[side*x,y,z];
   poly([v(w*.91,belt,windBase),v(roofW,h-.03,windTop),v(roofW,h,rearTop),v(w*.91,belt,rearBase)],glass);
   // Painted A/C pillars and dark B pillar define the generation's greenhouse.
   poly([v(w*.92,belt,windBase+.06),v(roofW+.035,h,windTop+.055),v(roofW,h-.04,windTop-.04),v(w*.89,belt,windBase-.06)],paint);
   poly([v(roofW,h,rearTop+.035),v(roofW+.06,h-.07,rearTop-.13),v(w*.96,belt,rearBase-.12),v(w*.88,belt,rearBase+.10)],paint);
   poly([v(w*.92,belt,-.18),v(roofW,h-.015,-.18),v(roofW,h-.015,-.28),v(w*.92,belt,-.28)],black);
   box(.026,.035,p.wheelbase-2*(r+.08),classic?black:paint,side*w,.43,0);
   for(const z of [.32,-.90])box(.03,.04,.18,classic?silver:paint,side*w,.84,z);
   box(.035,.43,.015,black,side*(w+.003),.65,-.25);
   const mirror=box(.18,.10,.22,classic?black:paint,side*(w+.07),1.03,windBase-.22);mirror.rotation.y=side*.15;
   for(const front of [true,false])wheel(side*(front?p.frontTrack:p.rearTrack)/2,(front?1:-1)*p.wheelbase/2,f.engine.tyreRadius,front);
  }
  box(p.width*.72,.13,.045,black,0,.45,l+.012);box(p.width*.83,.16,.09,black,0,.48,-l+.02);
  if(classic){box(.73,.23,.035,black,0,.77,l+.009);for(let i=0;i<5;i++)box(.70,.014,.04,silver,0,.69+i*.038,l+.032);for(const side of[-1,1]){box(.44,.21,.04,white,side*.59,.78,l+.028);box(.60,.22,.04,red,side*.49,.77,-l-.014);}}
  else if(civic){box(.93,.035,.045,silver,0,.77,l+.036);box(.065,.085,.047,black,0,.78,l+.038);for(const side of[-1,1])box(.012,.065,.052,silver,side*.022,.78,l+.05);box(.043,.012,.052,silver,0,.78,l+.05);for(const side of[-1,1]){poly([[side*.31,.73,l+.048],[side*.74,.745,l+.046],[side*.77,.79,l+.043],[side*.34,.785,l+.047]],white);for(const x of [.43,.65]){const lamp=mesh(new T.CylinderGeometry(.088,.088,.05,18),red);lamp.rotation.x=Math.PI/2;lamp.position.set(side*x,.78,-l-.015);}}}
  else{box(1.38,.15,.045,black,0,.70,l+.02);for(const side of[-1,1]){poly([[side*.59,.954,l-.53],[side*.72,.951,l-.53],[side*.75,.904,l-.23],[side*.63,.915,l-.22]],white);poly([[side*.46,.64,l+.058],[side*.68,.64,l+.058],[side*.70,.74,l+.058],[side*.46,.74,l+.058]],white);box(.6,.12,.05,red,side*.51,.90,-l+.01);box(.1,.27,.22,black,side*.65,1.05,-l+.17);}box(1.48,.045,.34,black,0,1.20,-l+.16);box(1.62,.12,.045,black,0,.91,-l-.008);for(const side of[-1,1]){for(let i=0;i<7;i++)box(.035,.11,.05,red,side*(.34+i*.058),.92,-l-.036);poly([[side*.70,.84,-l-.031],[side*.79,.84,-l+.025],[side*.77,.63,-l+.01],[side*.59,.70,-l-.03],[side*.56,.78,-l-.03],[side*.62,.75,-l-.042],[side*.71,.72,-l-.018]],red);for(const x of [.52,.70]){const exhaust=mesh(new T.CylinderGeometry(.06,.06,.11,12),black);exhaust.rotation.x=Math.PI/2;exhaust.position.set(side*x,.37,-l-.024);}}}
  box(.40,.10,.04,white,0,.52,l+.035);box(.43,.11,.04,white,0,.61,-l-.03);
 }else if(kind==='dayun'){
  box(1.84,.27,6.7,black,0,.96,0);roundedCab(2.42,2.22,2.45,paint,0,2.25,1.93);roundedCab(2.32,.32,2.25,paint,0,3.37,1.86);
  poly([[-1.08,2.21,3.172],[1.08,2.21,3.172],[1.05,3.09,3.178],[-1.05,3.09,3.178]],glass);
  box(2.30,.19,.14,silver,0,1.02,3.25);box(1.62,.66,.06,black,0,1.57,3.19);for(let i=0;i<4;i++)box(1.58,.047,.06,silver,0,1.32+i*.17,3.23);
  for(const side of[-1,1]){box(.50,.25,.08,white,side*.88,1.12,3.21);box(.028,.7,1.00,glass,side*1.223,2.63,2.35);box(.25,.52,.20,black,side*1.38,2.28,2.86);box(.055,.6,1.04,black,side*1.12,1.22,1.93);box(.60,.54,1.0,silver,side*.77,.98,-.25);for(const a of f.physical.axles)wheel(side*a.track/2,a.z,.5,!!a.steer,car,wheels,a.z<0);}
  const trailer=new T.Group(),tb=new T.Group(),tw=[];trailer.add(tb);Object.assign(trailer.userData,{body:tb,wheels:tw,kind:'trailer',rollAngle:0});
  box(2.5,.20,13,silver,0,1.46,0,tb);box(2.46,2.03,12.90,mat(0xd6ddda,.72,.12),0,2.59,0,tb);
  for(const side of[-1,1]){for(let z=-6.2;z<6.4;z+=.40)box(.035,1.97,.035,silver,side*1.25,2.59,z,tb);for(const a of f.trailer.axles)wheel(side*a.track/2,a.z,.5,false,trailer,tw,true);box(.07,.22,5.4,black,side*1.15,.73,.2,tb);box(.15,.15,.05,red,side*1.07,1.16,-6.55,tb);}
  box(.035,1.97,.055,silver,0,2.58,-6.48,tb);for(const side of[-1,1])box(.06,1.79,.06,silver,side*.85,2.58,-6.53,tb);
  car.userData.trailerModel=trailer;
 }
 return car;
}
export function setFleetVisualMode(car,mode){if(car.userData.tracks)car.userData.tracks.visible=mode!=='wheels';if(car.userData.stowedTracks)car.userData.stowedTracks.visible=mode==='wheels';}
