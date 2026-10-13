// Every visible house face is also part of the same static collision mesh.
export function createScenicMaterials(T){return{house:new T.MeshStandardMaterial({vertexColors:true,roughness:.9}),water:new T.MeshStandardMaterial({color:0x628f91,roughness:.3,metalness:.12})};}
export function buildScenicMeshes(T,plan,terrainPositions,materials){
 const result=[];
 for(const h of plan.houses){const p=[],colors=[],c=new T.Color(),tones=[0xd7cdb5,0xbabeb3,0xe1d6c1,0xb7b9aa],add=(g,x,y,z,color)=>{if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}const a=g.attributes.position;c.setHex(color);for(let i=0;i<a.count;i++){p.push(a.getX(i)+x,a.getY(i)+y,a.getZ(i)+z);colors.push(c.r,c.g,c.b);}g.dispose();},w=h.width,d=h.depth,base=h.y;
  add(new T.BoxGeometry(w,h.height,d),h.x,base+h.height/2,h.z,tones[h.tone]);
  add(new T.BoxGeometry(w+.8,.45,d+.8),h.x,base-.2,h.z,0x999c8c);
  const a=[-w/2-.7,h.height,-d/2-.6],b=[w/2+.7,h.height,-d/2-.6],cc=[0,h.height+h.roof,-d/2-.6],e=[a[0],a[1],d/2+.6],f=[b[0],b[1],d/2+.6],g=[0,cc[1],d/2+.6],v=[];
  for(const tri of[[a,cc,b],[e,f,g],[a,e,cc],[e,g,cc],[cc,g,b],[g,f,b],[a,b,e],[b,f,e]])for(const q of tri)v.push(...q);const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute(v,3));add(roof,h.x,base,h.z,h.tone%2?0x62696a:0x987360);
  for(const side of[-1,1])for(const xx of[-.27,.27])for(const yy of h.height>5?[1.7,4.6]:[1.9])add(new T.BoxGeometry(1.5,1.5,.04),h.x+xx*w,base+yy,h.z+side*(d/2+.025),0x668491);
  add(new T.BoxGeometry(1.6,2.35,.06),h.x,base+1.175,h.z+d/2+.045,0x725f4f);
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();const mesh=new T.Mesh(geo,materials.house);mesh.userData={driveCollider:'wall',cameraOccluderRole:'building',scenicBuilding:true,scenicId:h.id};mesh.receiveShadow=true;result.push(mesh);
 }
 for(const lake of plan.lakes){const out=[];for(let i=0;i<terrainPositions.length;i+=9){const tri=[0,3,6].map(j=>({x:terrainPositions[i+j],y:terrainPositions[i+j+1],z:terrainPositions[i+j+2]}));if(!tri.some(p=>p.y<lake.level&&Math.hypot((p.x-lake.x)/lake.rx,(p.z-lake.z)/lake.rz)<1.3))continue;const poly=[];for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],inside=a.y<lake.level,next=b.y<lake.level;if(inside)poly.push({x:a.x,z:a.z});if(inside!==next){const t=(lake.level-a.y)/(b.y-a.y);poly.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}}
   for(let j=1;j<poly.length-1;j++){const tri=[poly[0],poly[j],poly[j+1]].map(q=>({x:Math.fround(q.x),z:Math.fround(q.z)})),[a,b,c]=tri,area=(b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z);if(area<1e-4)continue;for(const q of tri)out.push(q.x,lake.level+.015,q.z);}
  }if(out.length){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(out,3));geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();const mesh=new T.Mesh(geo,materials.water);mesh.userData.scenicLake=lake.id;mesh.userData.waterLevel=lake.level;result.push(mesh);}
 }
 return result;
}
