import {planTollHalf,attachTollSections} from './toll-layout.mjs?rev=world21d';
import {annotate,bezier,projectPath} from './interchange-logic.mjs?rev=world21d';
// Four origin routes share physical edges; only the two missing arms are new.
export function buildArchiveAlternatives(A,{mainPoint,projectMain,outerLane,smooth}){
const V=p=>[p.x,p.z,p.y], join=(...a)=>a.flatMap((p,i)=>i?p.slice(1):p), line=(a,b)=>bezier(a,a.map((v,i)=>v+(b[i]-v)/3),a.map((v,i)=>v+2*(b[i]-v)/3),b,Math.ceil(Math.hypot(...b.map((v,i)=>v-a[i]))));
const B=(a,b,c,d)=>bezier(a,b,c,d,300);const raw=(x,z,y=0)=>[x,z,y];const arc=(x,z,r,a,b)=>{const n=Math.ceil(Math.abs(b-a)*r);return Array.from({length:n+1},(_,i)=>raw(x+r*Math.cos(a+(b-a)*i/n),z+r*Math.sin(a+(b-a)*i/n)));};
const at=(id,x,offset=0)=>mainPoint(id,(id==='A+'?1:-1)*(x-2200),outerLane(id)+offset);
const motor=(id,x0,x1,offset)=>{const n=Math.ceil(Math.abs(x1-x0));return Array.from({length:n+1},(_,i)=>{const u=i/n;return V(at(id,x0+(x1-x0)*u,typeof offset==='function'?offset(u):offset));});};
const north=at('A-',450,8), ni=A.points.reduce((best,p,i)=>p.s<A.townEntryS&&Math.abs(p.x-315)<Math.abs(A.points[best].x-315)?i:best,0), m=A.points[ni], next=A.points[ni+1], hm=Math.atan2(next.x-m.x,next.z-m.z);
const r=60,k=.552284749831,R=r*k,top=raw(m.x,m.z-2*r),right=raw(m.x+r,m.z-r),end=V(m);
let off=annotate(join(motor('A+',-1500,-1320,u=>3.75*smooth(u)),motor('A+',-1320,-1100,3.75),B(V(at('A+',-1100,3.75)),raw(-1033.333333,20.375),raw(-966.666667,35),raw(-900,35)),line(raw(-900,35),raw(-580,35)),B(raw(-580,35),raw(-470,35),raw(-240,-70),raw(-100,-70)),line(raw(-100,-70),raw(150,-70)),B(raw(150,-70),raw(205,-70),raw(260,top[1]),top),B(top,raw(top[0]+R,top[1]),raw(right[0],right[1]-R),right),B(right,raw(right[0],right[1]+R),raw(m.x-Math.sin(hm)*R,m.z-Math.cos(hm)*R),end)));
const closestX=(pts,x)=>pts.reduce((a,p)=>Math.abs(p.x-x)<Math.abs(a.x-x)?p:a), riseStart=closestX(off,-975).s,riseEnd=closestX(off,-540).s,fallStart=closestX(off,-350).s,fallEnd=closestX(off,150).s,offZero=closestX(off,0).s,offEnd=off.at(-1).s;
off=annotate(off.map(p=>[p.x,p.z,8*smooth((p.s-riseStart)/(riseEnd-riseStart))*(1-smooth((p.s-fallStart)/(fallEnd-fallStart)))-.65*smooth((p.s-offZero)/(fallEnd-offZero))*(1-smooth((p.s-(offEnd-140))/90))]));
const oi=A.points.findIndex(p=>p.s>=A.townExitS+(A.commonOutLength||15)-.0001),p=A.points[oi],prev=A.points[oi-1],pn=A.points[oi+1],h=Math.atan2(pn.x-p.x,pn.z-p.z),grade=(pn.y-prev.y)/Math.hypot(pn.x-prev.x,pn.z-prev.z);const rr=(108.67587475294494-p.z)/2,kr=rr*k,rt=raw(p.x+rr,p.z+rr),bottom=raw(p.x,p.z+2*rr);
let out=annotate(join(B(V(p),raw(p.x+Math.sin(h)*kr,p.z+Math.cos(h)*kr),raw(rt[0],rt[1]-kr),rt),B(rt,raw(rt[0],rt[1]+kr),raw(bottom[0]+kr,bottom[1]),bottom),line(bottom,raw(-300,bottom[1])),arc(-300,bottom[1]-100,100,Math.PI/2,Math.PI),line(raw(-400,bottom[1]-100),raw(-400,-160)),arc(-470,-160,70,0,-Math.PI/2),line(raw(-470,-230),raw(-650,-230)),B(raw(-650,-230),raw(-850,-230),raw(-900,-9.375),V(at('A-',-1100,3.75))),motor('A-',-1100,-1320,3.75),motor('A-',-1320,-1500,u=>3.75*(1-smooth(u)))));
const hermite=(a,b,da,db,t,l)=>(2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*da*l+(-2*t**3+3*t*t)*b+(t**3-t*t)*db*l;
const dipStart=out.reduce((best,p)=>Math.hypot(p.x+250,p.z-bottom[1])<Math.hypot(best.x+250,best.z-bottom[1])?p:best).s,dipReturn=out.reduce((best,p)=>Math.hypot(p.x+400,p.z+160)<Math.hypot(best.x+400,best.z+160)?p:best).s;
const oldOutPath={id:'old-out',points:A.points.filter(p=>p.s>=A.townExitS)};
out=annotate(out.map(q=>[q.x,q.z,(q.s<125?projectPath(oldOutPath,q.x,q.z).y*(1-smooth((q.s-25)/100)):0)-.4*smooth((q.s-dipStart)/150)*(1-smooth((q.s-dipReturn)/200))]));
 // Grade profiles preserve at least 5.55m audited clear space under the
 // actual 1.58m soffit and .22m lower pavement, including the 7.5m roadbed.
 const oldPoints=A.points,parts=new Map([
 ['west-in',annotate(oldPoints.slice(0,ni+1).map(V))],['common',annotate(oldPoints.slice(ni,oi+1).map(V))],['east-out',annotate(oldPoints.slice(oi).map(V))],['east-in',off],['west-out',out]]);
 const make=(from,to)=>{const sequence=[from==='A+'?'east-in':'west-in','common',to==='A+'?'east-out':'west-out'],coords=[],physicalSegments=[];let distance=0,commonStart=0,newOutStart=0;
  for(const key of sequence){const points=parts.get(key);if(key==='common')commonStart=distance;if(key==='west-out')newOutStart=distance;coords.push(...points.slice(coords.length?1:0).map(V));physicalSegments.push({edgeId:'archive:'+key,startS:distance,endS:distance+points.at(-1).s,length:points.at(-1).s});distance+=points.at(-1).s;}
  const points=annotate(coords),first=points[0],last=points.at(-1),id=from==='A-'&&to==='A+'?A.id:`archive:${from}>${to}`,prefix=parts.get(sequence[0]).at(-1).s,exit=to==='A+'?A.length-oldPoints[oi].s:out.at(-1).s,startS=projectMain(from,first.x,first.z,first.y).s,joinS=projectMain(to,last.x,last.z,last.y).s,route={...A,id,geometryKey:'archive-toll-v1:'+from+'>'+to,from,to,width:7.5,offset:1,laneWidth:3.5,points,length:last.s,startS,joinS,townEntryS:commonStart+A.townEntryS-oldPoints[ni].s,townExitS:commonStart+A.townExitS-oldPoints[ni].s,physicalSegments,
   departLength:from==='A+'?600:A.departLength,departureEndS:from==='A+'?-3300:A.departureEndS,decelerationStartS:180,decelerationEndS:400,mergeStartS:to==='A-'?3300:A.mergeStartS,accelerationStartS:to==='A-'?last.s-400:last.s-(A.length-A.accelerationStartS),mergeTaperStartS:last.s-180,
   auxiliary:[{roadId:from,startS,endS:from==='A+'?-3300:A.departureEndS},{roadId:to,startS:to==='A-'?3300:A.mergeStartS,endS:joinS}],
   controls:[{node:'archive:inbound-merge',priority:from==='A-'?0:1,s:Math.max(0,prefix-25),endS:prefix+45,point:{x:m.x,z:m.z,y:m.y},radius:30}],bounds:points.reduce((b,p)=>({minX:Math.min(b.minX,p.x),maxX:Math.max(b.maxX,p.x),minZ:Math.min(b.minZ,p.z),maxZ:Math.max(b.maxZ,p.z)}),{minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity})};
  if(from==='A+'&&to==='A+')route.renderPoints=points.slice(0,off.length);
  if(from==='A-'&&to==='A-')route.renderPoints=points.filter(p=>p.s>=newOutStart-1e-6);
  if(from==='A+'&&to==='A-')route.renderSuppressed=true;
  return route;
 };
 const routes=[make('A-','A+'),make('A+','A+'),make('A-','A-'),make('A+','A-')];
 const common=parts.get('common'),entryAt=A.townEntryS-oldPoints[ni].s,exitAt=A.townExitS-oldPoints[ni].s;
 const tolls=[planTollHalf({id:'archive:common',points:annotate(common.filter(p=>p.s<=entryAt+.001).map(V)),width:7.5,offset:1},{id:'toll:origin:exit',direction:'exit',name:'存档街区收费站'}),planTollHalf({id:'archive:common',points:annotate(common.filter(p=>p.s>=exitAt-.001).map(V)),width:7.5,offset:1},{id:'toll:origin:entry',direction:'entry',name:'存档街区收费站'})];
 if(tolls.some(p=>!p.valid))throw Error('origin toll geometry: '+JSON.stringify(tolls));
 Object.assign(tolls[1],{startS:tolls[1].startS+exitAt,gateS:tolls[1].gateS+exitAt,endS:tolls[1].endS+exitAt});
 for(const r of routes){r.tollPlazas=tolls;attachTollSections(r,tolls);}Object.assign(A,routes[0]);routes[0]=A;return routes;
}
