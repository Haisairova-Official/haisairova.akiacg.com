import {mainPoint,roadSection,roadVerticalClear,terrainHeight} from './road-network.mjs?rev=world21d';
// Right-side warning panels share the directed carriageway's local coordinates.
// Their physical station stays exactly 300 route metres before the camera.
export const MONITOR_WARNING_WIDTH=4.8,MONITOR_WARNING_POST_BACK=.25;
export function monitorWarningPlacement(id,station){
 const p=mainPoint(id,station),section=roadSection(id),half=MONITOR_WARNING_WIDTH/2;
 for(let offset=section.outer+half+1.4;offset<section.outer+40;offset+=.5){
  const x=p.x-Math.cos(p.heading)*offset,z=p.z+Math.sin(p.heading)*offset,postX=x+Math.sin(p.heading)*MONITOR_WARNING_POST_BACK,postZ=z+Math.cos(p.heading)*MONITOR_WARNING_POST_BACK,base=Math.min(0,terrainHeight(postX,postZ)-p.y);
  const clear=[-half,-half/2,0,half/2,half].every(o=>roadVerticalClear(x-Math.cos(p.heading)*o,z+Math.sin(p.heading)*o,p.y+1.6,p.y+4.05,.35))&&roadVerticalClear(postX,postZ,p.y+base,p.y+4.05,.3);
  if(clear)return{offset,base,point:p,valid:true};
 }return{offset:section.outer+half+1.4,base:0,point:p,valid:false};
}
