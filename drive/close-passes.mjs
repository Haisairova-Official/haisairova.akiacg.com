import {trafficBodies} from './traffic-fleet.mjs?rev=world21d';
import {vehicleBodies} from './vehicle-footprint.mjs?rev=world21d';
// True horizontal oriented body-box separation, independent of lane centre gaps.
const dot=(a,b)=>a.x*b.x+a.z*b.z;
function corners(p){const f={x:Math.sin(p.heading),z:Math.cos(p.heading)},r={x:f.z,z:-f.x};return[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>({x:p.x+r.x*p.width/2*a+f.x*p.length/2*b,z:p.z+r.z*p.width/2*a+f.z*p.length/2*b}));}
function pointSegment(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);}
export function bodyGap(a,b){const A=corners(a),B=corners(b);let separate=false;for(const p of [a,b])for(const axis of [{x:Math.sin(p.heading),z:Math.cos(p.heading)},{x:Math.cos(p.heading),z:-Math.sin(p.heading)}]){const aa=A.map(v=>dot(v,axis)),bb=B.map(v=>dot(v,axis));if(Math.max(...aa)<Math.min(...bb)||Math.max(...bb)<Math.min(...aa))separate=true;}if(!separate)return 0;let d=Infinity;for(let i=0;i<4;i++)for(let j=0;j<4;j++){d=Math.min(d,pointSegment(A[i],B[j],B[(j+1)%4]),pointSegment(B[i],A[j],A[(j+1)%4]));}return d;}
export const clearanceReward=gap=>Math.round(50+150*Math.max(0,Math.min(1,(2-gap)/2)));
export function createPassTracker(){const entities=new Map();let collisions=0;return{entities,
 step(player,cars){const awards=[],live=new Set(),crashed=player.collisions!==collisions;collisions=player.collisions;
  for(const car of cars){const key=`${car.id}:${car.generation}`,parts=trafficBodies(car),mine=player.vehicle?vehicleBodies(player):[player],p=parts[0];live.add(key);let e=entities.get(key);const f={x:Math.sin(p.heading),z:Math.cos(p.heading)},dx=player.x-p.x,dz=player.z-p.z,along=dx*f.x+dz*f.z,side=dx*f.z-dz*f.x,projection=(b)=>{const offset=(b.x-p.x)*f.x+(b.z-p.z)*f.z,angle=b.heading-p.heading,half=Math.abs(Math.cos(angle))*b.length/2+Math.abs(Math.sin(angle))*b.width/2;return{min:offset-half,max:offset+half};},aBounds=mine.map(projection),bBounds=parts.map(projection),aMin=Math.min(...aBounds.map(b=>b.min)),aMax=Math.max(...aBounds.map(b=>b.max)),bMin=Math.min(...bBounds.map(b=>b.min)),bMax=Math.max(...bBounds.map(b=>b.max));
   if(!e){e={behind:aMax<bMin-1,minGap:Infinity,invalid:false,done:false};entities.set(key,e);}
   if(e.done)continue;if(crashed||player.speed<-.1||player.rolled)e.invalid=true;
   if(aMax>bMin&&aMin<bMax&&Math.abs(side)<8&&Math.abs((player.roadY||0)-(p.y||0))<2){const gap=Math.min(...mine.flatMap(a=>parts.map(b=>bodyGap(a,b))));e.minGap=Math.min(e.minGap,gap);if(gap<.015)e.invalid=true;}
   if(aMin>bMax+1){if(e.behind&&!e.invalid&&e.minGap<6&&Math.cos(player.heading-p.heading)>.8&&player.vx*f.x+player.vz*f.z>Math.max(1,car.velocity+.5))awards.push({id:car.id,generation:car.generation,gap:e.minGap,points:clearanceReward(e.minGap)});e.done=true;}
  }for(const key of entities.keys())if(!live.has(key))entities.delete(key);return awards;
 },invalidate(){for(const e of entities.values())e.invalid=true;}};}
