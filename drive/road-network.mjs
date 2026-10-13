import {tollSection} from './toll-layout.mjs?rev=world21d';
import {buildMotorwayJunction,junctionChoiceKey,MOTORWAY_JUNCTION_TYPES} from './motorway-junctions.mjs?rev=world21d';
import {buildServicePair,servicePadProjection,serviceApronContains} from './service-network.mjs?rev=world21d';
import {buildArchiveAlternatives} from './archive-network.mjs?rev=world21d';
import {createRoadSegmentIndex} from './road-spatial-index.mjs?rev=world21d';
// Two directed motorway corridors share one spatial road graph. Distances are m.
// Geometry is illustrative and scaled for play; it is not a civil-engineering design.
import {annotate,bezier,projectPath} from './interchange-logic.mjs?rev=world21d';
export const NETWORK_CENTRE={x:2200,z:5.5};
export const LANE_WIDTH=3.75,LANE_SCALE=LANE_WIDTH/6,MAIN_WIDTH=15.0,OUTER_LANE=3.75;
export const NETWORK_SEED=7127,GRID_SIZE=6000,JUNCTION_APPROACH=1200;
export const roadFamily=id=>id.slice(0,-1),roadSign=id=>id.endsWith('+')?1:-1;
export const familyAt=(horizontal,index)=>horizontal?(index===0?'A':index===1?'C':`H${index}`):(index===0?'B':index===1?'D':`V${index}`);
export const MOTORWAY_DEFS={},MOTORWAY_NAMES={},MOTORWAYS=[],RENDER_MOTORWAYS=[],JUNCTIONS=[];
export function defineMotorway(horizontal,index){const key=familyAt(horizontal,index);if(!MOTORWAY_DEFS[key]){const lanes=key==='A'?3:key==='B'?2:key==='C'?4:2+Math.floor(seededNoise(index,horizontal?31:47,NETWORK_SEED)*3),names=['青川','松岚','临江','海原','云溪','锦山'];MOTORWAY_DEFS[key]={name:({A:'云岭高速',B:'江湾高速',C:'海岚高速',D:'青原高速'})[key]||`${names[Math.abs(index)%names.length]}${horizontal?'东西':'南北'}高速`,number:({A:'S01',B:'S02',C:'S03',D:'S04'})[key]||`S${horizontal?'1':'2'}${Math.abs(index)*2+(index<0?1:0)+10}`,x:NETWORK_CENTRE.x+(horizontal?0:index*GRID_SIZE),z:NETWORK_CENTRE.z+(horizontal?index*GRID_SIZE:0),horizontal,index,lanes};MOTORWAY_NAMES[key]=MOTORWAY_DEFS[key].name;}return key;}
for(const [h,i]of [[true,0],[false,0],[true,1],[false,1]])defineMotorway(h,i);
export const laneCount=id=>MOTORWAY_DEFS[roadFamily(id)].lanes;
export const laneOffsets=id=>Array.from({length:laneCount(id)},(_,i)=>(i-(laneCount(id)-1)/2)*LANE_WIDTH);
export const virtualLanes=id=>laneOffsets(id).map(v=>19+v/LANE_SCALE);
export const outerLane=id=>laneOffsets(id).at(-1);
// Shared metre-scale section: 2m median, .75m inner hard strip, 3m emergency
// shoulder and .75m outer earth verge. Width follows this road's own lane count.
export const MEDIAN_WIDTH=2,INNER_HARD_SHOULDER=.75,EMERGENCY_SHOULDER=3,EARTH_SHOULDER=.75;
export const carriagewayOffset=id=>laneCount(id)*LANE_WIDTH/2+INNER_HARD_SHOULDER+MEDIAN_WIDTH/2;
const sectionMemo=new Map();
export const roadSection=id=>{const lanes=laneCount(id);if(sectionMemo.has(lanes))return sectionMemo.get(lanes);const half=lanes*LANE_WIDTH/2,section=Object.freeze({lanes,half,inner:-half-INNER_HARD_SHOULDER,outer:half+EMERGENCY_SHOULDER,width:half*2+INNER_HARD_SHOULDER+EMERGENCY_SHOULDER,centre:(EMERGENCY_SHOULDER-INNER_HARD_SHOULDER)/2,earthShoulder:EARTH_SHOULDER});sectionMemo.set(lanes,section);return section;};
export const pathSection=(path,s=0)=>tollSection(path,s);
const junctionAt=(i,k)=>{const h=defineMotorway(true,k),v=defineMotorway(false,i),known=({'0,0':['yunjiang','云江','101'],'0,1':['jianghai','江海','102'],'1,1':['haiyuan','海原','103'],'1,0':['yunyuan','云原','104']})[`${i},${k}`];return{id:known?.[0]||`junction:${i}:${k}`,name:(known?.[1]||`${i<0?'西':'东'}${Math.abs(i)}${k<0?'北':'南'}${Math.abs(k)}`)+'枢纽',number:known?.[2]||`${Math.abs(i)*2+(i<0?1:0)+10}-${Math.abs(k)*2+(k<0?1:0)+10}`,h,v,x:NETWORK_CENTRE.x+i*GRID_SIZE,z:NETWORK_CENTRE.z+k*GRID_SIZE,i,k,maxLanes:Math.max(MOTORWAY_DEFS[h].lanes,MOTORWAY_DEFS[v].lanes),seed:NETWORK_SEED};};
export function junctionStation(j,id){const d=MOTORWAY_DEFS[roadFamily(id)],u=d.horizontal?j.x-d.x:j.z-d.z;return u*(roadSign(id)>0?1:-1);}
export const roadDirection=id=>MOTORWAY_DEFS[roadFamily(id)].horizontal?(roadSign(id)>0?'东':'西'):(roadSign(id)>0?'南':'北');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const smooth=t=>{t=clamp(t,0,1);return t*t*t*(10+t*(-15+6*t));};
export function seededNoise(x,z,seed=7127){let n=(Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^seed)>>>0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;}
function coherent(x,z,scale,seed){x/=scale;z/=scale;const ix=Math.floor(x),iz=Math.floor(z),u=smooth(x-ix),v=smooth(z-iz);return (seededNoise(ix,iz,seed)*(1-u)+seededNoise(ix+1,iz,seed)*u)*(1-v)+(seededNoise(ix,iz+1,seed)*(1-u)+seededNoise(ix+1,iz+1,seed)*u)*v;}
export const riverAX=x=>2500+Math.round((x-2500)/2880)*2880;
export function riverDistance(x,z){return Math.min(Math.abs(x-riverAX(x)),Math.abs(z-1500));}
export function bridgeRise(distance,span=58,approach=350,height=7){return height*(1-smooth((Math.abs(distance)-span)/approach));}
const bump=(x,a,b)=>{const t=clamp((x-a)/(b-a),0,1);return 64*t*t*t*(1-t)*(1-t)*(1-t);};
function proceduralWave(horizontal,index,u){const local=((u%GRID_SIZE)+GRID_SIZE)%GRID_SIZE,segment=Math.floor(u/GRID_SIZE),amplitude=90+seededNoise(index,segment,NETWORK_SEED+(horizontal?11:23))*80;return amplitude*bump(local,1400,4600);}
function corridorWave(family,u){
 const d=MOTORWAY_DEFS[family];
 if(family==='A'&&u< -750){const x=d.x+u;return 12*bump(x,80,530);}
 // C2 flat envelopes repeat at every deterministically generated junction.
 const local=((u%GRID_SIZE)+GRID_SIZE)%GRID_SIZE;
 return proceduralWave(d.horizontal,d.index,u);
}
export function originOffset(x){return -120*smooth((x+1000)/900)*(1-smooth((x+100)/900));}
function axis(id,s){const d=MOTORWAY_DEFS[roadFamily(id)],u=(roadSign(id)>0?s:-s),wave=corridorWave(roadFamily(id),u)+(roadFamily(id)==='A'?originOffset(d.x+u):0);return d.horizontal?{x:d.x+u,z:d.z+wave}:{x:d.x+wave,z:d.z+u};}
const heightMemo=new Map(),poseMemo=new Map(),arcMemo=new Map();
// Explicit FIFO ring avoids Map.keys().next() repeatedly scanning deleted
// entries under high-volume road projection. Hit order remains unchanged.
const memoQueues=new WeakMap();
function boundedMemoSet(map,key,value,capacity){let queue=memoQueues.get(map);if(!queue){queue={keys:[],cursor:0};memoQueues.set(map,queue);}if(map.has(key)){map.set(key,value);return;}if(queue.keys.length<capacity)queue.keys.push(key);else{map.delete(queue.keys[queue.cursor]);queue.keys[queue.cursor]=key;queue.cursor=(queue.cursor+1)%capacity;}map.set(key,value);}

