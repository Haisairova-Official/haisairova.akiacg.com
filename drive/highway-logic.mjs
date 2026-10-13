export const HIGHWAY_START=40, CHUNK_LENGTH=80, CHUNK_COUNT=10, EXIT_INTERVAL=720;
export const LANES=[13,19,25];
export const nextExitAt=x=>HIGHWAY_START+Math.max(1,Math.ceil((x-HIGHWAY_START-35)/EXIT_INTERVAL))*EXIT_INTERVAL;
export const chunkIndices=x=>{const start=Math.max(0,Math.floor((x-HIGHWAY_START)/CHUNK_LENGTH)-2);return Array.from({length:CHUNK_COUNT},(_,i)=>start+i);};
export function rampCenter(exit,x){return 28+(x-(exit-55))*.34;}
export function onRoad(x,z){
  if(x<28)return false;
  if(z>=9.4&&z<=28.6)return true;
  const exit=nextExitAt(x);
  return x>=exit-55&&x<=exit+35&&Math.abs(z-rampCenter(exit,x))<=4;
}
export function touchesTraffic(a,b){return Math.abs(a.x-b.x)<3.9&&Math.abs(a.z-b.z)<1.65;}
