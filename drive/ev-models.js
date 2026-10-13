import {batchStaticVisuals} from './mesh-batching.js?rev=world21d';
// Original metric geometry, guided by the manufacturers' exterior photographs.
// China ET5T 100kWh / 19in and 10 EV 816 Ultra / 19in. No copied 3D assets.
// Optional roof cargo, 21in rims, yellow calipers and raised active wing omitted.
export function createEVVehicle(T,kind,f,{color}={}){
 const touring=kind==='et5t',p=f.geometry,e=f.powertrain,L=p.length/2,W=p.width/2,H=p.height,R=e.tyreRadius,wb=p.wheelbase,car=new T.Group(),body=new T.Group(),wheels=[];car.add(body);
 Object.assign(car.userData,{kind,body,wheels,rollAngle:0,visualConfiguration:touring?'中国2026 ET5T 100kWh 19寸 外观近似':'中国领克10 EV 816 Ultra 19寸 外观近似',originalGeometry:true});
 const material=(c,roughness=.34,metalness=.35)=>new T.MeshStandardMaterial({color:c,roughness,metalness,side:T.DoubleSide});
 const paint=material(color??(touring?0x92aeb8:0x286e70),.28,.55),glass=material(0x152c37,.17,.42),black=material(0x182129,.58,.12),rubber=material(0x161a20,.95,0),silver=material(0xa9b8c1,.24,.78),brake=material(0x526069,.58,.55),white=material(0xf0f5e8,.23,.25),red=material(0x9a1924,.26,.25);
 paint.userData.paintRole='body';white.emissive.setHex(0x8a9585);white.emissiveIntensity=.28;red.emissive.setHex(0x590713);red.emissiveIntensity=.25;
 function mesh(g,m,parent=body){const a=new T.Mesh(g,m);a.castShadow=a.receiveShadow=true;parent.add(a);return a;}
 function box(w,h,d,m,x,y,z,parent=body){const a=mesh(new T.BoxGeometry(w,h,d),m,parent);a.position.set(x,y,z);return a;}
 function ellipsoid(x,y,z,sx,sy,sz,m,parent=body){const a=mesh(new T.SphereGeometry(1,20,12),m,parent);a.position.set(x,y,z);a.scale.set(sx,sy,sz);return a;}
 function polygon(points,m,parent=body){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.setIndex(Array.from({length:points.length-2},(_,i)=>[0,i+1,i+2]).flat());g.computeVertexNormals();return mesh(g,m,parent);}
 function line(points,r,m,parent=body){const curve=new T.CatmullRomCurve3(points.map(a=>new T.Vector3(...a)));return mesh(new T.TubeGeometry(curve,Math.max(4,Math.ceil(points.length*(points.length>20?1.4:3))),r,6,false),m,parent);}
 function skin(rows,m){const v=rows.flat(2),ix=[],normals=[],n=rows[0].length;
  for(let k=0;k<rows.length;k++)for(let j=0;j<n;j++){
   const u=new T.Vector3(...rows[k][(j+1)%n]).sub(new T.Vector3(...rows[k][(j+n-1)%n])),dz=new T.Vector3(...rows[Math.min(rows.length-1,k+1)][j]).sub(new T.Vector3(...rows[Math.max(0,k-1)][j]));normals.push(...u.cross(dz).normalize().toArray());
   if(k<rows.length-1){const a=k*n+j,b=k*n+(j+1)%n,c=a+n,d=b+n;ix.push(a,b,c,b,d,c);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setIndex(ix);mesh(g,m);
  // Separate end caps keep their normals out of the side-shell shading.
  for(const [row,face]of[[rows[0],-1],[rows.at(-1),1]]){const outline=row.slice(1,11).filter((q,i,a)=>i===a.length-1||q[1]!==a[i+1][1]),bottom=row[0][1],top=row[10][1],v=[],ix=[],nx=24,ys=[...new Set([...outline.map(q=>q[1]),...Array.from({length:19},(_,i)=>bottom+(top-bottom)*i/18)])].sort((a,b)=>a-b),ny=ys.length-1;
   for(let j=0;j<=ny;j++){const y=ys[j];let k=outline.findIndex(q=>q[1]>=y);if(k<=0)k=1;const a=outline[k-1],b=outline[k],t=(y-a[1])/Math.max(.00001,b[1]-a[1]),w=a[0]+(b[0]-a[0])*t,edge=a[2]+(b[2]-a[2])*t,center=face*(L-.12*Math.max(0,(.5-y)/.3)-.075*((y-bottom)/(top-bottom))**5);
    for(let i=0;i<=nx;i++){const u=i/nx*2-1;v.push(w*u,y,center+(edge-center)*u*u);}}
   for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;ix.push(a,b,c,b,d,c);}const cap=new T.BufferGeometry();cap.setAttribute('position',new T.Float32BufferAttribute(v,3));cap.setIndex(ix);cap.computeVertexNormals();const ns=cap.attributes.normal;for(let i=0;i<ns.count;i++)if(Math.hypot(ns.getX(i),ns.getY(i),ns.getZ(i))<.5)ns.setXYZ(i,0,0,face);mesh(cap,m);
  }
 }
 function interpolate(points,z){let k=points.findIndex(q=>q[0]>=z);if(k<=0)k=1;const a=points[k-1],b=points[k],t=Math.max(0,Math.min(1,(z-a[0])/(b[0]-a[0]))),d=b[0]-a[0],out=[z];
  for(let j=1;j<a.length;j++){const before=points[Math.max(0,k-2)],after=points[Math.min(points.length-1,k+1)],m0=(b[j]-before[j])/(b[0]-before[0]),m1=(after[j]-a[j])/(after[0]-a[0]);out.push((2*t**3-3*t*t+1)*a[j]+(t**3-2*t*t+t)*d*m0+(-2*t**3+3*t*t)*b[j]+(t**3-t*t)*d*m1);}return out;
 }
 const profile=touring?[[-L,.88,1.015],[-L+.2,.97,1.045],[-1.45,1,1.055],[-.6,1,.985],[.65,1,.970],[1.32,.99,.967],[L-.35,.95,.885],[L,.85,.785]]:[[-L,.90,.940],[-L+.24,.97,1.005],[-1.50,1,1.065],[-.6,1,1.025],[.65,1,1.010],[1.42,.99,.990],[L-.34,.96,.877],[L,.88,.765]];
 function sample(z){const q=interpolate(profile,z);return{width:W*q[1],belt:q[2]};}
 const stations=new Set(Array.from({length:73},(_,i)=>-L+p.length*i/72));for(const a of[-wb/2,wb/2])for(let i=0;i<=28;i++)stations.add(a-(R+.060)+2*(R+.060)*i/28);
 skin([...stations].filter(z=>z>=-L&&z<=L).sort((a,b)=>a-b).map(z=>{const{width:w,belt:y}=sample(z);let arch=.225;for(const a of[-wb/2,wb/2])if(Math.abs(z-a)<R+.060)arch=Math.max(arch,R+Math.sqrt((R+.060)**2-(z-a)**2));const end=Math.max(0,(Math.abs(z)-(L-.32))/.32),round=(x,yy)=>[x,yy,z-Math.sign(z)*end*end*(.10*(Math.abs(x)/w)**2+.12*Math.max(0,(.5-yy)/.3))];
  return [round(0,.225),round(w*.69,.225),round(w*.94,arch),round(w*.970,Math.max(arch,y-.27)),round(w,y-.14),round(w*.993,y-.065),round(w*.974,y),[w*.925,y+.025,z-.04*Math.sign(z)*end],[w*.82,y+.043,z-.05*Math.sign(z)*end],[w*.55,y+.062,z-.065*Math.sign(z)*end],[0,y+.072,z-.075*Math.sign(z)*end],[-w*.55,y+.062,z-.065*Math.sign(z)*end],[-w*.82,y+.043,z-.05*Math.sign(z)*end],[-w*.925,y+.025,z-.04*Math.sign(z)*end],round(-w*.974,y),round(-w*.993,y-.065),round(-w,y-.14),round(-w*.970,Math.max(arch,y-.27)),round(-w*.94,arch),round(-w*.69,.225)];}),paint);
 // Lower sill and flush door seams; wheel arches cut the actual shell rather
 // than placing dark circles over an unbroken body panel.
 for(const side of[-1,1]){
  line([[side*(W-.035),.263,-wb/2+.37],[side*W,.253,-.3],[side*W,.263,wb/2-.42]],.020,black);
  for(const axle of[-wb/2,wb/2]){const pts=[];for(let i=0;i<=24;i++){const a=Math.PI*i/24,z=axle+Math.cos(a)*(R+.063),q=sample(z);pts.push([side*(q.width*.969+.003),R+Math.sin(a)*(R+.063),z]);}line(pts,.010,paint);}
 }
 // The wagon's long roof and D-pillar are deliberately different from the
 // Lynk fastback: these are not two paint jobs on the same sedan shell.
 const roof=touring?[[.30,H-.075,.735],[-.18,H-.045,.770],[-.86,H-.052,.777],[-1.43,H-.115,.742],[-1.67,H-.205,.696]]:[[.26,H-.085,.745],[-.18,H,.776],[-.64,H-.063,.761],[-.94,H-.158,.727]];
 const roofAscending=roof.map(q=>[q[0],q[1],q[2]]).reverse();
 function roofAt(z){const q=interpolate(roofAscending,z);return{y:q[1],w:q[2]};}
 function roofSurface(start,end,mat){const v=[],ix=[],nz=28,nx=8;
  for(let j=0;j<=nz;j++){const z=roof[0][0]+(roof.at(-1)[0]-roof[0][0])*j/nz,{y,w}=roofAt(z);
   for(let i=0;i<=nx;i++){const t=start+(end-start)*i/nx;v.push(w*t,y-.039*t*t,z);}}
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;ix.push(a,c,b,b,c,d);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();mesh(g,mat);
 }
 roofSurface(-.87,.87,glass);roofSurface(-1,-.87,paint);roofSurface(.87,1,paint);
 const frontBase=[.880,1.030,touring?1.095:1.155],frontTop=[roof[0][2],roof[0][1]-.036,roof[0][0]],rearBase=[touring?.875:.865,touring?1.085:1.060,touring?-2.125:-2.185],rearTop=[roof.at(-1)[2],roof.at(-1)[1]-.036,roof.at(-1)[0]];
 function screen(a,b){const v=[],ix=[],nx=16,ny=8;for(let j=0;j<=ny;j++){const t=j/ny,w=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,z=a[2]+(b[2]-a[2])*t;for(let i=0;i<=nx;i++){const f=i/nx*2-1;v.push(w*f,y+.036*(1-f*f),z+.028*(1-f*f)*Math.sin(t*Math.PI));}}for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;ix.push(a,b,c,b,d,c);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();mesh(g,glass);}
 screen(frontBase,frontTop);screen(rearTop,rearBase);
 // Windows and their frame use exactly one ruled surface. The previous
 // independent fan polygons could intersect and leave paint triangles in glass.
 function sidePoint(z,t,side,offset=0){let top;
  if(z>roof[0][0]){const u=(z-roof[0][0])/(frontBase[2]-roof[0][0]);top=[frontTop[0]+(frontBase[0]-frontTop[0])*u,frontTop[1]+(frontBase[1]-frontTop[1])*u];}
  else if(z<roof.at(-1)[0]){const u=(roof.at(-1)[0]-z)/(roof.at(-1)[0]-rearBase[2]);top=[rearTop[0]+(rearBase[0]-rearTop[0])*u,rearTop[1]+(rearBase[1]-rearTop[1])*u];}
  else{const q=roofAt(z);top=[q.w,q.y-.039];}
  const q=sample(z),bottom=[q.width*.974,q.belt+.025];return[side*(bottom[0]+(top[0]-bottom[0])*t+.009*Math.sin(t*Math.PI)+offset),bottom[1]+(top[1]-bottom[1])*t,z];
 }
 car.userData.windowProbes=[];
 function sidePatch(z0,z1,t0,t1,side,m,offset=0){const rows=20,cols=4,v=[],ix=[];for(let j=0;j<=rows;j++){const z=z0+(z1-z0)*j/rows;for(let i=0;i<=cols;i++)v.push(...sidePoint(z,t0+(t1-t0)*i/cols,side,offset));}for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,c=a+cols+1,d=c+1;ix.push(a,b,c,b,d,c);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();mesh(g,m);}
 for(const side of[-1,1]){
  const v=(x,y,z)=>[side*x,y,z],beltZ=touring?[-.40,-1.32]:[-.46,-1.47];
  const cuts=touring?[[frontBase[2]-.105,-.375],[-.430,-1.29],[-1.355,rearBase[2]+.16]]:[[frontBase[2]-.10,-.430],[-.490,-1.40],[-1.455,rearBase[2]+.18]];
  // Paint is a frame with true window openings, not a whole panel behind
  // a second differently tessellated surface. This prevents angle-dependent
  // glass/paint intersections without a large artificial outward offset.
  sidePatch(frontBase[2],cuts[0][0],0,1,side,paint);sidePatch(cuts.at(-1)[1],rearBase[2],0,1,side,paint);
  for(const [a,b]of cuts){for(const u of[.12,.35,.6,.86])for(const t of[.25,.50,.78,.87])if(a+(b-a)*u<frontBase[2]-.35)car.userData.windowProbes.push(sidePoint(a+(b-a)*u,t,side,.007));sidePatch(a,b,0,.090,side,paint);sidePatch(a,b,.944,1,side,paint);sidePatch(a,b,.090,.944,side,glass,.007);}
  for(let j=0;j<cuts.length-1;j++){sidePatch(cuts[j][1],cuts[j+1][0],0,1,side,paint);sidePatch(cuts[j][1]-.002,cuts[j+1][0]+.002,.082,.95,side,black,.009);}
  const outline=[];for(let j=0;j<=50;j++)outline.push(sidePoint(frontBase[2]+(rearBase[2]-frontBase[2])*j/50,.985,side,.007));for(let j=50;j>=0;j--)outline.push(sidePoint(frontBase[2]+(rearBase[2]-frontBase[2])*j/50,.06,side,.007));line(outline.concat([outline[0]]),.007,touring?silver:black);
  line([v(sample(beltZ[0]).width*.985,sample(beltZ[0]).belt,beltZ[0]),v(W*.992,.78,beltZ[0]-.04),v(W*.974,.31,beltZ[0]-.06)],.0028,black);
  line([v(sample(beltZ[1]).width*.985,sample(beltZ[1]).belt,beltZ[1]-.04),v(W*.987,.89,beltZ[1]-.09)],.0028,black);
  for(const z of[.32,touring?-.99:-1.11])box(.012,.027,.19,black,side*(sample(z).width+.005),.980,z);
  line([v(.86,1.042,frontBase[2]-.02),v(W+.035,1.046,frontBase[2]-.15)],.023,black);
  ellipsoid(side*(W+.035),1.072,frontBase[2]-.20,.105,.060,.124,paint);ellipsoid(side*(W+.031),1.059,frontBase[2]-.213,.105,.033,.124,black);
 }
 // Flush rear roof spoiler and small sensor housings remain within the body
 // silhouette; the Lynk reference's raised active wing is an omitted option.
 if(touring){box(1.46,.035,.23,paint,0,H-.186,-1.70);ellipsoid(0,H-.035,.34,.11,.033,.10,black);for(const side of[-1,1])ellipsoid(side*.595,H-.061,.315,.060,.023,.076,black);}
 else{line([[-.75,1.005,-L+.10],[0,1.04,-L+.06],[.75,1.005,-L+.10]],.018,paint);ellipsoid(0,H-.085,.35,.095,.025,.070,black);}
 // End ornaments follow the actual lofted paint, including its corner
 // return. Fixed-z plates would float 10–15cm away from the rounded bumper.
 body.updateMatrixWorld(true);const bins=Array.from({length:32*24},()=>[]),xmin=-W-.2,xspan=2*(W+.2),yspan=H+.1;
 const cell=(x,y)=>[Math.max(0,Math.min(31,Math.floor((x-xmin)/xspan*32))),Math.max(0,Math.min(23,Math.floor(y/yspan*24)))];
 // A 2D projected triangle index answers the same front/rear surface query as
 // raycasting, without ~1,000 complete mesh traversals during vehicle loading.
 body.traverse(o=>{if(!o.isMesh||o.material!==paint)return;const g=o.geometry,p=g.attributes.position,ind=g.index,count=ind?.count||p.count,point=i=>new T.Vector3().fromBufferAttribute(p,ind?ind.getX(i):i).applyMatrix4(o.matrixWorld);for(let i=0;i<count;i+=3){const a=point(i),b=point(i+1),c=point(i+2),den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(den)<1e-10)continue;const tri={a,b,c,den},lo=cell(Math.min(a.x,b.x,c.x),Math.min(a.y,b.y,c.y)),hi=cell(Math.max(a.x,b.x,c.x),Math.max(a.y,b.y,c.y));for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++)bins[y*32+x].push(tri);}});
 car.userData.faceSampleMisses=0;
 function facePoint(x,y,face,offset=.008){const at=cell(x,y);let z=face>0?-Infinity:Infinity;for(const{a,b,c,den}of bins[at[1]*32+at[0]]){const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den,v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den;if(u<-.000001||v<-.000001||u+v>1.000001)continue;const p=u*a.z+v*b.z+(1-u-v)*c.z;if(face*p>face*z)z=p;}if(!Number.isFinite(z)){car.userData.faceSampleMisses++;z=face*(L-.12);}return[x,y,z+face*offset];}
 function facePatch(x0,x1,y0,y1,face,m,offset=.008){const v=[],ix=[],nx=12,ny=4;for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)v.push(...facePoint(x0+(x1-x0)*i/nx,y0+(y1-y0)*j/ny,face,offset));for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;ix.push(a,b,c,b,d,c);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();mesh(g,m);}
 // Nose lighting and lower openings. Lamps sit outside the shell to avoid
 // hidden emissive strips or co-planar flicker.
 facePatch(-.71,.71,.28,.402,1,black);
 for(const side of[-1,1]){
  if(touring){
   const pts=[[.36,L-.255],[.61,L-.245],[.80,L-.285]].map(([x,z])=>[side*x,sample(z).belt+.072-.024*(x/W)**2,z]);line(pts,.014,black);line(pts.map(q=>[q[0],q[1]+.011,q[2]+.005]),.008,white);
   facePatch(side*.744-.0765,side*.744+.0765,.412,.694,1,black);facePatch(side*.744-.050,side*.744+.050,.550,.666,1,white,.014);
  }else{
   for(const x of[.664,.796]){const pts=[L-.38,L-.26,L-.10].map((z,i)=>[side*(x-.026*i),sample(z).belt+.058,z]);line(pts,.017,white);}
   facePatch(side*.560-.2825,side*.560+.2825,.6825,.7555,1,black);facePatch(side*.560-.253,side*.560+.253,.718,.736,1,white,.014);
   facePatch(side*.77-.043,side*.77+.043,.335,.512,1,black);
  }
 }
 facePatch(-.1775,.1775,.5175,.6225,1,black,.010);
 const tailY=touring?1.044:.982;
 const tail=[[-.83,tailY-.035],[-.55,tailY],[0,tailY+.009],[.55,tailY],[.83,tailY-.035]];
 car.userData.tailAnchors=tail.map(([x,y])=>facePoint(x,y,-1,.014));line(car.userData.tailAnchors,.026,black);
 line(tail.map(([x,y])=>facePoint(x,y,-1,.036)),.012,red);
 if(!touring)for(const side of[-1,1])for(const x of[.635,.745]){const pts=[[side*x,tailY-.045],[side*(x-.030),tailY-.089]].map(([x,y])=>facePoint(x,y,-1,.019));line(pts,.014,red);}
 facePatch(-.20,.20,.612,.722,-1,black,.010);facePatch(-.72,.72,.241,.363,-1,black);
 for(const side of[-1,1])facePatch(side*.705-.080,side*.705+.080,.370,.392,-1,red,.012);
 const turnLights=new Map();
 for(const side of[-1,1]){const signal=material(0x925c20,.35,.1);signal.emissive.setHex(0xffa51f);signal.emissiveIntensity=0;turnLights.set(side,signal);
  const x=side*(touring?.744:.56),width=touring?.093:.37,y=touring?.496:.694;facePatch(x-width/2,x+width/2,y-.010,y+.010,1,signal,.016);
  facePatch(side*.555-.08,side*.555+.08,tailY-.082,tailY-.066,-1,signal,.017);
  box(.012,.017,.065,signal,side*(W+.143),1.072,frontBase[2]-.208);
 }car.userData.turnLights=turnLights;
 // Tiny raised plate lettering uses original strokes, no bitmap texture load.
 const strokes={E:[[[1,1],[0,1],[0,0],[1,0]],[[0,.5],[.8,.5]]],T:[[[0,1],[1,1]],[[.5,1],[.5,0]]],5:[[[1,1],[0,1],[0,.5],[1,.5],[1,0],[0,0]]],L:[[[0,1],[0,0],[1,0]]],Y:[[[0,1],[.5,.5],[1,1]],[[.5,.5],[.5,0]]],N:[[[0,0],[0,1],[1,0],[1,1]]],K:[[[0,0],[0,1]],[[1,1],[0,.5],[1,0]]]};
 for(const face of[1,-1]){const word=touring?'ET5T':'LYNK',y=face>0?.548:.642;for(let j=0;j<word.length;j++)for(const shape of strokes[word[j]])line(shape.map(([x,dy])=>facePoint(face*((j-word.length/2)*.063+.030+x*.045),y+dy*.052,face,.017)),.003,white);}
 for(const front of[true,false])for(const side of[-1,1]){
  const pivot=new T.Group(),spin=new T.Group();pivot.position.set(side*(front?p.frontTrack:p.rearTrack)/2,R,(front?1:-1)*wb/2);pivot.add(spin);car.add(pivot);
  const tire=mesh(new T.TorusGeometry(R*.81,R*.19,12,40),rubber,spin);tire.rotation.y=Math.PI/2;tire.scale.z=1.05;
  const disc=mesh(new T.CylinderGeometry(.200,.200,.018,32),brake,spin);disc.rotation.z=Math.PI/2;disc.position.x=side*.06;
  const rim=mesh(new T.CylinderGeometry(.225,.225,.018,32),black,spin);rim.rotation.z=Math.PI/2;rim.position.x=side*.099;
  const ring=mesh(new T.TorusGeometry(.229,.012,8,40),silver,spin);ring.rotation.y=Math.PI/2;ring.position.x=side*.113;
  for(let j=0;j<5;j++)for(const split of[-1,1]){const a=j*Math.PI*.4+split*.09,pt=(r,t)=>[side*.119,r*Math.cos(t),r*Math.sin(t)];polygon([pt(.050,a-.06),pt(.213,a+.045),pt(.215,a+.145),pt(.075,a+.10)],silver,spin);}
  const hub=mesh(new T.CylinderGeometry(.046,.046,.027,16),silver,spin);hub.rotation.z=Math.PI/2;hub.position.x=side*.113;
  box(.055,.105,.055,brake,side*.055,.104,.142,pivot);
  wheels.push({pivot,spin,front,radius:R});
 }
 function batch(root){const before=new Set();root.traverse(o=>{if(o.geometry)before.add(o.geometry);});batchStaticVisuals(T,root);const after=new Set();root.traverse(o=>{if(o.geometry)after.add(o.geometry);});for(const g of before)if(!after.has(g))g.dispose();}
 batch(body);for(const w of wheels)batch(w.spin);car.updateMatrixWorld(true);return car;
}
