import{projectPath}from'./interchange-logic.mjs?rev=world21d';
import{roadAt,roadMetrics,measureRoad}from'./local-road-paths.mjs?rev=world21d';
const clamp=(t,a=0,b=1)=>Math.max(a,Math.min(b,t)),smooth=t=>{t=clamp(t);return t*t*t*(10+t*(-15+6*t));};
// Per-direction game half-station. Existing routes remain the ETC centreline;
// the mixed lane fans outward from that same physical access road.
export const TOLL_LAYOUT=Object.freeze({version:'toll-v1',gateFromTown:120,etcWidth:3.5,mixedWidth:4.5,mixedOffset:6.2,islandWidth:2.2,outer:9.2,canopyClearance:7,approach:100,departure:80,gateHalfLength:20,maxGateGrade:.025,minGateRadius:400});
export function tollFan(plaza,s){return smooth((s-plaza.startS)/(plaza.gateS-TOLL_LAYOUT.gateHalfLength-plaza.startS))*smooth((plaza.endS-s)/(plaza.endS-plaza.gateS-TOLL_LAYOUT.gateHalfLength));}
export function tollSection(path,s){const offset=path.offset||0,inner=offset-path.width/2,baseOuter=offset+path.width/2;let outer=baseOuter;for(const p of path.tollSections||[])if(s>=p.startS&&s<=p.endS)outer=Math.max(outer,baseOuter+(TOLL_LAYOUT.outer-baseOuter)*tollFan(p,s));return{inner,outer,centre:(inner+outer)/2,width:outer-inner,laneWidth:path.laneWidth||3.5};}
export function planTollHalf(edge,{id,direction,name,fromTown=TOLL_LAYOUT.gateFromTown}={}){
 const length=edge.points.at(-1).s,gateS=direction==='exit'?length-fromTown:fromTown,before=TOLL_LAYOUT.approach,after=TOLL_LAYOUT.departure,startS=gateS-before,endS=gateS+after;if(startS<8||endS>length-8)return{valid:false,id,reason:'shared-edge-too-short',length,gateS,startS,endS};
 const check=Array.from({length:41},(_,i)=>roadAt(edge.points,gateS-20+i)),metrics=roadMetrics(check);if(metrics.maxGrade>TOLL_LAYOUT.maxGateGrade)return{valid:false,id,reason:'gate-grade',metrics};if(metrics.minRadius<TOLL_LAYOUT.minGateRadius)return{valid:false,id,reason:'gate-radius',metrics};
 const plaza={valid:true,id,direction,name,edgeId:edge.id,gateS,startS,endS,length,point:roadAt(edge.points,gateS),metrics};
 plaza.lanes=['etc','mixed'].map((type,i)=>{const offset=i*TOLL_LAYOUT.mixedOffset,points=Array.from({length:Math.ceil(endS-startS)+1},(_,j)=>{const q=roadAt(edge.points,startS+j),o=offset*tollFan(plaza,startS+j);return{...q,x:q.x-Math.cos(q.heading)*o,z:q.z+Math.sin(q.heading)*o};});return{id:id+':'+type,type,width:i?TOLL_LAYOUT.mixedWidth:TOLL_LAYOUT.etcWidth,offset,points:measureRoad(points)};});return plaza;
}
export function planLocalTolls(data){const ids=['town-in','town-out'],plazas=ids.map((key,i)=>{const edge=data.physicalEdges?.get(key);return edge?planTollHalf(edge,{id:'toll:'+data.town.index+':'+(i?'entry':'exit'),direction:i?'entry':'exit',name:data.region.name+'收费站'}):{valid:false,reason:'missing-shared-edge',edgeId:key};});return{valid:plazas.every(p=>p.valid),regionIndex:data.town.index,plazas};}
// Map a shared physical section onto a composed route without changing the
// centreline or any cumulative station in the existing road graph.
const sectionRecord=p=>{const{lanes,metrics,...section}=p;return section;};
export function attachTollSections(path,plazas){const sections=[];for(const p of plazas.filter(p=>p.valid)){const e=path.physicalSegments?.find(e=>e.edgeId===p.edgeId);if(e){const shift=e.startS-(e.edgeStartS||0);sections.push({...sectionRecord(p),startS:p.startS+shift,gateS:p.gateS+shift,endS:p.endS+shift});}else if(path.id===p.edgeId)sections.push(sectionRecord(p));}path.tollSections=sections;return path;}

export function decorateLocalTolls(data){const plan=planLocalTolls(data);data.tollPlazas=plan.plazas.filter(p=>p.valid);for(const path of new Set([...data.physicalEdges.values(),...data.roads,...data.routes])){attachTollSections(path,data.tollPlazas);if(!path.tollSections.length&&['exit','merge'].includes(path.id)){for(const p of data.tollPlazas){const q=projectPath(path,p.point.x,p.point.z,p.point.y);if(q.distance<.1&&Math.abs(q.y-p.point.y)<.1&&Math.cos(q.heading-p.point.heading)>.99){const shift=q.s-p.gateS;path.tollSections.push({...sectionRecord(p),startS:p.startS+shift,gateS:p.gateS+shift,endS:p.endS+shift});}}}}return data;}
// Road-edge sample retains the original station/heading for section masking.
export function tollEdgePoints(path,points,side,padding=.28){return points.map(p=>{const r=tollSection(path,p.s),offset=(side<0?r.inner:r.outer)+side*padding;return{...p,x:p.x-Math.cos(p.heading)*offset,z:p.z+Math.sin(p.heading)*offset};});}

export function tollMixedMarking(path,p){let fan=0;for(const plaza of path.tollSections||[])if(p.s>=plaza.startS&&p.s<=plaza.endS)fan=Math.max(fan,tollFan(plaza,p.s));const o=1.75+(TOLL_LAYOUT.mixedOffset+TOLL_LAYOUT.mixedWidth/2-1.75)*fan;const half=fan>.025?.065:0;return{inner:o-half,outer:o+half};}
