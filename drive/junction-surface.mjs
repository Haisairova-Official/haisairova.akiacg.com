// One owner for same-level pavement at a Y. The secondary arm is clipped
// exactly to the primary arm's sampled inner edge; route centre lines stay intact.
export function createYSurfaceBounds(path,primary,{heightTolerance=.035}={}){
 const inner=(path.offset||0)-path.width/2,outer=(path.offset||0)+path.width/2;
 if(!primary)return()=>({inner,outer});
 const edge=(p,i)=>{const a=primary.points[Math.max(0,i-1)],b=primary.points[Math.min(primary.points.length-1,i+1)],h=p.heading??Math.atan2(b.x-a.x,b.z-a.z),o=(primary.offset||0)-primary.width/2;return{x:p.x-Math.cos(h)*o,z:p.z+Math.sin(h)*o,y:p.y,h};};
 const points=primary.points.map(edge),segments=points.slice(0,-1).map((a,i)=>({a,b:points[i+1]})),memo=new WeakMap(),cells=new Map(),cellSize=32;
 for(const segment of segments){const{a,b}=segment;for(let x=Math.floor(Math.min(a.x,b.x)/cellSize);x<=Math.floor(Math.max(a.x,b.x)/cellSize);x++)for(let z=Math.floor(Math.min(a.z,b.z)/cellSize);z<=Math.floor(Math.max(a.z,b.z)/cellSize);z++){const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(segment);}}
 return(p,index=0)=>{if(memo.has(p))return memo.get(p);const a=path.points[Math.max(0,index-1)],b=path.points[Math.min(path.points.length-1,index+1)],h=p.heading??Math.atan2(b.x-a.x,b.z-a.z),nx=-Math.cos(h),nz=Math.sin(h);let end=outer,outerY=0;
  const nearby=new Set();for(let x=Math.floor((p.x-9)/cellSize);x<=Math.floor((p.x+9)/cellSize);x++)for(let z=Math.floor((p.z-9)/cellSize);z<=Math.floor((p.z+9)/cellSize);z++)for(const segment of cells.get(x+','+z)||[])nearby.add(segment);
  for(const {a,b}of nearby){if(Math.min(a.x,b.x)>p.x+9||Math.max(a.x,b.x)<p.x-9||Math.min(a.z,b.z)>p.z+9||Math.max(a.z,b.z)<p.z-9||Math.cos(h-a.h)<.95)continue;const dx=b.x-a.x,dz=b.z-a.z,den=nx*dz-nz*dx;if(Math.abs(den)<1e-9)continue;const rx=a.x-p.x,rz=a.z-p.z,t=(rx*dz-rz*dx)/den,u=(rx*nz-rz*nx)/den;
   if(u<-.000001||u>1.000001||Math.abs(a.y+(b.y-a.y)*u-p.y)>heightTolerance||t>outer+.001||t<inner-.1)continue;if(t<end){end=Math.max(inner,t);outerY=a.y+(b.y-a.y)*u-p.y;}
  }const result={inner,outer:end,outerY,innerY:end-inner<1e-8?outerY:0};memo.set(p,result);return result;
 };
}

// Subtract the primary sampled strip itself, including every bend vertex.
// Used for horizontal top/bottom faces so the seam is not an approximate chord.
export function createFlatSurfaceCutter(primary,{lift=.22,scale=1,geometries=null}={}){
 const f=Math.fround,cells=new Map(),size=16,polys=[];
 const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
 const edge=(p,i,side)=>{const a=primary.points[Math.max(0,i-1)],b=primary.points[Math.min(primary.points.length-1,i+1)],h=p.heading??Math.atan2(b.x-a.x,b.z-a.z),o=(primary.offset||0)+side*primary.width*scale/2;return[f(p.x-Math.cos(h)*o),f(p.y+lift),f(p.z+Math.sin(h)*o)];};
 const add=vertices=>{const xs=vertices.map(p=>p[0]),zs=vertices.map(p=>p[2]),poly={vertices,minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs),y:vertices[0][1]};if(Math.abs(cross(vertices[0],vertices[1],vertices[2]))<1e-9)return;if(cross(vertices[0],vertices[1],vertices[2])<0)vertices.reverse();polys.push(poly);for(let x=Math.floor(poly.minX/size);x<=Math.floor(poly.maxX/size);x++)for(let z=Math.floor(poly.minZ/size);z<=Math.floor(poly.maxZ/size);z++){const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(poly);}};
 if(geometries){for(const g of geometries){const p=g.attributes.position,ix=g.index,count=ix?.count||p.count;for(let i=0;i<count;i+=3){const vertices=[0,1,2].map(k=>{const j=ix?ix.getX(i+k):i+k;return[p.getX(j),p.getY(j),p.getZ(j)];});if(vertices.every(v=>Math.abs(v[1]-vertices[0][1])<1e-5))add(vertices);}}}
 else for(let i=0;i<primary.points.length-1;i++){const a=primary.points[i],b=primary.points[i+1];if(Math.abs(a.y-b.y)>1e-7)continue;add([edge(a,i,-1),edge(a,i,1),edge(b,i+1,1),edge(b,i+1,-1)]);}

 function subtract(points,target){let remaining=points,parts=[];for(let i=0;i<target.vertices.length&&remaining.length>=3;i++){const a=target.vertices[i],b=target.vertices[(i+1)%target.vertices.length],inside=[],outside=[];for(let j=0;j<remaining.length;j++){const p=remaining[j],q=remaining[(j+1)%remaining.length],dp=cross(a,b,p),dq=cross(a,b,q),pin=dp>=-1e-9,qin=dq>=-1e-9;(pin?inside:outside).push(p);if(pin!==qin){const t=dp/(dp-dq),v=p.map((n,k)=>n+(q[k]-n)*t);inside.push(v);outside.push(v);}}if(outside.length>=3)parts.push(outside);remaining=inside;}return parts;}
 return(vertices)=>{const out=[];for(let i=0;i<vertices.length;i+=9){const triangle=[Array.from(vertices.slice(i,i+3)),Array.from(vertices.slice(i+3,i+6)),Array.from(vertices.slice(i+6,i+9))];if(Math.abs(triangle[0][1]-triangle[1][1])>1e-5||Math.abs(triangle[0][1]-triangle[2][1])>1e-5){out.push(...vertices.slice(i,i+9));continue;}const xs=triangle.map(p=>p[0]),zs=triangle.map(p=>p[2]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs),nearby=new Set();for(let x=Math.floor(minX/size);x<=Math.floor(maxX/size);x++)for(let z=Math.floor(minZ/size);z<=Math.floor(maxZ/size);z++)for(const poly of cells.get(x+','+z)||[])if(Math.abs(poly.y-triangle[0][1])<1e-5&&poly.minX<=maxX&&poly.maxX>=minX&&poly.minZ<=maxZ&&poly.maxZ>=minZ)nearby.add(poly);let pieces=[triangle];for(const poly of nearby)pieces=pieces.flatMap(p=>subtract(p,poly));const orientation=Math.sign(cross(...triangle));for(const p of pieces)for(let j=1;j<p.length-1;j++){const a=p[0].map(f),b=p[j].map(f),c=p[j+1].map(f);if(cross(a,b,c)*orientation>1e-8)out.push(...a,...b,...c);}}return new Float32Array(out);};
}
export function cutFlatGeometry(T,geometry,cutter){const flat=geometry.index?geometry.toNonIndexed():geometry,a=cutter(flat.attributes.position.array),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(a,3));g.computeVertexNormals();g.computeBoundingBox();if(flat!==geometry)flat.dispose();geometry.dispose();return g;}