function rawMainHeight(id,s){
 const d=MOTORWAY_DEFS[roadFamily(id)],u=(roadSign(id)>0?s:-s),wave=Math.abs(corridorWave(roadFamily(id),u));
 if(d.horizontal){const x=d.x+u;return bridgeRise(x-riverAX(x),58,450,7)+wave*.035+(roadFamily(id)==='A'?bridgeRise(x-315,135,260,7):0);}
 const ax=d.x+corridorWave(roadFamily(id),u);let h=bridgeRise(d.z+u-1500,58,450,7)+bridgeRise(ax-riverAX(ax),50,150,4)+wave*.035;
 const crossing=Math.round(u/GRID_SIZE)*GRID_SIZE,ground=bridgeRise(d.x-riverAX(d.x),58,450,7);const target=ground+8,blend=bridgeRise(u-crossing,180,Math.max(450,target*1.875/.035),1);h=h*(1-blend)+target*blend;
 return h;
}
export function mainHeight(id,s){const family=roadFamily(id),u=roadSign(id)*s;let memo=heightMemo.get(family);if(!memo)heightMemo.set(family,memo=new Map());if(memo.has(u))return memo.get(u);const y=rawMainHeight(id,s);boundedMemoSet(memo,u,y,8192);return y;}
function planarPose(id,s){let memo=poseMemo.get(id);if(!memo)poseMemo.set(id,memo=new Map());if(memo.has(s))return memo.get(s);const p=axis(id,s),a=axis(id,s-.05),b=axis(id,s+.05),heading=Math.atan2(b.x-a.x,b.z-a.z),scale=Math.hypot(b.x-a.x,b.z-a.z)/.1,nx=-Math.cos(heading),nz=Math.sin(heading),offset=carriagewayOffset(id),value={x:p.x+nx*offset,z:p.z+nz*offset,heading,scale,nx,nz};boundedMemoSet(memo,s,value,4096);return value;}
export function mainPoint(id,s,lane=0){
 const p=planarPose(id,s),grade=(mainHeight(id,s+.05)-mainHeight(id,s-.05))/(.1*p.scale);
 return {x:p.x+p.nx*lane,z:p.z+p.nz*lane,y:mainHeight(id,s),heading:p.heading,grade,s,id,width:roadSection(id).width};
}
export function projectMain(id,x,z,height){
 const d=MOTORWAY_DEFS[roadFamily(id)];let s=(d.horizontal?x-d.x:z-d.z)*(roadSign(id)>0?1:-1);
 for(let i=0;i<5;i++){const p=planarPose(id,s),a=planarPose(id,s-.1),b=planarPose(id,s+.1),dx=(b.x-a.x)/.2,dz=(b.z-a.z)/.2;const delta=((x-p.x)*dx+(z-p.z)*dz)/(dx*dx+dz*dz);s+=delta;if(Math.abs(delta)<1e-7)break;}
 const p=mainPoint(id,s),lane=(x-p.x)*-Math.cos(p.heading)+(z-p.z)*Math.sin(p.heading);
 return {...p,lane,distance:Math.abs(lane),heightError:Math.abs(p.y-height)};
}
// Cache fixed 100m arc blocks. Sign plans reuse the same kilometres many
// times; recomputing 3km of 5m samples for every panel stalled initialization.
function measureArc(id,a,b){let distance=0,p=mainPoint(id,a);const n=Math.max(1,Math.ceil((b-a)/5));for(let i=1;i<=n;i++){const q=mainPoint(id,a+(b-a)*i/n);distance+=Math.hypot(q.x-p.x,q.z-p.z,q.y-p.y);p=q;}return distance;}
export function mainArcDistance(id,a,b){if(a>b)[a,b]=[b,a];if(a===b)return 0;let cache=arcMemo.get(id);if(!cache)arcMemo.set(id,cache=new Map());let distance=0,at=a;while(at<b-1e-8){const cell=Math.floor((at+1e-8)/100),end=Math.min(b,(cell+1)*100);if(Math.abs(at-cell*100)<1e-7&&Math.abs(end-(cell+1)*100)<1e-7){if(!cache.has(cell)){boundedMemoSet(cache,cell,measureArc(id,cell*100,end),256);}distance+=cache.get(cell);}else distance+=measureArc(id,at,end);at=end;}return distance;}

