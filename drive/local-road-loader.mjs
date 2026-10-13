// Geometry planning runs in a module worker where supported. The current town
// remains fully drivable until the complete, validated component is received.
export function createLocalRoadLoader({workerFactory=typeof Worker==='function'?()=>new Worker(new URL('./local-road-worker.mjs?rev=world21d',import.meta.url),{type:'module'}):null,buildSync}={}){
 let worker=null,serial=0;const cache=new Map(),jobs=new Map();
 const trim=()=>{while(cache.size>3)cache.delete(cache.keys().next().value);};
 function request(key,payload){if(cache.has(key))return cache.get(key);if(jobs.has(key))return null;if(!workerFactory){const result=buildSync(payload);cache.set(key,result);trim();return result;}
  if(!worker){try{worker=workerFactory();worker.onmessage=e=>{const m=e.data,j=jobs.get(m.key);if(!j||j.id!==m.id)return;jobs.delete(m.key);cache.set(m.key,m.result||{graphs:[],error:m.error||'local-planning-failed'});trim();};worker.onerror=()=>{for(const[key]of jobs)cache.set(key,{graphs:[],error:'local-worker-unavailable'});jobs.clear();worker?.terminate();worker=null;trim();};}catch{cache.set(key,{graphs:[],error:'local-worker-unavailable'});trim();return cache.get(key);}}
  const id=++serial;jobs.set(key,{id});worker.postMessage({key,id,...payload});return null;
 }
 return{request,get pending(){return jobs.size;},get cached(){return cache.size;},dispose(){worker?.terminate();worker=null;jobs.clear();cache.clear();}};
}

// Authoring access meshes/profile diagnostics are not runtime graph state. Avoid
// cloning their repeated samples into the main thread on every prepared cell.
export function compactLocalCellResult(result){return{...result,graphs:result.graphs.map(g=>{const{accesses,profile,...graph}=g;return{...graph,ports:g.ports.map(({through,inbound,outbound,...port})=>port),itineraries:g.itineraries.map(path=>({...path,points:path.points.map(({x,z,y,s,heading,grade})=>({x,z,y,s,heading,grade}))})),laneEdges:g.laneEdges.map(edge=>({...edge,points:edge.points.map(({x,z,y,s,heading,grade})=>({x,z,y,s,heading,grade}))}))};})};}
