// Custom game scoring, not a statement about traffic law. Pure deterministic logic.
export const MONITOR_WARNING_DISTANCE=300,MONITOR_WINDOW=70;
export function monitorAt(index){
 // Pick reproducibly from the open mainline before each second interchange.
 // Both the gantry and its warning are >=70m from split/merge endpoints;
 // neither is on the raised crossing. First warning is beyond the entrance.
 let hash=(index+1)>>>0;hash=Math.imul(hash^(hash>>>16),0x45d9f3b);hash=Math.imul(hash^(hash>>>16),0x45d9f3b);hash=(hash^(hash>>>16))>>>0;
 const x=40+(index*2+1)*720-350+(hash%51);
 return {id:index,x,warningX:x-MONITOR_WARNING_DISTANCE};
}
export function monitorIndices(x){const n=Math.max(0,Math.floor((x-40)/1440));return [Math.max(0,n-1),n,n+1].filter((v,i,a)=>a.indexOf(v)===i);}
export function speedScore(kmh){
 if(kmh<60)return {points:-50,label:'速度过低'};
 if(kmh<100)return {points:0,label:'正常通过'};
 if(kmh<=120)return {points:50,label:'达速通过'};
 if(kmh<=144)return {points:0,label:'准许范围'};
 if(kmh<180)return {points:-200,label:'超速'};
 return {points:-500,label:'严重超速'};
}
export const createMonitor=()=>({time:0,total:0,events:[],settled:new Set(),pending:new Map(),previous:null,relations:new Map(),passes:[],changes:[],stableLane:null,lineTime:0,lineEvidence:[],serial:0,furthest:40});
export function resetMonitorJourney(m){m.previous=null;m.relations.clear();m.passes=[];m.changes=[];m.stableLane=null;m.lineTime=0;m.lineEvidence=[];m.pending.clear();m.signalEvidence=null;}
// Extents in the current directed road frame, including articulated parts.
const bodySpan=p=>(p.bodyOccupancy||[p]).reduce((out,b)=>{const h=b.heading??Math.PI/2,half=(b.length||4)*.5*Math.abs(Math.sin(h))+(b.width||1.8)*.5*Math.abs(Math.cos(h));return{front:Math.max(out.front,b.x+half),rear:Math.min(out.rear,b.x-half)};},{front:-Infinity,rear:Infinity});
function emit(m,id,kind,points,label,extra={}){const key=`${id}:${kind}`;if(m.events.some(e=>e.key===key))return false;m.total+=points;m.events.push({key,id,kind,points,label,time:m.time,...extra});if(m.events.length>60)m.events.shift();m.serial++;return true;}
export function stepMonitor(m,p,traffic,dt,enabled=true){
 m.time+=dt;
 if(!enabled){resetMonitorJourney(m);return [];}
 const serial=m.serial;
 const now={x:p.x,z:p.z,speed:Math.hypot(p.vx??p.speed,p.vz??0)*3.6};
 const old=m.previous;m.previous=now;
 if(m.road!==p.roadId){m.road=p.roadId;m.pending.clear();m.previous=now;m.relations.clear();m.passes=[];m.changes=[];m.stableLane=null;m.lineEvidence=[];m.lineTime=0;return [];}
 if(!old)return [];
 const forward=now.x>old.x+.000001&&Math.sin(p.heading??Math.PI/2)>.5;
 const centers=p.laneCenters||[13,19,25],lane=centers.reduce((best,z,i)=>Math.abs(p.z-z)<Math.abs(p.z-centers[best])?i:best,0),center=centers[lane];
 if(m.stableLane===null)m.stableLane=lane;
 if(Math.abs(p.z-center)<1.2&&lane!==m.stableLane){
  const side=Math.sign(m.stableLane-lane),evidence={time:m.time,x:p.x,side,signalled:m.signalEvidence?.side===side&&m.time-m.signalEvidence.time<5};
  m.changes.push(evidence);m.stableLane=lane;
 }
 if(p.signalSide)m.signalEvidence={side:p.signalSide,time:m.time};
 m.changes=m.changes.filter(e=>m.time-e.time<=5);
 // Body occupancy includes heading; a normal continuing lateral traverse cannot accrue 1.4s.
 const halfWidth=(p.width||1.8)*.5*Math.abs(Math.sin(p.heading??Math.PI/2))+(p.length||4)*.5*Math.abs(Math.cos(p.heading??Math.PI/2));
 const boundaries=centers.slice(1).map((z,i)=>(z+centers[i])/2);const straddle=(p.bodyOccupancy||[p]).some(b=>{const half=(b.width||1.8)*.5*Math.abs(Math.sin(b.heading??Math.PI/2))+(b.length||4)*.5*Math.abs(Math.cos(b.heading??Math.PI/2));return boundaries.some(z=>Math.abs(b.z-z)<half-.06);});
 const lateral=Math.abs((now.z-old.z)/dt);
 if(straddle&&forward&&lateral<.55)m.lineTime+=dt;else m.lineTime=0;
 if(m.lineTime>=1.4)m.lineEvidence.push({time:m.time,x:p.x});
 m.lineEvidence=m.lineEvidence.filter(e=>m.time-e.time<8&&Math.abs(e.x-p.x)<160);
 const live=new Set(traffic.filter(t=>t.direction>0).map(t=>`${t.id}:${t.generation||0}`));for(const key of m.relations.keys())if(!live.has(key))m.relations.delete(key);
 const playerSpan=bodySpan(p);
 for(const t of traffic){if(t.direction<0)continue;const key=`${t.id}:${t.generation||0}`,other=bodySpan(t);let relation=m.relations.get(key);
  if(!relation){relation={armed:false,done:false,change:null,started:m.time,collisions:p.collisions||0};m.relations.set(key,relation);}
  if(relation.done)continue;
  if(!forward||(p.collisions||0)>relation.collisions){relation.armed=false;relation.change=null;relation.started=m.time;relation.collisions=p.collisions||0;continue;}
  if(playerSpan.front<other.rear&&!relation.armed){relation.armed=true;relation.started=m.time;}
  // Bind the indicator evidence to this encounter before it expires globally.
  if(relation.armed){const change=[...m.changes].reverse().find(e=>e.time>=relation.started-dt-.001&&e.time>(relation.change?.time??-Infinity));if(change)relation.change={...change};}
  if(relation.armed&&playerSpan.rear>other.front&&Math.abs(p.z-t.z)<7.5&&Math.abs(p.z-t.z)>1.7){
   relation.done=true;const change=relation.change;if(change)m.passes.push({id:key,time:m.time,x:p.x,signalled:change.signalled,side:change.side});
  }
 }
 m.passes=m.passes.filter(e=>m.time-e.time<10&&Math.abs(e.x-p.x)<180);
 const lo=Math.max(p.unbounded?-Infinity:0,Math.floor((Math.min(old.x,now.x)-500)/1440));
 const hi=Math.max(lo,Math.ceil((Math.max(old.x,now.x)+500)/1440));
 if(forward)for(let i=lo;i<=hi;i++){const point=(p.monitorAt||monitorAt)(i),identity=p.roadId?`${p.roadId}:${i}`:i;if(old.x<point.x&&now.x>=point.x&&!m.settled.has(identity)){
  m.settled.add(identity);const a=(point.x-old.x)/(now.x-old.x),speed=old.speed+(now.speed-old.speed)*a;
  m.pending.set(identity,{...point,speed,crossed:m.time});const r=speedScore(speed);emit(m,identity,'speed',r.points,r.label,{speed});
 }}
 for(const [id,e] of m.pending){
  if(m.passes.some(v=>!v.signalled&&Math.abs(v.x-e.x)<=MONITOR_WINDOW)){emit(m,id,'signal',-50,'超车未打对应方向灯');}
  if(m.lineEvidence.some(v=>Math.abs(v.x-e.x)<=MONITOR_WINDOW)){emit(m,id,'line',-100,'持续骑线');}
  if(p.x>e.x+MONITOR_WINDOW||m.time-e.crossed>10)m.pending.delete(id);
 }
 m.furthest=Math.max(m.furthest,p.x);
 return m.serial!==serial?m.events.filter(e=>e.time===m.time):[];
}