export function stationBefore(id,s,metres){let at=s-metres;for(let i=0;i<7;i++){const error=mainArcDistance(id,at,s)-metres;if(Math.abs(error)<.0001)break;const a=mainPoint(id,at),b=mainPoint(id,at+.1),metric=Math.hypot(b.x-a.x,b.z-a.z,b.y-a.y)/.1;at+=error/Math.max(.1,metric);}return at;}
const line=(a,b,n=32)=>bezier(a,a.map((v,i)=>v+(b[i]-v)/3),a.map((v,i)=>v+2*(b[i]-v)/3),b,n);
const join=(...parts)=>parts.flatMap((p,i)=>i?p.slice(1):p);
function rotate([x,z,y],n,j){for(let i=0;i<n;i++){const next=-z;z=x;x=next;}return[x+j.x,z+j.z,y];}
function hermite(a,b,da,db,t,length){const t2=t*t,t3=t2*t;return(2*t3-3*t2+1)*a+(t3-2*t2+t)*da*length+(-2*t3+3*t2)*b+(t3-t2)*db*length;}
function buildConnector(turn,n,j){
 const order=[j.h+'+',j.v+'+',j.h+'-',j.v+'-'],from=order[n],to=order[(n+(turn==='right'?1:3))%4],fs=junctionStation(j,from),ts=junctionStation(j,to);
 const sourceEdge=carriagewayOffset(from)+outerLane(from),targetEdge=carriagewayOffset(to)+outerLane(to),sourceAux=sourceEdge+LANE_WIDTH,targetAux=targetEdge+LANE_WIDTH;
 const outer=Math.max(sourceEdge,targetEdge)+12,radius=100,centre=outer+radius,H=(id,origin,u)=>mainHeight(id,origin+u);
 const measuredSample=(x0,x1,z0,z1,id,origin)=>{const count=Math.ceil(Math.abs(x1-x0)/4);return Array.from({length:count+1},(_,i)=>{const t=i/count,x=x0+(x1-x0)*t;return[x,z0+(z1-z0)*smooth(t),H(id,origin,x)];});};
 // The common exit is a real extra lane. Its centre leaves the running lane
 // through a 180m taper, then offers 220m of separate deceleration pavement.
 const taperOut=measuredSample(-1200,-1020,sourceEdge,sourceAux,from,fs),decel=measuredSample(-1020,-800,sourceAux,sourceAux,from,fs);
 const nose=measuredSample(-800,-600,sourceAux,outer,from,fs),depart=join(taperOut,decel,nose);let middle;
 if(turn==='right'){
  // A broad quarter turn, tangent to both parallel auxiliary lanes.
  const curve=bezier([-600,outer,0],[-420,outer,0],[-outer,420,0],[-outer,600,0],220),samples=annotate(curve),first=curve.findIndex(p=>p[1]-outer>=9),last=curve.length-1-first,length=samples[last].s-samples[first].s;
  const start=curve[first],end=curve[last],tangent=i=>{const a=curve[Math.max(0,i-1)],b=curve[Math.min(curve.length-1,i+1)],l=Math.hypot(b[0]-a[0],b[1]-a[1]);return{x:(b[0]-a[0])/l,z:(b[1]-a[1])/l};},g0=(H(from,fs,start[0]+.05)-H(from,fs,start[0]-.05))/.1*tangent(first).x,g1=(H(to,ts,end[1]+.05)-H(to,ts,end[1]-.05))/.1*tangent(last).z;
  middle=curve.map(([x,z],i)=>[x,z,i<=first?H(from,fs,x):i>=last?H(to,ts,z):hermite(H(from,fs,start[0]),H(to,ts,end[1]),g0,g1,(samples[i].s-samples[first].s)/length,length)]);
 }else{
  // Euler transition -> constant-radius arc -> Euler transition. Curvature
  // starts/ends at zero instead of snapping a straight lane onto an R100 arc.
  const spiral=25,arcTotal=radius*Math.PI*1.5+spiral,count=Math.ceil(arcTotal/3),ds=arcTotal/count,shape=[[0,0]],curvature=d=>Math.min(1,d/spiral,(arcTotal-d)/spiral)/radius;
  let ax=0,az=0,ah=0;for(let i=1;i<=count;i++){const d=(i-.5)*ds,k=curvature(d),mid=ah+k*ds/2;ax+=Math.cos(mid)*ds;az+=Math.sin(mid)*ds;ah+=k*ds;shape.push([ax,az]);}
  const xStart=outer-ax,arcEndZ=outer+az,lead=line([-600,outer,0],[xStart,outer,0],Math.ceil((xStart+600)/4)).map(([x,z])=>[x,z,H(from,fs,x)]);
  const coords=shape.map(([x,z])=>({x:x+xStart,z:z+outer})),first=coords.findIndex(p=>p.z-outer>=9),last=coords.length-1-first,span=(last-first)*ds;
  const start=coords[first],end=coords[last],tangent=i=>{const a=coords[Math.max(0,i-1)],b=coords[Math.min(coords.length-1,i+1)],l=Math.hypot(b.x-a.x,b.z-a.z);return{x:(b.x-a.x)/l,z:(b.z-a.z)/l};},startD=(H(from,fs,start.x+.05)-H(from,fs,start.x-.05))/.1*tangent(first).x,endD=(H(to,ts,-end.z+.05)-H(to,ts,-end.z-.05))/.1*(-tangent(last).z);
  const arc=coords.map(({x,z},i)=>[x,z,i<=first?H(from,fs,x):i>=last?H(to,ts,-z):hermite(H(from,fs,start.x),H(to,ts,-end.z),startD,endD,(i-first)/(last-first),span)]);
  const parallel=line([outer,arcEndZ,0],[outer,-600,0],Math.ceil((arcEndZ+600)/4)).map(([x,z])=>[x,z,H(to,ts,-z)]);middle=join(lead,arc,parallel);
 }
 // Arrival stays outside the through lane for 320m before a separate 180m
 // merge taper. This lets trucks accelerate and yield without stopping in it.
 const incoming=measuredSample(600,800,outer,targetAux,to,ts),accel=measuredSample(800,1020,targetAux,targetAux,to,ts),taperIn=measuredSample(1020,1200,targetAux,targetEdge,to,ts);
 const finish=join(incoming,accel,taperIn).map(([s,o,y])=>turn==='right'?[-o,s,y]:[o,-s,y]);
 const raw=join(depart,middle,finish).map(p=>rotate(p,n,j)),pathLength=annotate(raw),sharedDepart=annotate(depart).at(-1).s,sharedFinish=annotate(finish).at(-1).s;
 const world=raw.map(([x,z,y],i)=>{const minimum=Math.max(bridgeRise(x-riverAX(x),50,150,4),bridgeRise(z-1500,50,150,4)),d=minimum-y;return[x,z,y+Math.max(0,d)*smooth(d/2)*smooth((pathLength[i].s-sharedDepart-100)/150)*smooth((pathLength.at(-1).s-sharedFinish-100-pathLength[i].s)/150)];});
 const id=`${j.id}:${from}>${to}`,points=annotate(world),xs=points.map(p=>p.x),zs=points.map(p=>p.z),departLength=annotate(depart).at(-1).s,middleLength=annotate(middle).at(-1).s,finishLength=annotate(finish).at(-1).s;
 return{id,junctionId:j.id,from,to,turn,width:7.5,offset:1,laneWidth:3.5,startS:fs-1200,joinS:ts+1200,points,length:points.at(-1).s,departLength,departureEndS:fs-800,mergeStartS:ts+800,
  decelerationStartS:annotate(taperOut).at(-1).s,decelerationEndS:annotate(join(taperOut,decel)).at(-1).s,accelerationStartS:points.at(-1).s-finishLength,mergeTaperStartS:points.at(-1).s-annotate(taperIn).at(-1).s,rampSpeed:turn==='left'?40/3.6:50/3.6,
  auxiliary:[{roadId:from,startS:fs-1200,endS:fs-800},{roadId:to,startS:ts+800,endS:ts+1200}],bounds:{minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)}};
}

