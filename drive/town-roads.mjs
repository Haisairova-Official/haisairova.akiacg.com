import {regionRoadsWorld,regionExitNavigation} from './region-roads.mjs?rev=world21d';
// Shared town centreline graph: the ring, both cross streets and the two
// physical east-side connection roads. Distances follow these edges.
export const townWorldPoint=(p,t)=>({x:t.x+Math.cos(t.angle)*p[0]+Math.sin(t.angle)*p[1],z:t.z-Math.sin(t.angle)*p[0]+Math.cos(t.angle)*p[1],y:t.y});
const ring=[[0,-19],[15,-19]];
for(const [cx,cz,start,after]of [[15,-9,-Math.PI/2,[25,0]],[15,9,0,[0,19]],[-15,9,Math.PI/2,[-25,0]],[-15,-9,Math.PI,[0,-19]]]){for(let i=0;i<=8;i++){const a=start+i*Math.PI/16;ring.push([cx+10*Math.cos(a),cz+10*Math.sin(a)]);}ring.push(after);}
const lines=[ring,[[-25,0],[-9,0]],[[9,0],[25,0]],[[0,-19],[0,-9]],[[0,9],[0,19]],[[15,19],[44,19]],[[15,-19],[44,-19]]];
const nodes=[],edges=[],indices=new Map();
const index=p=>{const key=p.map(n=>n.toFixed(6)).join(',');if(!indices.has(key)){indices.set(key,nodes.length);nodes.push(p);}return indices.get(key);};
for(const line of lines)for(let i=1;i<line.length;i++){const a=index(line[i-1]),b=index(line[i]);if(a!==b)edges.push({a,b,length:Math.hypot(nodes[a][0]-nodes[b][0],nodes[a][1]-nodes[b][1])});}
const target=index([44,19]),dist=nodes.map(()=>Infinity),next=nodes.map(()=>null),visited=new Set();dist[target]=0;
for(let i=0;i<nodes.length;i++){let n=-1;for(let j=0;j<nodes.length;j++)if(!visited.has(j)&&(n<0||dist[j]<dist[n]))n=j;if(n<0||!Number.isFinite(dist[n]))break;visited.add(n);for(const e of edges){const other=e.a===n?e.b:e.b===n?e.a:null;if(other!==null&&dist[n]+e.length<dist[other]){dist[other]=dist[n]+e.length;next[other]=n;}}}
export function townMapRoads(town){if(town.index!==null&&town.index!==undefined)return regionRoadsWorld(town);return lines.map((p,i)=>({id:`town-street:${town.index??'origin'}:${i}`,width:i===0?9.2:i<=4?6:4.5,kind:'town',points:p.map(p=>townWorldPoint(p,town))}));}
export function townExitNavigation(state,town){
 if(town.index!==null&&town.index!==undefined)return regionExitNavigation(state,town);
 const dx=state.x-town.x,dz=state.z-town.z,x=Math.cos(town.angle)*dx-Math.sin(town.angle)*dz,z=Math.sin(town.angle)*dx+Math.cos(town.angle)*dz;let best=null;
 for(const e of edges){const a=nodes[e.a],b=nodes[e.b],vx=b[0]-a[0],vz=b[1]-a[1],u=Math.max(0,Math.min(1,((x-a[0])*vx+(z-a[1])*vz)/e.length**2)),point=[a[0]+u*vx,a[1]+u*vz],off=Math.hypot(x-point[0],z-point[1]),viaA=u*e.length+dist[e.a],viaB=(1-u)*e.length+dist[e.b],distance=Math.min(viaA,viaB);if(!best||off<best.off-1e-6||Math.abs(off-best.off)<1e-6&&distance<best.distance)best={off,distance,point,node:viaA<viaB?e.a:e.b};}
 const points=[best.point];let n=best.node;for(let i=0;n!==null&&i<=nodes.length;i++){points.push(nodes[n]);n=next[n];}
 return{distance:best.distance,offRoad:best.off>4.1,points:points.map(p=>townWorldPoint(p,town))};
}
