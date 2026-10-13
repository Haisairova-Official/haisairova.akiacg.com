// Connector point arrays are immutable graph products. A changed path object,
// point array or geometry key retires its buckets before any query is served.
// Unchanged paths keep the same entries across neighbouring graph-cell changes.
export function createRoadSegmentIndex(cellSize=40){
 const cells=new Map(),paths=new Map(),queryCache=new Map();let builtPaths=0,retiredPaths=0,cachedEntries=0,cacheHits=0,cacheMisses=0,cacheInvalidations=0;
 function remove(record,dirty){for(const key of record.cells.keys()){const bucket=cells.get(key);bucket.paths.delete(record.path.id);if(!bucket.paths.size)cells.delete(key);else dirty.add(key);}retiredPaths++;}
 function sync(source){
  const before=builtPaths+retiredPaths;
  const alive=new Map(source.filter(p=>!p.renderSuppressed).map(p=>[p.id,p])),dirty=new Set();
  for(const[id,record]of paths){const path=alive.get(id),points=path&&(path.renderPoints||path.points);if(path!==record.path||points!==record.points||points?.length!==record.length||path?.geometryKey!==record.geometryKey){remove(record,dirty);paths.delete(id);}}
  for(const[id,path]of alive){if(paths.has(id))continue;const points=path.renderPoints||path.points,record={path,points,length:points.length,geometryKey:path.geometryKey,cells:new Map(),segments:Math.max(0,points.length-1)};
   for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],entry={path,a,b};for(let ix=Math.floor(Math.min(a.x,b.x)/cellSize);ix<=Math.floor(Math.max(a.x,b.x)/cellSize);ix++)for(let iz=Math.floor(Math.min(a.z,b.z)/cellSize);iz<=Math.floor(Math.max(a.z,b.z)/cellSize);iz++){const key=ix+','+iz,list=record.cells.get(key)||[];list.push(entry);record.cells.set(key,list);}}
   for(const[key,list]of record.cells){let bucket=cells.get(key);if(!bucket)cells.set(key,bucket={paths:new Map(),entries:[]});bucket.paths.set(id,list);dirty.add(key);}paths.set(id,record);builtPaths++;
  }
  // Queries are much more frequent than graph changes. Flatten only changed
  // buckets once, instead of paying nested Map iteration on every terrain ray.
  for(const key of dirty){const bucket=cells.get(key);if(!bucket)continue;const entries=[];for(const list of bucket.paths.values())for(const entry of list)entries.push(entry);bucket.entries=entries;}
  if(builtPaths+retiredPaths!==before){queryCache.clear();cachedEntries=0;cacheInvalidations++;}
 }
 // Nearby construction samples repeatedly touch the same cell rectangle.
 // Cache the exact union, never a distance/height approximation. The runtime
 // receives an immutable iterable; the legacy Set API remains a private copy.
 function nearReadonly(x,z,pad=16){const minX=Math.floor((x-pad)/cellSize),maxX=Math.floor((x+pad)/cellSize),minZ=Math.floor((z-pad)/cellSize),maxZ=Math.floor((z+pad)/cellSize),key=[minX,maxX,minZ,maxZ].join(',');const prior=queryCache.get(key);if(prior){cacheHits++;return prior;}cacheMisses++;const result=new Set();for(let ix=minX;ix<=maxX;ix++)for(let iz=minZ;iz<=maxZ;iz++)for(const entry of cells.get(ix+','+iz)?.entries||[])result.add(entry);const list=Object.freeze([...result]);if(list.length<=8192){while(queryCache.size>=128||cachedEntries+list.length>32768){const oldest=queryCache.keys().next().value;cachedEntries-=queryCache.get(oldest).length;queryCache.delete(oldest);}queryCache.set(key,list);cachedEntries+=list.length;}return list;}
 function near(x,z,pad=16){return new Set(nearReadonly(x,z,pad));}
 return{sync,near,nearReadonly,get cacheStats(){return{queries:queryCache.size,entries:cachedEntries,hits:cacheHits,misses:cacheMisses,invalidations:cacheInvalidations};},get stats(){return{paths:paths.size,cells:cells.size,segments:[...paths.values()].reduce((n,r)=>n+r.segments,0),builtPaths,retiredPaths};}};
}