function buildArchiveAccess(){
 const at=(id,x,offset=0)=>mainPoint(id,roadSign(id)*(x-NETWORK_CENTRE.x),outerLane(id)+offset),vec=p=>[p.x,p.z,p.y];
 const sample=(id,x0,x1,offset,y)=>Array.from({length:Math.ceil(Math.abs(x1-x0)/3)+1},(_,i)=>{const t=i/Math.ceil(Math.abs(x1-x0)/3),p=at(id,x0+(x1-x0)*t,typeof offset==='function'?offset(t):offset);return[p.x,p.z,y===undefined?p.y:y];});
 const source=at('A-',830),target=at('A+',960),deceleration=sample('A-',830,650,t=>8*smooth(t)).map((p,i,a)=>[p[0],p[1],p[2]*(1-smooth(i/(a.length-1)))]),separated=sample('A-',650,450,8,0),north=at('A-',450,8);
 // The return road is below the paired 7m mainline bridge, not an at-grade crossing.
 const inboundCurve=bezier([north.x,north.z,0],[north.x+Math.sin(north.heading)*140,north.z+Math.cos(north.heading)*140,0],[184,-19,0],[44,-19,0],140);
 const inbound=join(deceleration,separated,inboundCurve),town=join(line([44,-19,0],[-15,-19,0]),bezier([-15,-19,0],[-21,-19,0],[-25,-15,0],[-25,-9,0]),line([-25,-9,0],[-25,9,0]),bezier([-25,9,0],[-25,15,0],[-21,19,0],[-15,19,0]),line([-15,19,0],[44,19,0]));
 // The shared 220m ground connector holds both toll lanes before either
 // motorway direction diverges. Rejoin after the bridge descent, not its nose.
 const sharedOut=line([44,19,0],[264,19,0],110),approach=at('A+',560,3.75),plan=annotate(bezier([264,19,0],[424,19,0],[approach.x-Math.sin(approach.heading)*80,approach.z-Math.cos(approach.heading)*80,0],[approach.x,approach.z,0],500)),cut=plan.findIndex(p=>projectMain('A+',p.x,p.z,0).lane<15),cp=plan[cut],mh=projectMain('A+',cp.x,cp.z,0),cg=(projectMain('A+',plan[cut+1].x,plan[cut+1].z,0).y-projectMain('A+',plan[cut-1].x,plan[cut-1].z,0).y)/(plan[cut+1].s-plan[cut-1].s),graded=plan.map(p=>[p.x,p.z,p.s<cp.s?hermite(0,mh.y,0,cg,p.s/cp.s,cp.s):projectMain('A+',p.x,p.z,0).y]),outboundCurve=join(sharedOut,graded),acceleration=sample('A+',560,780,3.75),taper=sample('A+',780,960,t=>3.75*(1-smooth(t)));
 const outbound=join(outboundCurve,acceleration,taper),points=annotate(join(inbound,town,outbound)),xs=points.map(p=>p.x),zs=points.map(p=>p.z),townEntryS=annotate(inbound).at(-1).s,townExitS=townEntryS+annotate(town).at(-1).s;
 return{id:'archive:A->A+',junctionId:'archive',from:'A-',to:'A+',turn:'right',city:true,width:4.5,startS:source.s,joinS:target.s,points,length:points.at(-1).s,departLength:annotate(deceleration).at(-1).s,departureEndS:NETWORK_CENTRE.x-650,mergeStartS:560-NETWORK_CENTRE.x,commonOutLength:220,townEntryS,townExitS,accelerationStartS:townExitS+annotate(outboundCurve).at(-1).s,auxiliary:[{roadId:'A-',startS:source.s,endS:NETWORK_CENTRE.x-650},{roadId:'A+',startS:560-NETWORK_CENTRE.x,endS:target.s}],bounds:{minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)}};
}

