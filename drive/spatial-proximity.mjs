// Snapshot nearby actors once per collider-sync pass. Grid buckets only prune
// candidates; the final circle/AABB distance test is unchanged and exact.
export function createActorProximity(traffic,cell=256){
 const actors=[],buckets=new Map();
 for(const t of traffic){const p=t.physical||t;actors.push({x:p.x,z:p.z});const trailer=t.physical?.trailer||t.trailerPose;if(trailer)actors.push({x:trailer.x,z:trailer.z});}
 actors.forEach((p,i)=>{for(let z=Math.floor((p.z-160)/cell);z<=Math.floor((p.z+160)/cell);z++)for(let x=Math.floor((p.x-160)/cell);x<=Math.floor((p.x+160)/cell);x++){const key=x+','+z,list=buckets.get(key)||[];list.push(i);buckets.set(key,list);}});
 const visited=new Uint32Array(actors.length);let serial=0;
 return(lo,hi,margin=0)=>{const radius=100+margin,r2=radius*radius,near=p=>{const dx=Math.max(lo.x-p.x,0,p.x-hi.x),dz=Math.max(lo.z-p.z,0,p.z-hi.z);return dx*dx+dz*dz<r2;},minX=Math.floor(lo.x/cell),maxX=Math.floor(hi.x/cell),minZ=Math.floor(lo.z/cell),maxZ=Math.floor(hi.z/cell);
  if(margin>60||(maxX-minX+1)*(maxZ-minZ+1)>64)return actors.some(near);
  serial++;if(serial===0xffffffff){visited.fill(0);serial=1;}
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++)for(const i of buckets.get(x+','+z)||[]){if(visited[i]===serial)continue;visited[i]=serial;if(near(actors[i]))return true;}return false;
 };
}
