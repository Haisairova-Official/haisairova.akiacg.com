import {decorateLocalTolls} from './toll-layout.mjs?rev=world21d';
import {regionForIndex,regionGeometryKey} from './regions.mjs?rev=world21d';
import {regionThroughCoordinates,regionLayout} from './region-roads.mjs?rev=world21d';
import {annotate,bezier,INTERCHANGE_NAMES} from './interchange-logic.mjs?rev=world21d';
import {mainPoint,mainHeight,projectMain,outerLane,carriagewayOffset,terrainHeight,naturalTerrainHeight,NETWORK_CENTRE,smooth} from './road-network.mjs?rev=world21d';
const join=(...parts)=>parts.flatMap((p,i)=>i?p.slice(1):p);
function segment(a,b,step=3){const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1],(b[2]||0)-(a[2]||0))/step));return Array.from({length:n+1},(_,i)=>a.map((v,k)=>v+(b[k]-v)*i/n));}
const arc=(cx,cz,r,a,b)=>{const n=Math.ceil(Math.abs(b-a)*r/2.5);return Array.from({length:n+1},(_,i)=>[cx+r*Math.cos(a+(b-a)*i/n),cz+r*Math.sin(a+(b-a)*i/n)]);};
const hermite=(a,b,da,db,t,l)=>(2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*da*l+(-2*t**3+3*t*t)*b+(t**3-t*t)*db*l;
export function buildLocalInterchange(type,index,station,{anchor='A+',reach=1444,naturalPlacement=false,exitNumber=null}={}){
 const primary=anchor,opposite=anchor.slice(0,-1)+(anchor.endsWith('+')?'-':'+');
 const base=mainPoint(primary,station),bridgeY=base.y+8,edge=carriagewayOffset(primary)+outerLane(primary),aux=edge+3.75,outer=edge+12,prefix=`town:${index}`,physical=[],edges=new Map();
 const map=(u,v,y)=>{const p=mainPoint(primary,station+u,v-carriagewayOffset(primary));return[p.x,p.z,y===undefined?p.y:y];};
 const flat=(plan,y=bridgeY)=>plan.map(([u,v])=>map(u,v,y));
 const register=(id,points,{width=7.5,offset=1,laneWidth=3.5,render=true,control=null}={})=>{const edge={id:`${prefix}:${id}`,points:annotate(points),width,offset,laneWidth,control};edges.set(id,edge);if(render)physical.push(edge);return edge;};
 function elevated(plan,id,yEnd=bridgeY,flatTail=0){const raw=plan.map(([u,v])=>map(u,v)),measured=annotate(raw),first=Math.max(1,plan.findIndex(p=>Math.abs(p[1])>=aux+9)),start=raw[first][2],last=measured.at(-1).s,length=last-measured[first].s-flatTail,grade=(raw[first][2]-raw[first-1][2])/(measured[first].s-measured[first-1].s);return raw.map((p,i)=>[p[0],p[1],i<=first?p[2]:hermite(start,yEnd,grade,0,Math.min(1,(measured[i].s-measured[first].s)/length),length)]);}
 function auxiliary(sign,exiting){const a=[];for(let u=0;u<=600;u+=3){const d=u/600,x=sign*(exiting?-1200+u:600+u),o=exiting?3.75*smooth(u/180):3.75*(1-smooth((u-420)/180));a.push(map(x,sign*(edge+o)));}return a;}
 const eastOffPlan=bezier([-600,aux,0],[-420,aux,0],[-210,180,0],[-40,180,0],160),eastOnPlan=bezier([40,180,0],[210,180,0],[420,aux,0],[600,aux,0],160);
 register('exit-east',join(auxiliary(1,true),elevated(eastOffPlan,primary)));
 register('entry-east',join(elevated([...eastOnPlan].reverse(),primary).reverse(),auxiliary(1,false)));
 // South junction: an ordinary local-road T-junction. Main motorway stays fully grade-separated.
 register('turn:east-off',flat(arc(-40,218.25,38.25,-Math.PI/2,0)),{control:{node:'south',priority:1}});
 register('turn:east-on',flat(arc(40,218.25,38.25,Math.PI,Math.PI*1.5)),{control:{node:'south',priority:1}});
 let northJoin=-138.25,northDeparture=-138.25,westOffIds,westOnIds;
 if(type==='trumpet'){
  const loopR=90,loopZ=-outer-loopR; northDeparture=loopZ;northJoin=-330;
  const remote=join(bezier([600,-aux,0],[520,-aux,0],[440,-280,0],[400,-330,0],120),bezier([400,-330,0],[264,-500,0],[-1.75,-500,0],[-1.75,-330,0],140));
  register('exit-west',join(auxiliary(-1,true),elevated(remote,opposite,bridgeY,120)));westOffIds=['exit-west'];
  const ring=arc(91.75,loopZ,loopR,Math.PI,Math.PI*2.5),ringLength=annotate(ring.map(p=>[p[0],p[1],0])).at(-1).s;
  const ringEndY=mainHeight(primary,station+91.75),ringEndGrade=(mainHeight(primary,station+90.75)-ringEndY),ringWorld=ring.map(([u,v],i)=>{const s=i/(ring.length-1)*ringLength;return map(u,v,s<=50?bridgeY:hermite(bridgeY,ringEndY,0,ringEndGrade,(s-50)/(ringLength-50),ringLength-50));});
  register('loop:west-on',ringWorld);const lead=segment([91.75,-outer,0],[-600,-outer,0]);
  const shift=Array.from({length:68},(_,i)=>{const t=i/67;return[-600-200*t,-outer+(outer-aux)*smooth(t),0];}),parallel=segment([-800,-aux,0],[-1020,-aux,0]),taper=Array.from({length:61},(_,i)=>[-1020-i*3,-edge-3.75*(1-smooth(i/60)),0]);
  register('entry-west',join(lead,shift,parallel,taper).map(([u,v])=>map(u,v)));westOnIds=['loop:west-on','entry-west'];
 }else{
  const westOffPlan=eastOffPlan.map(([u,v,y])=>[-u,-v,y]),westOnPlan=eastOnPlan.map(([u,v,y])=>[-u,-v,y]);
  register('exit-west',join(auxiliary(-1,true),elevated(westOffPlan,opposite)));
  register('entry-west',join(elevated([...westOnPlan].reverse(),opposite).reverse(),auxiliary(-1,false)));
  register('turn:west-off',flat(arc(40,-138.25,41.75,-Math.PI/2,-Math.PI)),{control:{node:'north',priority:2}});
  register('turn:west-on',flat(arc(-40,-138.25,41.75,0,-Math.PI/2)),{control:{node:'north',priority:2}});
  westOffIds=['exit-west','turn:west-off'];westOnIds=['turn:west-on','entry-west'];
 }
 const spineStart=Math.min(northJoin,northDeparture)-50;
 register('spine-pavement',flat(segment([0,spineStart,0],[0,400,0])),{width:10.5,offset:0,laneWidth:7,render:true});
 // Directed carriageways share one physical pavement but distinct lane/edge IDs.
 register('south:upper',flat(segment([-1.75,northJoin,0],[-1.75,218.25,0])),{render:false,control:{node:'south',priority:0,offset:'tail',zoneLength:100}});
 register('south:lower',flat(segment([-1.75,218.25,0],[-1.75,400,0])),{render:false});
 register('north:lower',flat(segment([1.75,400,0],[1.75,218.25,0])),{render:false,control:{node:'south',priority:0,offset:'tail',zoneLength:160}});
 register('north:upper',flat(segment([1.75,218.25,0],[1.75,northDeparture,0])),{render:false});
 const townEnd=reach-44,townSpan=townEnd-400,townPoint=map(0,reach),townY=regionForIndex(index).kind==='crabbay'?0:Math.max(0,Math.min(bridgeY,(naturalPlacement?naturalTerrainHeight:terrainHeight)(townPoint[0],townPoint[1]))),townHeight=v=>bridgeY+(townY-bridgeY)*smooth((v-400)/(townSpan-20)),inPlan=bezier([-1.75,400,0],[-1.75,400+.35*townSpan,0],[-19,400+.65*townSpan,0],[-19,townEnd,0],Math.ceil(townSpan*.28)),inWorld=inPlan.map(([u,v])=>map(u,v,townHeight(v)));
 register('town-in',inWorld);const end=inWorld.at(-1),prev=inWorld.at(-2),heading=Math.atan2(end[0]-prev[0],end[1]-prev[1]),angle=heading+Math.PI/2,c=Math.cos(angle),s=Math.sin(angle),town={x:end[0]-44*c+19*s,z:end[1]+44*s+19*c,y:townY,angle,index};
 const local=([x,z,y])=>[town.x+c*x+s*z,town.z-s*x+c*z,town.y+y],out=local([44,19,0]),start=map(1.75,400,bridgeY),next=map(1.75,403,bridgeY),h=Math.atan2(next[0]-start[0],next[1]-start[1]),outHeading=heading+Math.PI;
 const outWorld=bezier(out,[out[0]+Math.sin(outHeading)*(.35*townSpan),out[1]+Math.cos(outHeading)*(.35*townSpan),townY],[start[0]+Math.sin(h)*(.35*townSpan),start[1]+Math.cos(h)*(.35*townSpan),bridgeY],start,Math.ceil(townSpan*.28)).map(p=>[p[0],p[1],townHeight(projectMain(primary,p[0],p[1]).lane+carriagewayOffset(primary))]);outWorld[0]=out;outWorld[outWorld.length-1]=start;register('town-out',outWorld);
 const region=regionForIndex(index),geometryKey=regionGeometryKey(region,town);Object.assign(town,{regionId:region.id,layoutId:region.layoutId});
 register('town-ring',regionThroughCoordinates(town),{render:false,width:regionLayout(index).roads[0].width,offset:0});
 const inbound={[primary]:['exit-east','turn:east-off','south:lower','town-in'],[opposite]:[...westOffIds,'south:upper','south:lower','town-in']},outbound={[primary]:['town-out','north:lower','turn:east-on','entry-east'],[opposite]:['town-out','north:lower','north:upper',...westOnIds]};
 const makeRoute=(from,to)=>{const sequence=[...inbound[from],'town-ring',...outbound[to]],points=[],physicalSegments=[],controls=[];let distance=0,townEntryS=0,townExitS=0;for(const id of sequence){const e=edges.get(id),p=e.points;if(points.length){const last=points.at(-1),gap=Math.hypot(last[0]-p[0].x,last[1]-p[0].z,last[2]-p[0].y);if(gap>.1)throw Error('local route seam '+id+' '+gap);}const start=distance;if(id==='town-ring')townEntryS=start;points.push(...p.slice(points.length?1:0).map(p=>[p.x,p.z,p.y]));distance+=p.at(-1).s;physicalSegments.push({edgeId:e.id,startS:start,endS:distance,length:p.at(-1).s});if(e.control){const offset=e.control.offset==='tail'?Math.max(0,p.at(-1).s-60):(e.control.offset||0),nodePoint=map(0,e.control.node==='south'?205:-160,bridgeY);controls.push({...e.control,node:`${prefix}:${e.control.node}`,s:start+offset,endS:start+offset+(e.control.zoneLength||p.at(-1).s+30),point:{x:nodePoint[0],z:nodePoint[1],y:nodePoint[2]},radius:65});}if(id==='town-ring')townExitS=distance;}
  const measured=annotate(points),first=measured[0],last=measured.at(-1),xs=measured.map(p=>p.x),zs=measured.map(p=>p.z);return{localIndex:index,exitNumber,townSpeed:regionLayout(index).roads[0].speed,regionId:region.id,destinationName:region.name,destinationHints:region.kind==='crabbay'?['螃蟹湾','海岸后勤基地']:region.kind==='baker'?['迷你贝克街','Owl 侦探社']:region.kind==='urban-viaduct'?[region.name,'城市高架']:[region.name,'田边村道'],geometryKey,id:`${prefix}:${type}:${from}>${to}`,junctionId:prefix,from,to,turn:'right',city:true,local:true,width:7.5,offset:1,laneWidth:3.5,points:measured,length:last.s,startS:projectMain(from,first.x,first.z,first.y).s,joinS:projectMain(to,last.x,last.z,last.y).s,departLength:400,departureEndS:projectMain(from,first.x,first.z,first.y).s+400,mergeStartS:projectMain(to,last.x,last.z,last.y).s-420,decelerationStartS:180,decelerationEndS:500,accelerationStartS:last.s-600,mergeTaperStartS:last.s-180,townEntryS,townExitS,physicalSegments,controls,bounds:{minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)}};};
 const routes=[];for(const from of [primary,opposite])for(const to of [primary,opposite])routes.push(makeRoute(from,to));
 const compose=ids=>annotate(join(...ids.map(id=>edges.get(id).points.map(p=>[p.x,p.z,p.y]))));
 const preferred=primary.slice(0,-1)==='A'?'A+':primary,exit={id:'exit',width:7.5,offset:1,points:compose(inbound[preferred])},merge={id:'merge',width:7.5,offset:1,points:compose(outbound[preferred])};
 return decorateLocalTolls({region,type,name:INTERCHANGE_NAMES[type],town,finish:{x:end[0],z:end[1],y:end[2]},exit,roads:[exit,merge,...physical],renderRoads:physical,routes,physicalEdges:edges});
}