export const ARCHIVE_ACCESS=buildArchiveAccess();
export const ARCHIVE_ROUTES=buildArchiveAlternatives(ARCHIVE_ACCESS,{mainPoint,projectMain,outerLane,smooth});
export const SERVICE_AREAS=buildServicePair({mainPoint,outerLane,smooth});
export const CONNECTORS=[...ARCHIVE_ROUTES,...SERVICE_AREAS],LOCAL_ROUTES=[],LOCAL_ROAD_SURFACES=[],LOCAL_COMPONENTS=[];
let compiledLocalRoutes=[];
export function setLocalComponents(components){const key=components.map(c=>c.geometryKey).sort().join('|');if(key===LOCAL_COMPONENTS.map(c=>c.geometryKey).sort().join('|'))return false;LOCAL_COMPONENTS.splice(0,LOCAL_COMPONENTS.length,...components);LOCAL_ROAD_SURFACES.splice(0,LOCAL_ROAD_SURFACES.length,...components.flatMap(c=>c.surfaces));compiledLocalRoutes=components.flatMap(c=>c.itineraries);CONNECTORS.splice(0,CONNECTORS.length,...CONNECTORS.filter(p=>!p.localGraph),...compiledLocalRoutes);generationKey='';graphRevision++;return true;}
export const physicalLocalById=id=>LOCAL_ROAD_SURFACES.find(p=>p.id===id)||null;
export const localComponentById=id=>LOCAL_COMPONENTS.find(c=>c.id===id)||null;
export const physicalNetworkRoads=()=>[...CONNECTORS.filter(p=>!p.routingOnly),...LOCAL_ROAD_SURFACES];
export function buildFixedJunction(i,k){const j=junctionAt(i,k);return{...j,...buildMotorwayJunction(j,buildConnector)};}

