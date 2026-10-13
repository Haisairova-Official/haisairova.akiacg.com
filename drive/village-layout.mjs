import{measureRoad,roadAt,roadSlice,joinRoads}from'./local-road-paths.mjs?rev=world21d';
import{annotate,bezier,projectPath}from'./interchange-logic.mjs?rev=world21d';
import{regionHash}from'./region-key.mjs?rev=world21d';
const join=(...parts)=>parts.flatMap((p,i)=>i?p.slice(1):p),line=(a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/1.5));return Array.from({length:n+1},(_,i)=>[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n,0]);},arc=(x,z,r,a,b)=>{const n=Math.ceil(Math.abs(b-a)*r/1.5);return Array.from({length:n+1},(_,i)=>[x+r*Math.cos(a+(b-a)*i/n),z+r*Math.sin(a+(b-a)*i/n),0]);};
const measure=points=>{const p=annotate(points);return p.map((q,i)=>{const a=p[Math.max(0,i-1)],b=p[Math.min(p.length-1,i+1)];return{...q,heading:Math.atan2(b.x-a.x,b.z-a.z)};});};
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
export function buildVillageLayout(region,profile){
 const rand=s=>regionHash(region.id+'|v3|'+s)/4294967295,variant=region.seed%3,L=310+Math.floor(rand('blocks')*4)*40,south=variant===1?-125:variant===2?-75:-90,north=variant===1?125:variant===2?145:105,R=variant===2?70:60;
 const approach=join(line([44,-19],[24,-19]),bezier([24,-19,0],[-55,-19,0],[-45,south,0],[-125,south,0],105));
 const west=join(line([-125,south],[-L+R,south]),arc(-L+R,south+R,R,-Math.PI/2,-Math.PI),line([-L,south+R],[-L,north-R]),arc(-L+R,north-R,R,-Math.PI,-Math.PI*1.5));
 const back=variant===0?join(line([-L+R,north],[-125,north]),bezier([-125,north,0],[-45,north,0],[-55,19,0],[24,19,0],105),line([24,19],[44,19])):variant===1?join(line([-L+R,north],[-230,north]),bezier([-230,north,0],[-175,north,0],[-185,62,0],[-130,62,0],80),bezier([-130,62,0],[-65,62,0],[-45,19,0],[24,19,0],95),line([24,19],[44,19])):join(line([-L+R,north],[-175,north]),bezier([-175,north,0],[-85,north,0],[-60,19,0],[24,19,0],135),line([24,19],[44,19]));
 const centre=measure(join(approach,west,back)),total=centre.at(-1).s;for(const p of centre)p.rightApron=1.8*ease((p.s-4)/25)*ease((total-p.s-4)/25);
 const through=measure(centre.map(p=>{const o=1.6*ease((p.s-6)/18)*ease((total-p.s-6)/18);return[p.x+Math.cos(p.heading)*o,p.z-Math.sin(p.heading)*o,p.y];}));
 const main={id:region.id+':street',kind:'town',roadType:'village',structure:'ground',layer:0,...profile,points:centre},parking={id:'village-parking',x:28,z:-36,heading:Math.PI,landmarkId:region.destinationId};
 const road=(id,points,width=6.6)=>({id:region.id+':'+id,kind:'town',roadType:'village',structure:'ground',layer:0,width,speed:20/3.6,sidewalk:0,points:measure(points)});
 const roads=[main,road('parking',line([28,-19-profile.width/2],[28,-42]),6)];
 // A real transverse street and optional farm branches form distinct street
 // networks. Their junctions are shared with the collector, not scaled scenery.
 const crossX=variant===2?-L+105:-L+130,low=centre.reduce((a,p)=>p.z<0&&Math.abs(p.x-crossX)<Math.abs(a.x-crossX)?p:a,centre.find(p=>p.x<crossX+10&&p.z<0)),high=centre.reduce((a,p)=>p.z>0&&Math.abs(p.x-crossX)<Math.abs(a.x-crossX)?p:a,centre.find(p=>p.x<crossX+10&&p.z>0));
 roads.push(road('cross-street',line([low.x,low.z],[high.x,high.z]),7.2));
 // A dedicated west collector T points away from this village's motorway,
 // into its geographic cell. Reserve it before farm lanes and scenery.
 const node={id:region.id+':local-junction',x:-L,z:(south+north)/2,y:0},lane=1.75,setback=31.75,portEnd={x:-L-80,z:node.z,y:0,heading:-Math.PI/2};
 const branch=road('local-port',line([node.x,node.z],[portEnd.x,portEnd.z]),8.5);branch.localPort=true;roads.push(branch);
 const near=through.reduce((a,p)=>Math.hypot(p.x-node.x,p.z-node.z)<Math.hypot(a.x-node.x,a.z-node.z)?p:a,through[0]),startS=near.s-setback,endS=near.s+setback,a=roadAt(through,startS),b=roadAt(through,endS),out={x:node.x-setback,z:node.z+lane,y:0},incoming={x:node.x-setback,z:node.z-lane,y:0};
 const curve=(p,q,h0,h1)=>measureRoad(bezier([p.x,p.z,0],[p.x+Math.sin(h0)*22,p.z+Math.cos(h0)*22,0],[q.x-Math.sin(h1)*22,q.z-Math.cos(h1)*22,0],[q.x,q.z,0],40));
 const outTurn=curve(a,out,0,-Math.PI/2),inTurn=curve(incoming,b,Math.PI/2,0);
 roads.push({...road('local-turn-out',outTurn.map(p=>[p.x,p.z,p.y]),5.4),junction:true},{...road('local-turn-in',inTurn.map(p=>[p.x,p.z,p.y]),5.4),junction:true});
 const outbound=joinRoads(outTurn,measureRoad(line([out.x,out.z],[portEnd.x,portEnd.z+lane]))),inbound=joinRoads(measureRoad(line([portEnd.x,portEnd.z-lane],[incoming.x,incoming.z])),inTurn);
 const externalPort={id:region.id+':local-port',node,point:portEnd,heading:-Math.PI/2,laneWidth:3.5,width:8.5,mainStartS:startS,mainEndS:endS,outbound,inbound,controlRadius:48};
 const spurs=variant+1;for(let i=0;i<spurs;i++){const target=total*(.24+i*.16),p=centre.reduce((a,p)=>Math.abs(p.s-target)<Math.abs(a.s-target)?p:a,centre[0]),length=45+20*Math.floor(rand('spur'+i)*3),side=-1;if(Math.hypot(p.x-node.x,p.z-node.z)<65)continue;roads.push(road('farm-lane-'+i,line([p.x,p.z],[p.x+Math.cos(p.heading)*side*length,p.z-Math.sin(p.heading)*side*length]),6.2));}
 const clearance=(x,z,r,extra=0)=>roads.every(road=>{const q=projectPath(road,x,z,0);return q.distance>road.width/2+r+2.3+extra;});
 const buildings=[],trees=[],fields=[];let serial=0;
 for(const p of centre){if(p.s<90||p.s>total-90||p.s<serial*29+90)continue;serial++;for(const side of[-1,1]){const key=serial+':'+side,w=9+Math.floor(rand(key+'w')*6),d=8+Math.floor(rand(key+'d')*4),r=Math.hypot(w,d)/2+.7,off=18+rand(key+'o')*8,x=p.x+Math.cos(p.heading)*off*side,z=p.z-Math.sin(p.heading)*off*side;if(!clearance(x,z,r)||buildings.some(b=>Math.hypot(b.x-x,b.z-z)<b.radius+r+5))continue;buildings.push({x,z,w,d,h:4.5+Math.floor(rand(key+'h')*3)*1.5,rotation:p.heading+(side>0?-Math.PI/2:Math.PI/2),radius:r,color:[0xd0c1a7,0xb9ae91,0xc8bea7,0xb4b0a3][Math.floor(rand(key+'c')*4)]});if(buildings.length>=22+variant*8)break;}if(buildings.length>=22+variant*8)break;}
 const pts=roads.flatMap(r=>r.points),bounds={minX:Math.min(...pts.map(p=>p.x))-42,maxX:63,minZ:Math.min(...pts.map(p=>p.z))-42,maxZ:Math.max(...pts.map(p=>p.z))+42};
 for(let x=Math.ceil((bounds.minX+20)/27)*27;x<bounds.maxX-22;x+=27)for(let z=Math.ceil((bounds.minZ+20)/27)*27;z<bounds.maxZ-20;z+=27){if(fields.length>=42||!clearance(x,z,16)||buildings.some(b=>Math.hypot(x-b.x,z-b.z)<b.radius+18))continue;fields.push({x,z,w:23,d:21,color:rand(x+':'+z)<.45?0x9aa567:0x869352});}
 for(let i=0;i<90&&trees.length<24;i++){const p=centre[Math.floor(rand('tree'+i)*centre.length)],side=i%2?1:-1,x=p.x+Math.cos(p.heading)*side*12,z=p.z-Math.sin(p.heading)*side*12;if(clearance(x,z,2)&&buildings.every(b=>Math.hypot(b.x-x,b.z-z)>b.radius+3)&&trees.every(t=>Math.hypot(t.x-x,t.z-z)>8))trees.push({x,z,size:.8+rand('size'+i)*.5});}
 const padBounds={minX:bounds.minX-8,maxX:bounds.maxX,minZ:bounds.minZ-8,maxZ:bounds.maxZ+8},terrainPad={centerX:(padBounds.minX+padBounds.maxX)/2,centerZ:(padBounds.minZ+padBounds.maxZ)/2,halfX:(padBounds.maxX-padBounds.minX)/2,halfZ:(padBounds.maxZ-padBounds.minZ)/2};
 return{region,roads,through,variant,buildings,trees,fields,groundBounds:padBounds,ports:{in:{x:44,z:-19,y:0,heading:-Math.PI/2},out:{x:44,z:19,y:0,heading:Math.PI/2}},bounds,terrainPad,externalPort,parking:[parking],landmarks:[{id:region.destinationId,name:region.name,kind:'place',x:28,z:-43,parking:parking.id,description:'可驶入的村落街道与田间支路。出口接往高速；区域间的地方公路正在接入。'}],spawn:{...through.reduce((best,p)=>p.s>8&&p.s<50&&Math.abs(p.x-20)<Math.abs(best.x-20)?p:best,through[0])},length:through.at(-1).s};
}
