import {naturalTerrainHeight,NETWORK_CENTRE,GRID_SIZE,riverDistance} from './road-network.mjs?rev=world21d';
// Pure, absolute-coordinate plans. No active road graph, visibility or frame RNG.
export const SCENERY_VERSION='countryside-1',SCENIC_TILE_SIZE=320;
export const sceneryResolution=plan=>plan.lakes.length?48:24;
// Fine lake tiles meet the existing 24-cell neighbours exactly along the edge.
export function stitchSceneryTileEdges(heights,steps){if(steps!==48)return;const row=steps+1;for(let k=1;k<steps;k+=2)for(const i of[k,steps*row+k,k*row,k*row+steps]){const delta=(i<row||i>=steps*row)?1:row;heights[i]=(heights[i-delta]+heights[i+delta])/2;}}
const cache=new Map(),clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
function random(ix,iz,slot,seed){let n=Math.imul(ix|0,73856093)^Math.imul(iz|0,19349663)^Math.imul(slot,83492791)^seed;n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return((n^(n>>>16))>>>0)/4294967296;}
const overlaps=(a,b)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minZ<=b.maxZ&&a.maxZ>=b.minZ;
const box=(x,z,rx,rz=rx)=>({minX:x-rx,maxX:x+rx,minZ:z-rz,maxZ:z+rz});
export function sceneryReserved(b){
 // Analytic reservations include every future corridor, not just rendered ones.
 for(const [lo,hi,origin]of[[b.minX,b.maxX,NETWORK_CENTRE.x],[b.minZ,b.maxZ,NETWORK_CENTRE.z]])if(Math.ceil((lo-origin-300)/GRID_SIZE)<=Math.floor((hi-origin+300)/GRID_SIZE))return true;
 const gx0=Math.ceil((b.minX-NETWORK_CENTRE.x-700)/GRID_SIZE),gx1=Math.floor((b.maxX-NETWORK_CENTRE.x+700)/GRID_SIZE),gz0=Math.ceil((b.minZ-NETWORK_CENTRE.z-700)/GRID_SIZE),gz1=Math.floor((b.maxZ-NETWORK_CENTRE.z+700)/GRID_SIZE);if(gx0<=gx1&&gz0<=gz1)return true;
 const exits=[760];for(let k=Math.max(0,Math.ceil((b.minX-850-5200)/6000));k<=Math.floor((b.maxX+850-5200)/6000);k++)exits.push(5200+k*6000);
 for(const x of exits)if(overlaps(b,{minX:x-850,maxX:x+850,minZ:-850,maxZ:1050})||overlaps(b,{minX:x-400,maxX:x+400,minZ:650,maxZ:2400}))return true;
 return overlaps(b,{minX:-1580,maxX:1230,minZ:-350,maxZ:350});
}
const freeze=p=>{for(const a of [p.houses,p.fields,p.lakes]){for(const f of a){Object.freeze(f.bounds);Object.freeze(f);}Object.freeze(a);}return Object.freeze(p);};
export function sceneryPlan(ix,iz,seed=7127){
 const key=`${SCENERY_VERSION}:${seed}:${ix},${iz}`;if(cache.has(key))return cache.get(key);const r=i=>random(ix,iz,i,seed),plan={id:key,ix,iz,houses:[],fields:[],lakes:[]},x0=ix*320,z0=iz*320;
 const clear=b=>b.minX>x0+1&&b.maxX<x0+319&&b.minZ>z0+1&&b.maxZ<z0+319&&!sceneryReserved(b)&&[b.minX,b.maxX,(b.minX+b.maxX)/2].every(x=>[b.minZ,b.maxZ,(b.minZ+b.maxZ)/2].every(z=>riverDistance(x,z)>90));
 if(r(1)<.28){const x=x0+145+r(2)*30,z=z0+145+r(3)*30,rx=48+r(4)*22,rz=43+r(5)*20,bounds=box(x,z,rx*1.4+28,rz*1.4+28);if(clear(bounds)){
  let min=Infinity,max=-Infinity;for(let j=0;j<=48;j++)for(let i=0;i<=48;i++){const xx=x0+i*320/48,zz=z0+j*320/48,q=Math.hypot((xx-x)/rx,(zz-z)/rz);if(q>=.8&&q<1.65){const h=naturalTerrainHeight(xx,zz,seed);min=Math.min(min,h);max=Math.max(max,h);}}
  if(min>.8&&max-min<6.5)plan.lakes.push({id:key+':lake',x,z,rx,rz,level:min-.6,depth:2.3+r(6)*1.5,bounds});
 }}
 if(!plan.lakes.length&&r(10)<.66){const x=x0+80+r(11)*160,z=z0+80+r(12)*160,bounds=box(x,z,60);if(clear(bounds)){const heights=[];for(const a of[-1,0,1])for(const b of[-1,0,1])heights.push(naturalTerrainHeight(x+a*24,z+b*24,seed));if(Math.min(...heights)>-.1&&Math.max(...heights)-Math.min(...heights)<4.5)plan.houses.push({id:key+':house',x,z,y:naturalTerrainHeight(x,z,seed),width:10+r(13)*5,depth:9+r(14)*4,height:r(15)<.5?4:6.6,roof:2.1+r(16),tone:Math.floor(r(17)*4),bounds});}}
 if(!plan.lakes.length)for(let k=0;k<2;k++){const x=x0+82+k*156,z=z0+100+r(21+k)*120,rx=45+r(23+k)*20,rz=58+r(25+k)*25,bounds=box(x,z,rx+20,rz+20);if(!clear(bounds)||plan.houses.some(h=>overlaps(bounds,h.bounds))||plan.fields.some(f=>overlaps(bounds,f.bounds)))continue;const h=naturalTerrainHeight(x,z,seed);if(h>0&&h<16)plan.fields.push({id:key+':field'+k,x,z,rx,rz,rows:k%2,tone:Math.floor(r(27+k)*3),bounds});}
 freeze(plan);cache.set(key,plan);if(cache.size>128)cache.delete(cache.keys().next().value);return plan;
}
export function scenicHeight(plan,x,z,height){
 for(const h of plan.houses){const d=Math.max(Math.abs(x-h.x),Math.abs(z-h.z));if(d<42)height=height+(h.y-height)*(1-smooth((d-22)/20));}
 for(const l of plan.lakes){const q=Math.hypot((x-l.x)/l.rx,(z-l.z)/l.rz);if(q<1.3){const bed=l.level-l.depth*(1-smooth(q/.88));height=height+(Math.min(height,bed)-height)*(1-smooth((q-.85)/.45));}}
 return height;
}
export function scenicFieldColor(plan,x,z){for(const f of plan.fields){if(Math.abs(x-f.x)>f.rx||Math.abs(z-f.z)>f.rz)continue;const row=Math.floor(((f.rows?x-f.x:z-f.z)+1000)/14)%2;return [[0x779447,0xa2ad59],[0xc1ac69,0x96894c],[0x947b57,0x7c704d]][f.tone][row];}return null;}
export function scenicVegetationAllowed(plan,x,z){return ![...plan.houses,...plan.fields,...plan.lakes].some(f=>x>f.bounds.minX-3&&x<f.bounds.maxX+3&&z>f.bounds.minZ-3&&z<f.bounds.maxZ+3);}
export const sceneryCacheSize=()=>cache.size;
// Sample the exact two-triangle terrain lattice (including fine-tile edge
// stitching), rather than the smooth source function underneath the mesh.
export function scenicMeshHeight(plan,x,z,baseHeight){const n=sceneryResolution(plan),u=Math.max(0,Math.min(n,(x-plan.ix*320)/320*n)),v=Math.max(0,Math.min(n,(z-plan.iz*320)/320*n)),i=Math.min(n-1,Math.floor(u)),j=Math.min(n-1,Math.floor(v)),a=u-i,b=v-j,raw=(i,j)=>{const xx=(plan.ix+i/n)*320,zz=(plan.iz+j/n)*320;return scenicHeight(plan,xx,zz,baseHeight(xx,zz));},h=(i,j)=>n===48&&(j===0||j===n)&&i%2?(raw(i-1,j)+raw(i+1,j))/2:n===48&&(i===0||i===n)&&j%2?(raw(i,j-1)+raw(i,j+1))/2:raw(i,j),h00=h(i,j),h10=h(i+1,j),h01=h(i,j+1),h11=h(i+1,j+1);return a+b<=1?h00*(1-a-b)+h10*a+h01*b:h11*(a+b-1)+h01*(1-a)+h10*(1-b);}
