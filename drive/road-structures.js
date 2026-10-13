// Closed metre-scale road furniture. These exact meshes are also colliders.
// Profiles are illustrative construction shapes, not certified crash barriers.
export function createRoadStructureFactory(T,{metal,concrete}){
 const point=(p,points,i,o,y)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],h=p.heading??Math.atan2(b.x-a.x,b.z-a.z);return[p.x-Math.cos(h)*o,p.y+y,p.z+Math.sin(h)*o];};
 const tri=(out,a,b,c)=>out.push(...a,...b,...c);
 function sweep(points,profile,offset=0,mask=()=>true,topTriangles){
  const out=[],active=points.slice(0,-1).map((p,i)=>mask(p,i,points[i+1])&&mask(points[i+1],i+1,points[i+1]));
  const rings=points.map((p,i)=>(typeof profile==='function'?profile(p,i):profile).map(([x,y])=>point(p,points,i,offset+x,y)));
  const nearSegment=(v,a,b)=>{const d=b.map((x,k)=>x-a[k]),l=d.reduce((n,x)=>n+x*x,0),t=Math.max(0,Math.min(1,d.reduce((n,x,k)=>n+x*(v[k]-a[k]),0)/(l||1)));return Math.hypot(...v.map((x,k)=>x-a[k]-d[k]*t))<.02;};
  for(let i=0;i<points.length-1;){if(!active[i]){i++;continue;}let end=i+1;
   // Exact opening boundaries remain. Near-collinear construction runs may
   // share a span, with <=2cm chord error and <=8m maximum span.
   for(let j=i+2;j<points.length&&active[j-1]&&(points[j].s-points[i].s)<=8;j++){
    let fits=true;for(let k=i+1;k<j&&fits;k++)for(let n=0;n<rings[k].length;n++)if(!nearSegment(rings[k][n],rings[i][n],rings[j][n])){fits=false;break;}
    if(!fits)break;end=j;
   }
   const a=rings[i],b=rings[end];for(let j=0;j<a.length;j++){const k=(j+1)%a.length;if(j===0&&topTriangles)topTriangles.push(out.length/9,out.length/9+1);tri(out,a[j],a[k],b[j]);tri(out,a[k],b[k],b[j]);}
   if(!active[i-1])for(let j=1;j<a.length-1;j++)tri(out,a[0],a[j+1],a[j]);
   if(!active[end])for(let j=1;j<b.length-1;j++)tri(out,b[0],b[j],b[j+1]);i=end;
  }return out;
 }
 function mesh(vertices,material,kind='wall'){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();g.computeBoundingBox();const m=new T.Mesh(g,material);if(vertices.length>=9)m.userData.driveCollider=kind;m.userData.structure=true;m.userData.cameraOccluderRole='structure';m.castShadow=true;m.receiveShadow=true;return m;}
 function sample(points,s){let i=0;while(i<points.length-2&&(points[i+1].s??i+1)<s)i++;const a=points[i],b=points[i+1],u=Math.max(0,Math.min(1,(s-a.s)/(b.s-a.s||1)));return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u,s,bridge:(a.bridge||0)+((b.bridge||0)-(a.bridge||0))*u,heading:Math.atan2(b.x-a.x,b.z-a.z),index:i};}
 const W=[[-.044,.818],[.037,.862],[-.033,.975],[.037,1.087],[-.044,1.132],[-.054,1.12],[.025,1.082],[-.046,.975],[.025,.867],[-.054,.830]];
 const wall=[[-.26,.22],[.26,.22],[.26,.44],[.17,.64],[.11,1.42],[-.11,1.42],[-.17,.64],[-.26,.44]];
 function barriers(points,offset,{mask=()=>true,bridgeWeight=()=>0}={}){
  const originalMask=mask,cache=new WeakMap();mask=(p,i,q)=>{if(points[i]!==p)return originalMask(p,i,q);if(!cache.has(p))cache.set(p,originalMask(p,i,q));return cache.get(p);};
  const steelMask=(p,i,q)=>mask(p,i,q)&&Math.min(bridgeWeight(p),bridgeWeight(q))<.8;
  const metalVertices=sweep(points,W,offset,steelMask),concreteVertices=sweep(points,p=>wall.map(([x,y])=>[x,.22+(y-.22)*Math.max(0,Math.min(1,bridgeWeight(p)))]),offset,(p,i,q)=>mask(p,i,q)&&Math.max(bridgeWeight(p),bridgeWeight(q))>.01);
  const first=points[0].s,last=points.at(-1).s;
  for(let s=Math.ceil(first/4)*4;s<last;s+=4){const p=sample(points,s),i=p.index;if(!mask(p,i,points[Math.min(i+1,points.length-1)])||bridgeWeight(p)>.8)continue;const q={...p,x:p.x+Math.sin(p.heading)*.14,z:p.z+Math.cos(p.heading)*.14,s:s+.14};metalVertices.push(...sweep([p,q],[[-.07,.22],[.07,.22],[.07,1.13],[-.07,1.13]],offset));}
  const a=mesh(metalVertices,metal),b=mesh(concreteVertices,concrete);a.userData.structureType='steel-guardrail';b.userData.structureType='concrete-barrier';a.userData.cameraOccluderRole=b.userData.cameraOccluderRole='road-edge';return[a,b];
 }
 function deck(points,width,offset=0,mask=()=>true){const top=[],profile=typeof width==='function'?((p,i)=>{const b=width(p,i),w=b.outer-b.inner,c=(b.outer+b.inner)/2,a=b.innerY||0,z=b.outerY||0;return[[b.inner,.19+a],[b.outer,.19+z],[b.outer,-.06+z],[c+w*.37,-1.58+a*.13+z*.87],[c-w*.37,-1.58+a*.87+z*.13],[b.inner,-.06+a]];}):[[-width/2,.19],[width/2,.19],[width/2,-.06],[width*.37,-1.58],[-width*.37,-1.58],[-width/2,-.06]];const m=mesh(sweep(points,profile,typeof width==='function'?0:offset,mask,top),concrete);m.userData.driveTopTriangles=top;m.userData.structureType='box-girder';m.userData.cameraOccluderRole='road-deck';return m;}
 function supports(points,width,{groundHeight,clear=()=>true,bridgeWeight=()=>1,spacing=30}={}){const parts=[],sites=[];
  const legalMemo=new Map();const legal=p=>{if(legalMemo.has(p.s))return legalMemo.get(p.s);let ok=false;if(bridgeWeight(p)>=.8){const ground=groundHeight(p.x,p.z),bottom=p.y-1.58,capWidth=Math.max(1.4,width*.67);if(bottom-ground>=.75)ok=[-1,0,1].every(side=>[-1,1].every(end=>clear(p.x-Math.cos(p.heading)*side*(capWidth/2+.15)+Math.sin(p.heading)*end*.85,p.z+Math.sin(p.heading)*side*(capWidth/2+.15)+Math.cos(p.heading)*end*.85,p.y)));}legalMemo.set(p.s,ok);return ok;};
  // Search either side of a nominal pier instead of deleting the support as
  // soon as its centre falls in a lower road. The complete cap is clearance-tested.
  for(let s=Math.ceil(points[0].s/spacing)*spacing;s<points.at(-1).s;s+=spacing){let chosen=null;for(const d of [0,-3,3,-6,6,-9,9,-12,12]){const at=s+d;if(at<points[0].s||at>=points.at(-1).s)continue;const p=sample(points,at);if(legal(p)&&sites.every(q=>Math.abs(q.s-at)>12)){chosen=p;break;}}if(chosen)sites.push(chosen);}
  sites.sort((a,b)=>a.s-b.s);
  // For a wide crossing, put approach piers close to each protected envelope.
  // This avoids an arbitrary 90m gap left by skipping two 30m grid locations.
  for(let i=1;i<sites.length;i++){const a=sites[i-1],b=sites[i];if(b.s-a.s<45)continue;const extra=[];for(let at=a.s+15;at<=b.s-15;at+=2){const p=sample(points,at);if(legal(p))extra.push(p);}if(extra.length){const centre=(a.s+b.s)/2,near=extra.reduce((u,v)=>Math.abs(u.s-centre)<Math.abs(v.s-centre)?u:v);sites.splice(i,0,near);i--;}}
  for(const p of sites){const ground=groundHeight(p.x,p.z),bottom=p.y-1.58,capWidth=Math.max(1.4,width*.67),capBottom=bottom-.45,shaftTop=capBottom+.04,shaftWidth=width>9?1.6:1.0;
   const addBox=(w,h,d,y)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),concrete);m.position.set(p.x,y,p.z);m.rotation.y=p.heading;m.userData.driveCollider='wall';m.userData.structureType='bridge-pier';m.castShadow=m.receiveShadow=true;parts.push(m);};
   addBox(capWidth,.45,1.4,bottom-.225);addBox(shaftWidth,shaftTop-ground+.6,shaftWidth,(shaftTop+ground-.6)/2);
  }const vertices=[];for(const part of parts){part.updateMatrix();const attr=part.geometry.attributes.position,idx=part.geometry.index,v=new T.Vector3();for(let i=0;i<idx.count;i++){v.fromBufferAttribute(attr,idx.getX(i)).applyMatrix4(part.matrix);vertices.push(v.x,v.y,v.z);}part.geometry.dispose();}const combined=mesh(vertices,concrete);combined.userData.structureType='bridge-piers';combined.userData.pierStations=sites.map(p=>p.s);return[combined];
 }
 return{sweep,mesh,barriers,deck,supports};
}
