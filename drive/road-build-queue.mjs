// One queue per world, pumped once per rendered frame. Geometry suboperations
// and individual collider imports yield to the same budget.
export function createRoadBuildQueue({budgetMs=3.5,clock=()=>performance.now()}={}){
 const pending=new Map();let maxSliceMs=0,maxSliceKey='',forcedJobs=0;
 const distance=(b,p)=>Math.hypot(Math.max(b.minX-p.x,0,p.x-b.maxX),Math.max(b.minZ-p.z,0,p.z-b.maxZ));
 const advance=job=>{const at=clock(),next=job.iterator.next();const ms=clock()-at;if(ms>maxSliceMs){maxSliceMs=ms;maxSliceKey=job.key+':'+(next.value||'operation');}if(next.done){pending.delete(job.key);job.activate();return false;}return true;};
 return{add(key,iterator,bounds,activate=()=>{},options={}){pending.set(key,{key,iterator,bounds,activate,...options});},cancel(key){const job=pending.get(key);job?.iterator.return?.();pending.delete(key);},
 ensure(position,forceKeys=[],actors=[]){for(const job of [...pending.values()])if(forceKeys.includes(job.key)||distance(job.bounds,position)<(job.forceDistance??700)||(job.actorDistance&&actors.some(p=>distance(job.bounds,p)<job.actorDistance))){forcedJobs++;while(pending.has(job.key))advance(job);}},
 flush(){while(pending.size)advance(pending.values().next().value);},
 pump(position,budget=budgetMs){const at=clock(),jobs=[...pending.values()].sort((a,b)=>distance(a.bounds,position)-distance(b.bounds,position));for(const job of jobs)while(pending.has(job.key)){advance(job);if(clock()-at>=budget)return;}},
 get size(){return pending.size;},get stats(){return{pending:pending.size,maxSliceMs,maxSliceKey,forcedJobs};}};
}
export function roadBuildSlices(points,maxSpan=80){const decorated=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];return {...p,heading:p.heading??Math.atan2(b.x-a.x,b.z-a.z)};}),slices=[];let from=0;for(let i=1;i<decorated.length;i++)if(decorated[i].s-decorated[from].s>=maxSpan||i===decorated.length-1){slices.push(decorated.slice(from,i+1));from=i;}return slices;}
