// Confirmed gray first-generation Yaris / Vitz XP10, using the user's rear reference.
// This is original geometry. No GIF/video pixels or soundtrack are used in the game.
export const YARIS_REFERENCE_PERIOD=6.9;
export const YARIS_PLAY_SPEED=6.9/.45; // Original user-approved pose sequence; only playback rate changes.
// Key poses from the inspected slow Tenor loop: hold, compress, broad low pose, spring back, settle.
// This is an interpretation of that loop, not a claim of exact reconstruction of the music video.
export function sampleYarisBounce(time,speed=3){
  const u=((time*speed/YARIS_REFERENCE_PERIOD)%1+1)%1;
  const poses=[[0,0,0],[.22,.04,0],[.29,.25,0],[.36,.82,0],[.48,1,0],[.59,.92,0],[.64,.4,.05],[.68,0,1],[.72,0,.3],[.78,0,0],[1,0,0]];
  let i=0;while(i<poses.length-2&&u>poses[i+1][0])i++;
  const a=poses[i],b=poses[i+1];let t=(u-a[0])/(b[0]-a[0]);t=t*t*(3-2*t);
  return {compression:a[1]+(b[1]-a[1])*t,rebound:a[2]+(b[2]-a[2])*t};
}
export function applyYarisBounce(car,time,roadY=0,speed=3,motion=true){
  const {compression:c,rebound:r}=motion?sampleYarisBounce(time,speed):{compression:0,rebound:0};
  car.scale.set(1+c*.11,1-c*.30+r*.12,1+c*.10);
  car.position.y=roadY+r*.065;
  car.userData.body.rotation.x=c*.035-r*.045;
  car.userData.body.position.y=0;car.userData.suspension=0;car.userData.bounceLift=r*.065;
  return {compression:c,rebound:r};
}
export function createYaris(T){
  const car=new T.Group(),body=new T.Group(),wheels=[];car.add(body);
  Object.assign(car.userData,{body,wheels,rollAngle:0,kind:'yaris'});
  const silver=new T.MeshStandardMaterial({color:0xb8bdbf,roughness:.48,metalness:.28,flatShading:true});
  silver.userData.paintRole='body';
  const trim=new T.MeshStandardMaterial({color:0x293038,roughness:.78});
  const glass=new T.MeshStandardMaterial({color:0x354f60,roughness:.26,metalness:.2});
  const alloy=new T.MeshStandardMaterial({color:0xc1c9ce,roughness:.3,metalness:.5});
  const light=new T.MeshStandardMaterial({color:0xe9ece7,roughness:.3});
  const red=new T.MeshStandardMaterial({color:0xb4474b,roughness:.3,emissive:0x58171b,emissiveIntensity:.15});
  const amber=new T.MeshStandardMaterial({color:0xcfa06c,roughness:.4});
  const yellow=new T.MeshStandardMaterial({color:0xe5c970,roughness:.5});
  const rubber=new T.MeshStandardMaterial({color:0x232931,roughness:.95});
  function mesh(g,m,parent=body){const n=new T.Mesh(g,m);n.castShadow=true;n.receiveShadow=true;parent.add(n);return n;}
  function box(w,h,d,m,x,y,z,parent=body){const n=mesh(new T.BoxGeometry(w,h,d),m,parent);n.position.set(x,y,z);return n;}
  function poly(points,m,parent=body){const positions=points.flat(),indices=[];for(let i=1;i<points.length-1;i++)indices.push(0,i,i+1);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();const material=m.clone();material.side=T.DoubleSide;return mesh(g,material,parent);}
  function shell(rings,m){const count=rings[0].length,positions=rings.flat(2),indices=[];for(let i=0;i<rings.length-1;i++)for(let j=0;j<count;j++){const a=i*count+j,b=i*count+(j+1)%count,c=(i+1)*count+j,d=(i+1)*count+(j+1)%count;indices.push(a,b,c,b,d,c);}for(let j=1;j<count-1;j++){indices.push(0,j,j+1);const a=(rings.length-1)*count;indices.push(a,a+j+1,a+j);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();const material=m.clone();material.side=T.DoubleSide;return mesh(g,material);}
  shell([
    [-1.84,.35,.66,.73,.79,.89,.69],[-1.51,.24,.73,.77,.82,.95,.72],[-1.18,.24,.73,.78,.83,.97,.72],[-.5,.23,.72,.76,.81,.96,.71],[.45,.23,.72,.76,.81,.91,.70],[1.18,.25,.72,.74,.82,.87,.66],[1.68,.30,.64,.65,.76,.74,.60],[1.81,.34,.60,.60,.67,.70,.55]
  ].map(([z,b,lw,y,w,top,tw])=>[[-lw,b,z],[lw,b,z],[w,y,z],[tw,top,z],[-tw,top,z],[-w,y,z]]),silver);
  shell([
    [[-.70,.93,1.08],[.70,.93,1.08],[.59,1.37,.42],[-.59,1.37,.42]],
    [[-.73,.94,.3],[.73,.94,.3],[.65,1.49,.12],[-.65,1.49,.12]],
    [[-.75,.96,-.5],[.75,.96,-.5],[.65,1.49,-.63],[-.65,1.49,-.63]],
    [[-.73,.94,-1.48],[.73,.94,-1.48],[.60,1.36,-1.31],[-.60,1.36,-1.31]],
    [[-.69,.85,-1.70],[.69,.85,-1.70],[.56,1.18,-1.62],[-.56,1.18,-1.62]]
  ],silver);
  poly([[-.66,.95,1.09],[.66,.95,1.09],[.568,1.374,.405],[-.568,1.374,.405]],glass);
  // Two panes follow the two rear shell slopes, with a small outward clearance.
  poly([[-.55,1.31,-1.415],[.55,1.31,-1.415],[.635,1.16,-1.675],[-.635,1.16,-1.675]],glass);
  poly([[-.635,1.16,-1.675],[.635,1.16,-1.675],[.65,.95,-1.728],[-.65,.95,-1.728]],glass);
  box(1.27,.035,.025,trim,0,.90,-1.73);box(.47,.016,.025,trim,.10,.925,-1.73);
  for(const side of [-1,1]){
    const p=(z,y,x)=>[side*x,y,z];
    poly([p(.96,.99,.735),p(.37,1.383,.635),p(.06,1.425,.684),p(-.42,1.425,.69),p(-.47,.994,.772)],trim);
    poly([p(.90,1.025,.74),p(.34,1.37,.646),p(.04,1.395,.695),p(-.37,1.395,.70),p(-.42,1.022,.78)],glass);
    poly([p(-.53,.996,.773),p(-.46,1.425,.705),p(-.72,1.419,.691),p(-1.12,1.34,.674),p(-1.39,1.02,.77)],trim);
    poly([p(-.57,1.025,.785),p(-.51,1.396,.713),p(-.70,1.393,.704),p(-1.08,1.319,.689),p(-1.31,1.045,.78)],glass);
    box(.022,.042,.14,silver,side*.838,.85,-.17);
    box(.025,.034,2.25,silver,side*.82,.35,-.12);
    box(.016,.017,2.27,trim,side*.822,.367,-.12);
    poly([p(-.50,.97,.797),p(-.56,.40,.826),p(-.54,.27,.797)],trim);
    const mirror=mesh(new T.SphereGeometry(.12,8,5),trim);mirror.position.set(side*.852,1.015,.80);mirror.scale.set(1,.65,1.35);
    for(const z of [-1.18,1.17]){
      const pivot=new T.Group(),spin=new T.Group();pivot.position.set(side*.746,.298,z);pivot.add(spin);car.add(pivot);
      const tire=mesh(new T.CylinderGeometry(.298,.298,.18,16),rubber,spin);tire.rotation.z=Math.PI/2;
      const disc=mesh(new T.CylinderGeometry(.205,.205,.185,14),alloy,spin);disc.rotation.z=Math.PI/2;
      const hub=mesh(new T.CylinderGeometry(.052,.052,.20,8),trim,spin);hub.rotation.z=Math.PI/2;
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const hole=mesh(new T.SphereGeometry(.05,6,4),trim,spin);hole.scale.set(.16,.62,1.25);hole.position.set(side*.101,Math.sin(a)*.135,Math.cos(a)*.135);hole.rotation.x=-a;}
      wheels.push({pivot,spin,front:z>0});
    }
    // Oval/teardrop upright lamps distinguish XP10 from the newer generations.
    const housing=mesh(new T.SphereGeometry(.19,12,7),trim);housing.position.set(side*.59,.763,1.655);housing.scale.set(.78,1.08,.28);housing.rotation.x=.30;
    const lens=mesh(new T.SphereGeometry(.18,12,7),light);lens.position.set(side*.589,.765,1.681);lens.scale.set(.74,1.01,.22);lens.rotation.x=.30;
    const blink=mesh(new T.SphereGeometry(.065,8,5),amber);blink.position.set(side*.665,.70,1.70);blink.scale.set(.65,1,.22);
    const tail=mesh(new T.SphereGeometry(.16,8,5),red);tail.position.set(side*.709,.843,-1.872);tail.scale.set(.77,.79,.27);
    const tailBottom=mesh(new T.SphereGeometry(.095,8,5),light);tailBottom.position.set(side*.712,.708,-1.88);tailBottom.scale.set(.75,.48,.23);
  }
  box(.78,.12,.035,trim,0,.645,1.807);box(.85,.115,.034,trim,0,.418,1.824);
  box(.43,.11,.038,light,0,.523,1.843);box(.45,.11,.038,yellow,0,.59,-1.863);
  for(const x of [-.56,.56])box(.38,.047,.026,trim,x,.56,-1.88);
  box(1.45,.08,.07,silver,0,.356,-1.80);box(1.38,.06,.02,trim,0,.391,-1.845);
  const frontBadge=mesh(new T.TorusGeometry(.05,.009,4,16),alloy);frontBadge.scale.x=1.25;frontBadge.position.set(0,.737,1.759);
  const rearBadge=mesh(new T.TorusGeometry(.032,.007,4,12),alloy);rearBadge.scale.x=1.25;rearBadge.position.set(0,.777,-1.82);
  const antenna=mesh(new T.CylinderGeometry(.007,.01,.36,5),trim);antenna.position.set(0,1.63,-.8);antenna.rotation.x=-.5;
  return car;
}