export function setLocalRoutes(routes,keep=[]){const next=[...routes,...LOCAL_ROUTES.filter(r=>keep.includes(r.id)&&!routes.some(n=>n.id===r.id))];if(next.map(r=>r.id+':'+(r.geometryKey||'')).join('|')===LOCAL_ROUTES.map(r=>r.id+':'+(r.geometryKey||'')).join('|'))return;LOCAL_ROUTES.splice(0,LOCAL_ROUTES.length,...next);CONNECTORS.splice(0,CONNECTORS.length,...CONNECTORS.filter(p=>!p.local),...next,...compiledLocalRoutes);generationKey='';graphRevision++;}

let generationKey='',graphRevision=0,activeCell=null;
export const NETWORK_CELL_HYSTERESIS=800;
export function ensureNetwork(x,z,keep=[]){
 const choose=(value,previous)=>previous!==undefined&&value>=previous*GRID_SIZE-NETWORK_CELL_HYSTERESIS&&value<(previous+1)*GRID_SIZE+NETWORK_CELL_HYSTERESIS?previous:Math.floor(value/GRID_SIZE);
 const i=choose(x-NETWORK_CENTRE.x,activeCell?.i),k=choose(z-NETWORK_CENTRE.z,activeCell?.k),cells=[];activeCell={i,k};for(const a of [i,i+1])for(const b of [k,k+1])cells.push(junctionAt(a,b));
 // Keep a connector currently occupied by an NPC until it can be safely recycled.
 for(const id of keep){const old=CONNECTORS.find(c=>c.id===id);if(old&&!old.city&&!old.service&&!cells.some(j=>j.id===old.junctionId)){const j=JUNCTIONS.find(j=>j.id===old.junctionId);if(j)cells.push(j);}}
 // Occupancy only changes topology when it preserves an otherwise absent road.
 // A vehicle moving A+ -> B+ inside the same live cells must not rebuild terrain,
 // signs and colliders merely because the raw keep-list changed.
 const render=[defineMotorway(true,k),defineMotorway(true,k+1),defineMotorway(false,i),defineMotorway(false,i+1)].flatMap(f=>[f+'+',f+'-']);
 const needed=[...new Set(['A+','A-',...render,...cells.flatMap(j=>[j.h+'+',j.h+'-',j.v+'+',j.v+'-']),...keep.filter(id=>id&&MOTORWAY_DEFS[roadFamily(id)]),...SERVICE_AREAS.filter(p=>keep.includes(p.id)).flatMap(p=>[p.from,p.to]),...[...LOCAL_ROUTES,...compiledLocalRoutes].flatMap(p=>[p.from,p.to])])];
 const key=`${i}:${k}|${cells.map(j=>junctionChoiceKey(j)).sort().join('|')}|${[...needed].sort().join(',')}`;if(key===generationKey)return false;generationKey=key;
 const old=new Map(CONNECTORS.map(p=>[p.id,p])),routes=[];for(const j of cells){const choiceKey=junctionChoiceKey(j),prior=[...old.values()].filter(p=>p.junctionId===j.id&&p.choiceKey===choiceKey),built=prior.length===8?{type:prior[0].junctionType,selection:prior[0].junctionSelection,geometryKey:prior[0].geometryKey,paths:prior}:buildMotorwayJunction(j,buildConnector);Object.assign(j,{type:built.type,selection:built.selection,layoutName:MOTORWAY_JUNCTION_TYPES[built.type],geometryKey:built.geometryKey});routes.push(...built.paths);}JUNCTIONS.splice(0,JUNCTIONS.length,...cells);CONNECTORS.splice(0,CONNECTORS.length,...ARCHIVE_ROUTES,...LOCAL_ROUTES,...compiledLocalRoutes,...SERVICE_AREAS.filter(p=>needed.includes(p.from)||keep.includes(p.id)),...routes);
 RENDER_MOTORWAYS.splice(0,RENDER_MOTORWAYS.length,...render);
 MOTORWAYS.splice(0,MOTORWAYS.length,...needed);for(const f of Object.keys(MOTORWAY_DEFS))if(!['A','B','C','D'].includes(f)&&!needed.some(id=>roadFamily(id)===f)){delete MOTORWAY_DEFS[f];delete MOTORWAY_NAMES[f];heightMemo.delete(f);poseMemo.delete(f+'+');poseMemo.delete(f+'-');arcMemo.delete(f+'+');arcMemo.delete(f+'-');}graphRevision++;return true;
}
export const networkRevision=()=>graphRevision;
ensureNetwork(NETWORK_CENTRE.x+100,NETWORK_CENTRE.z+100);

