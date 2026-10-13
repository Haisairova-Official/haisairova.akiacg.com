import{CRABBAY_BASIN}from'./terrain.mjs?rev=world21d';
// A finite, original coastal logistics environment. The shared district/highway
// graph owns driving, traffic and physics; this module never creates a new world.
// No characters, dialogue, boarding, or unverified story events are implemented.
export function* createCrabbayEnvironment(T,root,{layout,pose,box,cyl,mesh,board}){
 const b=CRABBAY_BASIN,solid=(w,h,d,c,x,y,z,role='wall',owner=root)=>{const m=box(w,h,d,c,x,y,z,owner);m.userData.driveCollider=role;m.userData.cameraOccluderRole=role==='ground'?'road':'furniture';return m;};
 // The surrounding land is a volume down to the shared carved bed, not a paper
 // plane. These four slabs leave precisely the water rectangle open.
 const lo=-146,hi=63,n=-81,s=81,bed=b.bed-.2,top=.02;
 for(const [x0,x1,z0,z1]of[[lo,b.minX,n,s],[b.maxX,hi,n,s],[b.minX,b.maxX,n,b.minZ],[b.minX,b.maxX,b.maxZ,s]]){solid(x1-x0,top-bed,z1-z0,0x9eaa92,(x0+x1)/2,(top+bed)/2,(z0+z1)/2,'ground');yield 'crabbay-land';}
 // Earth shoulders slope from the bounded scene footprint into carved terrain.
 const v=[],a=[[lo,top,n],[hi,top,n],[hi,top,s],[lo,top,s]],d=[[lo-24,bed,n-24],[hi+24,bed,n-24],[hi+24,bed,s+24],[lo-24,bed,s+24]];for(let i=0;i<4;i++){const j=(i+1)%4;v.push(...a[i],...d[i],...a[j],...a[j],...d[i],...d[j]);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();const earth=mesh(g,0x8b9c7f);earth.userData.driveCollider='ground';earth.userData.cameraOccluderRole='road';
 const water=mesh(new T.PlaneGeometry(b.maxX-b.minX,b.maxZ-b.minZ),0x547f8b,(b.minX+b.maxX)/2,b.level,(b.minZ+b.maxZ)/2,root,{roughness:.28,metalness:.15});water.rotation.x=-Math.PI/2;water.userData.environmentRole='water';water.name='crabbay-basin-water';
 // Four visible quay faces reach the actual seabed; raised coping keeps wheels
 // away from the drop. No collision disappears when camera occlusion fades it.
 for(const [x,z,w,d]of[[b.minX,0,.8,90],[b.maxX,0,.8,90],[(b.minX+b.maxX)/2,b.minZ,46,.8],[(b.minX+b.maxX)/2,b.maxZ,46,.8]]){solid(w,top-bed,d,0x849191,x,(top+bed)/2,z,'ground');solid(w+.25,.8,d+.25,0xb9c0b5,x,.42,z);}
 yield 'crabbay-quay';
 // A supported finger pier remains an environmental prop, with two static boats.
 const pier=solid(21,.8,6,0xa9b4af,-75,-.32,13,'ground');pier.name='crabbay-pier-deck';for(const x of[-82,-74,-66])for(const z of[10.5,15.5]){const pile=cyl(.48,3.6,0x727e7c,x,-2.3,z);pile.userData.driveCollider='ground';pile.userData.cameraOccluderRole='bridge';}
 for(const x of[-83,-77,-70])for(const z of[10.5,15.5]){const bollard=cyl(.21,.5,0x45525a,x,.32,z);bollard.userData.driveCollider='wall';}
 function boat(x,z,rotation,color){const group=new T.Group();group.position.set(x,b.level,z);group.rotation.y=rotation;group.userData.cameraOccluderRole='furniture';root.add(group);const shape=new T.Shape();shape.moveTo(-1.9,-5);shape.lineTo(1.9,-5);shape.lineTo(2.2,2.8);shape.quadraticCurveTo(1.5,5,0,6.2);shape.quadraticCurveTo(-1.5,5,-2.2,2.8);shape.closePath();const hg=new T.ExtrudeGeometry(shape,{depth:1.2,bevelEnabled:false});hg.rotateX(-Math.PI/2);const hull=mesh(hg,color,0,-.45,0,group);hull.userData.driveCollider='wall';solid(2.9,1.65,3.7,0xe3e3d3,0,1.65,-.6,'wall',group);box(2.95,.75,1.4,0x51707a,0,1.9,.7,group);solid(.15,3.2,.15,0x5b6b72,0,3.5,-1.4,'wall',group);box(.3,.18,2.8,0x71838a,0,4.6,-1.4,group);return group;}
 boat(-77,3,Math.PI/2,0x496772);boat(-94,-20,0,0x68786d);yield 'crabbay-boats';
 function depot(x,z,w,d,h,color,label){const group=new T.Group();group.position.set(x,0,z);group.userData.cameraOccluderRole='building';root.add(group);solid(w,.35,d,0xb4b7ab,0,.18,0,'wall',group);solid(w,h,d,color,0,h/2+.35,0,'wall',group);solid(w+.5,.6,d+.5,0x5d7175,0,h+.55,0,'wall',group);for(const xx of[-w*.28,0,w*.28])box(w*.18,h*.42,.1,0x57696c,xx,h*.4,d/2+.06,group);board(label,0,h*.77,d/2+.13,w*.85,.85,0,group);return group;}
 depot(35,-52,17,11,5.2,0xc4c8b9,'海岸后勤基地');yield 'crabbay-depot';
 depot(-2,-6,25,15,7,0xa9b9b5,'器材库');depot(21,8,12,10,4.4,0xbabbb0,'后勤值班室');yield 'crabbay-warehouses';
 // Lightweight yard markings and bounded cargo stacks, outside the road corridor.
 for(let i=0;i<3;i++)solid(4.6,2.2,2.6,[0x747f76,0x8c7663,0x667e89][i],-15+i*5.1,1.12,17);for(let i=0;i<4;i++)box(.13,.018,4.5,0xe5e1cf,30+i*3,.035,-38);
 for(const z of[-27,27]){const pole=cyl(.08,5,0x5c7277,-59,2.5,z);pole.userData.driveCollider='wall';pole.userData.cameraOccluderRole='furniture';box(.9,.24,.55,0xdbe1c9,-58.7,5,z);}
 board('螃蟹湾 · 海岸后勤基地',35,2.9,-10,8,1.2,Math.PI/2);board('港池 / 码头',-58,2,0,4.2,.85,Math.PI/2);board('环境原型 · 人物与剧情待接入',0,2.3,4.2,11,.7);
 yield 'crabbay-signs';
}
