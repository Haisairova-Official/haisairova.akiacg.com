import {batchStaticVisuals} from '../mesh-batching.js?rev=world21d';
// Town owns its visual and collision resources; moving it never moves the car.
export function createTownScene(T,parent,{stops,tokenPositions,boxes=[],fish=[],tokens=[],mapTokens=null}){const scene=new T.Group();parent.add(scene);
  const mats = new Map();
  const mat = (color,opts={}) => { const key=color+JSON.stringify(opts); if(!mats.has(key))mats.set(key,new T.MeshStandardMaterial({color,roughness:.8,...opts}));return mats.get(key); };
  function mesh(geo,color,x,y,z,parent=scene,opts={}) {
    const m = new T.Mesh(geo,mat(color,opts)); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; parent.add(m);return m;
  }
  const cube=(w,h,d,color,x,y,z,parent,opts)=>mesh(new T.BoxGeometry(w,h,d),color,x,y,z,parent,opts);
  const cylinder=(r1,r2,h,color,x,y,z,parent,segments=12)=>mesh(new T.CylinderGeometry(r1,r2,h,segments),color,x,y,z,parent);
  function sign(text,x,y,z,width=6,height=1.4,rotation=0,background='#f3f6f5',ink='#476074',parent=scene) {
    if(typeof document==='undefined'){const m=new T.Group();m.position.set(x,y,z);m.rotation.y=rotation;parent.add(m);return m;}
    const canvas=document.createElement('canvas'); canvas.width=1024;canvas.height=Math.round(1024*height/width);
    const c=canvas.getContext('2d'); c.fillStyle=background;c.fillRect(0,0,canvas.width,canvas.height);
    c.fillStyle=ink;c.textAlign='center';c.textBaseline='middle';const rows=text.split('\n');
    if(rows.length>1){c.strokeStyle=ink;c.lineWidth=5;c.strokeRect(12,12,1000,canvas.height-24);const lineHeight=(canvas.height-34)/rows.length;c.font=`600 ${Math.min(110,lineHeight*.64)}px sans-serif`;rows.forEach((row,i)=>c.fillText(row,512,17+lineHeight*(i+.5),940));}
    else{c.font=`600 ${Math.min(110,canvas.height*.43)}px sans-serif`;c.fillText(text,512,canvas.height/2,940);}
    const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
    const m=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:tex,side:T.FrontSide}));m.userData.ownedSignMaterial=true;m.position.set(x,y,z);m.rotation.y=rotation;parent.add(m);return m;
  }
  function shrub(x,z,r=.9){cylinder(.14,.2,1.5,0x938775,x,.75,z);mesh(new T.IcosahedronGeometry(r,0),0x96b3a5,x,1.65,z);}
  function tree(x,z,size=1){const firstChild=scene.children.length;
    cylinder(.22,.3,2.6*size,0x897c70,x,1.3*size,z,scene,7);
    mesh(new T.IcosahedronGeometry(1.7*size,1),0x91aaa0,x,3.6*size,z);
    mesh(new T.IcosahedronGeometry(1.25*size,0),0xaabfb0,x+.7,4.5*size,z-.25);
    boxes.push({x,z,w:.7,d:.7});for(const part of scene.children.slice(firstChild))part.userData.cameraOccluderRole='tree';
  }
  function bench(x,z,rot=0){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);for(const zz of [-.28,0,.28])cube(2.8,.14,.22,0xb8a58d,0,.65,zz,g);cube(2.8,.65,.13,0xb8a58d,0,1.13,-.4,g);for(const xx of [-1,1])cube(.12,.62,.7,0x566b79,xx,.3,0,g);}
  function lamp(x,z,rotation=0){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;scene.add(g);const pole=cylinder(.09,.13,5,0x657e8c,0,2.5,0,g);pole.userData.driveCollider='wall';pole.userData.townLamp=true;cube(1.4,.1,.1,0x657e8c,.6,5,0,g);cube(.65,.15,.4,0xf8e6bf,1.05,4.9,0,g);}
  // An island-like archive district with a complete road loop and two cross streets.
  cube(90,.9,80,0xb4c9be,0,-.6,0);
  cube(85,.12,75,0xcbd8d0,0,-.09,0);
  cube(60,.14,49,0xe4e8e3,0,.02,0);
  cube(58,.1,9.2,0x758696,0,.15,-19);cube(58,.1,9.2,0x758696,0,.15,19);
  cube(9.2,.1,46,0x758696,-25,.15,0);cube(9.2,.1,46,0x758696,25,.15,0);
  // Truck aprons follow the actual R10 corner path, including trailer off-tracking.
  for(const[cx,cz,start]of[[15,-9,-Math.PI/2],[15,9,0],[-15,9,Math.PI/2],[-15,-9,Math.PI]]){const v=[],ix=[];for(let i=0;i<=24;i++){const a=start+i*Math.PI/48;for(const r of[5.4,14.6])v.push(cx+Math.cos(a)*r,.205,cz+Math.sin(a)*r);if(i){const k=i*2;ix.push(k-2,k,k-1,k-1,k,k+1);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();mesh(g,0x758696,0,0,0);}
  cube(46,.1,6,0x8292a0,0,.15,0);cube(6,.1,38,0x8292a0,0,.15,0);
  for(let x=-23;x<=23;x+=4){for(const z of [-19,19])cube(1.9,.02,.1,0xd9e1dd,x,.212,z);}
  for(let z=-15;z<=15;z+=4){for(const x of [-25,25])cube(.1,.02,1.9,0xd9e1dd,x,.212,z);}
  for(const x of [-19,19])for(let i=0;i<6;i++)cube(.5,.022,5,0xdee7e5,x+i*.9-2.4,.215,19);
  // Central circular archive lawn and monument.
  cylinder(8.5,8.5,.26,0xc3cbbb,0,.27,0,scene,48);cylinder(7.8,7.8,.22,0xaec2ad,0,.46,0,scene,48);
  boxes.push({x:0,z:0,w:11.5,d:11.5});
  cylinder(3.5,3.8,.55,0xdfe5e3,0,.7,0,scene,32);
  const plinth=cube(4.8,4.2,1.25,0xebf0ed,0,3,0);plinth.rotation.y=.12;
  sign('秋月存档',0,3.8,.73,4.1,1);sign('EST. 2021',0,2.75,.74,3.4,.6);
  sign('甭写了',0,1.93,.74,2.5,.45,0,'#ebf0ed','#8b9daa');
  const avatarTex=typeof document!=='undefined'?new T.TextureLoader().load('./assets/avatar.png'):null;if(avatarTex)avatarTex.colorSpace=T.SRGBColorSpace;
  const portrait=new T.Mesh(new T.PlaneGeometry(1.5,1.5),new T.MeshBasicMaterial({map:avatarTex}));portrait.position.set(0,5.85,.05);portrait.rotation.y=.12;scene.add(portrait);
  cube(1.65,1.65,.16,0xebf0ed,0,5.85,-.07);
  for(const [x,z] of [[-6,5],[6,5],[-6,-5],[6,-5]]){shrub(x,z);}
  bench(-6,0,Math.PI/2);bench(6,0,-Math.PI/2);
  // Each frontage is modeled as a distinct little place, not just an unlabeled block.
  function building(stop,w,d,h,rotation=0){
    const g=new T.Group();g.userData.cameraOccluderRole='building';g.position.set(stop.x,0,stop.z);g.rotation.y=rotation;scene.add(g);
    cube(w+1,.28,d+1,0xd9dfdb,0,.2,0,g);cube(w,h,d,stop.color,0,h/2+.35,0,g);
    cube(w+.35,.22,d+.35,0xe8ece6,0,h+.45,0,g);
    cube(w-.5,h*.48,.15,0x435f73,0,h*.47,d/2+.02,g,{metalness:.2,roughness:.25});
    for(const x of [-w*.3,0,w*.3])cube(.12,h*.5,.2,0xdce6e5,x,h*.47,d/2+.14,g);
    cube(w+.7,.18,1.5,0xd5e1df,0,h*.75,d/2+.6,g);
    sign(stop.name.replace(' 小铺','').replace('云霞机房','云霞'),0,h*.81+.8,d/2+.16,w-.3,1,0,'#edf2ed','#455f76',g);
    if(stop.tag.includes('已停止'))sign('已停止运营',0,h*.2,d/2+.18,3.2,.5,0,'#e3e9e6','#7a8790',g);
    boxes.push({x:stop.x,z:stop.z,w:rotation ? d+1 : w+1,d:rotation ? w+1 : d+1});
    return g;
  }
  const bot=building(stops[1],10,7,5.3);
  // Retired robot on the storefront steps.
  cube(1.5,1.4,.8,0xe2e9ea,-2.9,1.35,4.3,bot);cube(1.8,1.1,1,0xe9ece9,-2.9,2.55,4.3,bot);
  for(const x of [-3.3,-2.5])cube(.18,.18,.05,0x6ebcca,x,2.65,4.82,bot,{emissive:0x4d97a3,emissiveIntensity:.6});
  cylinder(.055,.055,.5,0x6c8797,-2.9,3.35,4.3,bot);mesh(new T.SphereGeometry(.13,8,8),0xd2ac9f,-2.9,3.65,4.3,bot);
  for(const x of [-3.4,-2.4])cube(.35,.45,.5,0x7891a2,x,.43,4.3,bot);
  const server=building(stops[2],10,7,6.5);
  for(let i=-1;i<=1;i++){
    cube(1.7,3.4,.55,0x3e5464,i*2.5,2.25,3.65,server);
    for(let j=0;j<5;j++){cube(1.4,.28,.03,0x627a8b,i*2.5,1+j*.55,3.96,server);cube(.1,.1,.04,0xa5c6b6,i*2.5+.55,1+j*.55,4,server);}
  }
  for(const x of [-2.2,2.2]){cylinder(1,1,.7,0x718995,x,7.45,0,server);cube(.12,.03,1.6,0xb0c1c2,x,7.82,0,server);}
  const search=building(stops[3],9,6.5,4.8);
  const magnify=mesh(new T.TorusGeometry(.9,.16,8,24),0xf0e5cc,0,6.6,0,search);magnify.rotation.z=.2;
  const handle=cube(.25,1.1,.25,0xf0e5cc,.85,5.9,0,search);handle.rotation.z=.75;
  cube(2.4,.7,1,0xe5dccb,0,.7,4.2,search);sign('你不会百度吗？',0,1.25,4.75,3.6,.65,0,'#e5dccb','#927f63',search);
  const tank=building(stops[4],11,6,5.5,-Math.PI/2);
  cube(9,3.1,.3,0x6fb0bd,0,2.4,3.3,tank,{emissive:0x458997,emissiveIntensity:.3,roughness:.25});
  cube(9,.3,.45,0xadc9c5,0,.88,3.35,tank);
  for(let i=0;i<7;i++){
    const f=new T.Group();f.position.set(-3.8+i*1.2,1.5+(i%3)*.65,3.55);tank.add(f);
    const body=mesh(new T.SphereGeometry(.27,8,6),i%2 ? 0xf3c288 : 0xf1d9ad,0,0,0,f);body.scale.set(1.5,.85,.5);
    const tail=mesh(new T.ConeGeometry(.25,.4,3),0xe6b180,-.48,0,0,f);tail.rotation.z=-Math.PI/2;
    mesh(new T.SphereGeometry(.035,6,6),0x40586a,.23,.06,.13,f);fish.push({f,base:f.position.clone(),phase:i*1.4});
  }
  for(const x of [-3.7,-1,2,3.5]){const seaweed=cylinder(.06,.12,1+Math.abs(x)*.1,0x90c2ad,x,1.3,3.55,tank,6);seaweed.rotation.z=x*.08;}
  const forum=building(stops[5],10,6,4.3,Math.PI);
  for(const x of [-2.3,1.3]){
    const bubble=cube(1.7,1.2,.35,0xe3d9e6,x,5.85,0,forum);bubble.rotation.z=x*.03;
    const tail=cube(.35,.45,.3,0xe3d9e6,x+.4,5.13,0,forum);tail.rotation.z=.6;
    for(let i=0;i<3;i++)mesh(new T.SphereGeometry(.08,8,6),0xb198b4,x-.4+i*.4,5.85,.22,forum);
  }
  bench(13,25,Math.PI);bench(23,25,Math.PI);cylinder(.7,.7,.6,0xb7a6b4,18,.5,25);
  // A small open-air music terrace, record sculpture and piano.
  const music=new T.Group();music.userData.cameraOccluderRole='building';music.position.set(-14,0,30);music.rotation.y=Math.PI;scene.add(music);
  cube(11,.5,7,0xd5d9c9,0,.3,0,music);cube(9,.2,5.5,0xb9c4a7,0,.65,0,music);
  for(const x of [-4.5,4.5])for(const z of [-2,2])cylinder(.11,.11,4.5,0x879987,x,2.9,z,music);
  cube(10,.18,5.2,0xcad1b9,0,5.15,0,music);
  for(let i=-4;i<=4;i++)cube(.18,.12,6,0xf0e8ce,i,5.3,0,music);
  sign('海色 / 音乐台',0,4.25,2.8,6,1,0,'#eaf0dd','#6a7d67',music);
  cube(3.7,1.6,1,0x546779,0,1.5,0,music);cube(3.7,.2,.65,0xe9eadf,0,1.45,.75,music);
  for(let i=0;i<16;i++){cube(.05,.025,.6,0x9da7a7,-1.7+i*.22,1.57,.75,music);if(i%7!==2&&i%7!==6)cube(.09,.07,.3,0x42566a,-1.65+i*.22,1.62,.62,music);}
  const record=mesh(new T.CylinderGeometry(1.4,1.4,.12,32),0x3e5465,-3,2.6,0,music);record.rotation.x=Math.PI/2;
  const label=mesh(new T.CylinderGeometry(.43,.43,.14,24),0xa8beca,-3,2.6,.04,music);label.rotation.x=Math.PI/2;
  cube(1.8,.4,.7,0x8f9f8f,0,1,2,music);
  boxes.push({x:-14,z:30,w:11,d:7});
  // Trees, flowerbeds, street lamps, benches and far skyline set the scale.
  for(const [x,z,s] of [[-36,-26,1.1],[-33,9,1],[-36,25,1.3],[36,-27,1.2],[35,23,1],[-8,-11,.8],[9,10,.9],[-38,-5,1],[8,34,.8],[-4,34,1]])tree(x,z,s);
  for(const [x,z,r] of [[-18,-11,0],[20,-13,Math.PI],[20,12,Math.PI],[-18,11,0],[-30,-18,0],[32,14,Math.PI]])lamp(x,z,r);
  for(const [x,z] of [[-12,10],[13,-11]]){cube(4,.35,2,0xe1e5de,x,.37,z);for(let i=0;i<5;i++){shrub(x-1.4+i*.7,z,.48);mesh(new T.IcosahedronGeometry(.16,0),0xd7afae,x-1.4+i*.7,2,z);}}
  for(let i=0;i<18;i++){
    const x=-76+i*9, height=4+(i%4)*3;
    cube(6,height,7,i%2 ? 0xc6d4da : 0xbfcfd8,x,height/2,-54-(i%3)*4);
    if(i%3===0)cube(4,.5,5,0xdde5e7,x,height+.25,-54);
  }
  // Direction boards at the entrance and archival street typography.
  sign('秋月存档街区 →',-14,2.5,24.8,6,1.2,Math.PI,'#edf2ef','#567187');
  for(const x of [-16.5,-11.5])cylinder(.08,.08,2.6,0x6f8591,x,1.3,24.75);
  sign('DRIVE / 2021',-5,.23,19,5,1.2).rotation.x=-Math.PI/2;
  // Blue archive fragments sit above the road, distinct from warm shop colors.
  tokenPositions.forEach(([x,z],i)=>{
    const g=new T.Group();g.position.set(x,1.45,z);scene.add(g);
    mesh(new T.OctahedronGeometry(.52,0),0x9fd2ed,0,0,0,g,{metalness:.25,roughness:.3,emissive:0x5395b5,emissiveIntensity:.25});
    const halo=mesh(new T.TorusGeometry(.8,.035,5,24),0xcee8ef,0,-.68,0,g);halo.rotation.x=Math.PI/2;
    tokens.push({g,x,z,collected:false,phase:i});
    if(typeof document!=='undefined'&&mapTokens){const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');dot.setAttribute('cx',x);dot.setAttribute('cy',z);dot.setAttribute('r','1.3');dot.setAttribute('fill','#75b9d4');dot.id='token-'+i;mapTokens.append(dot);}
  });
  const townRoot=scene;
  const townCollider=(x,y,z,w,h,d)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshBasicMaterial());m.position.set(x,y,z);m.visible=false;m.userData.collisionOnly=true;m.userData.driveCollider='wall';townRoot.add(m);return m;};
  townCollider(0,.12,0,90,.2,80).userData.driveCollider='ground';for(const b of boxes)townCollider(b.x,2.5,b.z,b.w,5,b.d);
  for(const z of [-39,39])townCollider(0,.65,z,90,.9,.25);townCollider(-44,.65,0,.25,.9,78);for(const [z,length]of [[-32,14],[0,26],[32,14]])townCollider(44,.65,z,.25,.9,length);
  const baseGeometry=new T.BufferGeometry(),baseMaterial=new T.MeshStandardMaterial({color:0xa0b69a,side:T.DoubleSide}),townEarth=new T.Mesh(baseGeometry,baseMaterial);townEarth.userData.driveCollider='ground';townRoot.add(townEarth);
  const moveTown=pose=>{townRoot.position.set(pose.x,pose.y,pose.z);townRoot.rotation.y=pose.angle;
   const top=[[-45,-.1,-40],[45,-.1,-40],[45,-.1,40],[-45,-.1,40]],bottom=[[-70,-pose.y-2,-65],[70,-pose.y-2,-65],[70,-pose.y-2,65],[-70,-pose.y-2,65]],vertices=[];for(let i=0;i<4;i++){const j=(i+1)%4;vertices.push(...top[i],...bottom[i],...top[j],...top[j],...bottom[i],...bottom[j]);}baseGeometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));baseGeometry.computeVertexNormals();baseGeometry.computeBoundingSphere();};moveTown({x:0,y:0,z:0,angle:0});

batchStaticVisuals(T,townRoot,{exclude:new Set([...fish.map(o=>o.f),...tokens.map(o=>o.g)])});
return {root:townRoot,move:moveTown,sign,boxes,fish,tokens};
}