export const ROAD_GRAPH={main:MOTORWAYS,connectors:CONNECTORS,junctions:JUNCTIONS};
export const connectorById=id=>CONNECTORS.find(p=>p.id===id)||physicalLocalById(id);
export const aheadJunction=(id,s)=>JUNCTIONS.filter(j=>j.h===roadFamily(id)||j.v===roadFamily(id)).map(j=>({...j,startS:junctionStation(j,id)-JUNCTION_APPROACH})).filter(j=>j.startS>s+.1).sort((a,b)=>a.startS-b.startS)[0]||null;
export const nearbyPaths=(x,z,pad=16)=>physicalNetworkRoads().filter(p=>x>=p.bounds.minX-pad&&x<=p.bounds.maxX+pad&&z>=p.bounds.minZ-pad&&z<=p.bounds.maxZ+pad);
export function roadPoint(id,s,lane=0){
 if(MOTORWAYS.includes(id))return mainPoint(id,s,lane);
 const path=connectorById(id),pts=path.points;let lo=1,hi=pts.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(pts[mid].s<=s+1e-7)lo=mid+1;else hi=mid;}const i=lo;
 const a=pts[i-1],b=pts[i],u=clamp((s-a.s)/(b.s-a.s),0,1),len=Math.max(.001,b.s-a.s),heading=Math.atan2(b.x-a.x,b.z-a.z);
 return{x:a.x+(b.x-a.x)*u-Math.cos(heading)*lane,z:a.z+(b.z-a.z)*u+Math.sin(heading)*lane,y:a.y+(b.y-a.y)*u,heading,grade:(b.y-a.y)/len,s,id,width:path.width};
}
// Overlapping taper centre-lines are not distinct lanes yet. A car inside a
// motorway running lane still belongs to that motorway, even when an exit's
// centre-line starts at the same outer-lane centre. Shoulders/auxiliary lanes
// retain the ordinary connector projection below. The 0.30m boundary band
// avoids route flicker while crossing the edge line; height keeps layers apart.
export function isMotorwayRunningLane(p,height,currentId=''){
 if(!p||!MOTORWAYS.includes(p.id)||Math.abs(p.y-height)>.35)return false;
 const half=roadSection(p.id).half,margin=p.id===currentId?.15:-.15;
 return p.lane>=-half-margin&&p.lane<=half+margin;
}
export function projectNetwork(x,z,height=0,currentId=''){
 let best=null,score=Infinity,running=null,runningScore=Infinity;
 const candidates=[...MOTORWAYS.filter(id=>nearMain(id,x,z,80)).map(id=>projectMain(id,x,z,height)),...nearbyPaths(x,z).map(p=>({...projectPath(p,x,z,height),heightError:0}))];
 for(const p of candidates){
  const e=Math.abs(p.y-height),serviceInside=!MOTORWAYS.includes(p.id)&&serviceApronContains(connectorById(p.id),x,z,height);
  if(!serviceInside&&(MOTORWAYS.includes(p.id)?p.lane<roadSection(p.id).inner+.65||p.lane>roadSection(p.id).outer-.65:(p.lane<pathSection(connectorById(p.id),p.s).inner+.65||p.lane>pathSection(connectorById(p.id),p.s).outer-.65))||e>1.8)continue;
  const rank=p.distance+e*5-(p.id===currentId?.2:0);
  if(isMotorwayRunningLane(p,height,currentId)&&rank<runningScore){runningScore=rank;running={...p,network:true,runningLane:true};}
  if(rank<score){score=rank;best={...p,network:true};}
 }
 return running||best;
}
export function naturalTerrainHeight(x,z,seed=7127){
 const d=riverDistance(x,z),bed=-5*(1-smooth((d-25)/35));
 let h=(coherent(x,z,270,seed)*.7+coherent(x,z,85,seed+1)*.3)*27-5;
 // Leave stable cut/fill corridors instead of sending hills through the roads.
 const projections=[];for(const horizontal of [true,false]){const coordinate=horizontal?z-NETWORK_CENTRE.z:x-NETWORK_CENTRE.x,grid=Math.round(coordinate/GRID_SIZE),along=horizontal?x-NETWORK_CENTRE.x:z-NETWORK_CENTRE.z,local=((along%GRID_SIZE)+GRID_SIZE)%GRID_SIZE;for(const offset of [-1,0,1]){const wave=proceduralWave(horizontal,grid+offset,along);projections.push({dist:Math.abs(coordinate-(grid+offset)*GRID_SIZE-wave),wave:Math.abs(wave)*.035});}}projections.sort((a,b)=>a.dist-b.dist);const near=projections[0];
 const blend=smooth((near.dist-24)/90);h=h*blend+near.wave*(1-blend);

 return Math.min(h-.5, d<60?bed-.5:100);
}

// Spatially index sampled segments once per graph revision. Guardrail and
// support tests remain exact locally without scanning every remote ramp.
let segmentRevision=-1;const segmentIndex=createRoadSegmentIndex();
function segmentsNear(x,z,pad=16){if(segmentRevision!==graphRevision){segmentIndex.sync(physicalNetworkRoads());segmentRevision=graphRevision;}return segmentIndex.nearReadonly(x,z,pad);}
function segmentProjection({a,b},x,z){const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/Math.max(1e-9,dx*dx+dz*dz),0,1);return{s:a.s+(b.s-a.s)*t,distance:Math.hypot(x-a.x-dx*t,z-a.z-dz*t),lane:((x-a.x-dx*t)*-dz+(z-a.z-dz*t)*dx)/Math.max(1e-9,Math.hypot(dx,dz)),y:a.y+(b.y-a.y)*t};}
const sectionDistance=(q,path)=>{const r=pathSection(path,q.s);return pavementDistance(q,r.centre)-r.width/2;};
const pavementDistance=(q,offset=0)=>Math.hypot(Math.sqrt(Math.max(0,q.distance*q.distance-q.lane*q.lane)),q.lane-offset);
function nearMain(id,x,z,pad=35){const d=MOTORWAY_DEFS[roadFamily(id)];if(Math.abs(d.horizontal?z-d.z:x-d.x)>320+pad)return false;const s=(d.horizontal?x-d.x:z-d.z)*roadSign(id),p=planarPose(id,s);return Math.abs((x-p.x)*Math.cos(p.heading)-(z-p.z)*Math.sin(p.heading))<pad;}
export function networkInternalBoundary(owner,x,z,y,ignore=()=>false){
 if(SERVICE_AREAS.some(p=>p.id!==owner&&serviceApronContains(p,x,z,y)))return true;
 for(const id of MOTORWAYS){if(id===owner||!nearMain(id,x,z))continue;const q=projectMain(id,x,z,y);if(q.lane>roadSection(id).inner-.15&&q.lane<roadSection(id).outer+.15&&q.heightError<.7)return true;}
 for(const segment of segmentsNear(x,z)){if(segment.path.id===owner||ignore(segment.path))continue;const q=segmentProjection(segment,x,z);if(sectionDistance(q,segment.path)<.150001&&Math.abs(q.y-y)<.7)return true;}return false;
}
// Earthwork may never occupy another road footprint, even at a lower level.
// A conservative 2m collar also covers between-sample bank triangles.
export function earthworkClear(owner,x,z){
 if(SERVICE_AREAS.some(p=>p.id!==owner&&serviceApronContains(p,x,z)))return false;
 for(const id of MOTORWAYS){if(id===owner||!nearMain(id,x,z))continue;const q=projectMain(id,x,z,0);if(q.lane>roadSection(id).inner-2&&q.lane<roadSection(id).outer+2)return false;}
 for(const segment of segmentsNear(x,z)){if(segment.path.id===owner)continue;if(sectionDistance(segmentProjection(segment,x,z),segment.path)<2)return false;}return true;
}
export function supportClear(x,z,y){
 for(const id of MOTORWAYS){if(!nearMain(id,x,z))continue;const q=projectMain(id,x,z,y);if(q.lane>roadSection(id).inner-1.4&&q.lane<roadSection(id).outer+1.4&&q.y+3<y)return false;}
 for(const segment of segmentsNear(x,z)){const q=segmentProjection(segment,x,z);if(sectionDistance(q,segment.path)<1.5&&q.y+3<y)return false;}return true;
}
// Conservative vertical envelope for roadside furniture: actual 1.8m deck and
// 1.2m bridge barriers, including the entire width of added connector pavements.
export function roadVerticalClear(x,z,minY,maxY,padding=.25){
 for(const id of MOTORWAYS){if(!nearMain(id,x,z,45+padding))continue;const q=projectMain(id,x,z,0),section=roadSection(id);if(q.lane>=section.inner-.55-padding&&q.lane<=section.outer+.55+padding&&q.y-1.58<=maxY&&q.y+1.42>=minY)return false;}
 for(const segment of segmentsNear(x,z,16+padding)){const q=segmentProjection(segment,x,z);if(sectionDistance(q,segment.path)<=.55+padding&&q.y-1.58<=maxY&&q.y+1.42>=minY)return false;}
 return true;
}
export function roadsideFootprintClear(x,z,radius=0){
 for(const id of MOTORWAYS){if(!nearMain(id,x,z,65+radius))continue;const p=projectMain(id,x,z,0),r=roadSection(id);if(p.lane>=r.inner-radius&&p.lane<=r.outer+radius)return false;}
 for(const entry of segmentsNear(x,z,radius+25)){const q=segmentProjection(entry,x,z);if(sectionDistance(q,entry.path)<radius)return false;}return true;
}
export function vegetationSite(x,z){
 if(riverDistance(x,z)<66||SERVICE_AREAS.some(p=>servicePadProjection(p,x,z).distance<10))return false;
 for(const id of MOTORWAYS)if(nearMain(id,x,z)&&projectMain(id,x,z,0).distance<26)return false;
 for(const segment of segmentsNear(x,z))if(segmentProjection(segment,x,z).distance<13)return false;
 return terrainHeight(x,z)>-.5;
}

// Cut/fill is sampled into the rendered terrain itself, also used by Rapier.
// 20m clearance collar covers the 18.86m maximum triangle edge of terrain tiles.
export function terrainHeight(x,z,seed=7127){
 const natural=naturalTerrainHeight(x,z,seed),constraints=[];
 for(const p of SERVICE_AREAS){const q=servicePadProjection(p,x,z);if(q.distance<42)constraints.push({distance:q.distance,width:0,y:q.y});}
 for(const id of MOTORWAYS){if(!nearMain(id,x,z,65))continue;const p=projectMain(id,x,z,natural);constraints.push({distance:Math.abs(p.lane-roadSection(id).centre),width:roadSection(id).width,y:p.y});}
 for(const entry of segmentsNear(x,z,48)){const q=segmentProjection(entry,x,z);const section=pathSection(entry.path,q.s);if(q.distance<section.width/2+42)constraints.push({...q,distance:pavementDistance(q,section.centre),width:section.width,localGround:entry.path.physicalLocal&&entry.a.structure==='ground'&&entry.b.structure==='ground'});}
 let ceiling=Infinity,fill=natural;
 for(const q of constraints){const blend=1-smooth((q.distance-q.width/2-20)/20);if(blend<=0)continue;const floor=q.y-1.35;ceiling=Math.min(ceiling,natural+(floor-natural)*blend);if((q.y<2||q.localGround)&&riverDistance(x,z)>66)fill=Math.max(fill,natural+(floor-natural)*blend);}
 return Math.min(fill,ceiling);
}
