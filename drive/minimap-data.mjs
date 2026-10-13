import {serviceApronMap,servicePlaceMarkers} from './service-network.mjs?rev=world21d';
import {regionForIndex} from './regions.mjs?rev=world21d';
import {regionLayout,regionWorldPoint} from './region-roads.mjs?rev=world21d';
import {MOTORWAYS,CONNECTORS,MOTORWAY_DEFS,roadFamily,roadSection,projectMain,mainPoint,networkRevision} from './road-network.mjs?rev=world21d';
import {townMapRoads,townWorldPoint as mapWorldPoint}from './town-roads.mjs?rev=world21d';
export {townMapRoads,mapWorldPoint};
export function buildMinimapData(state,{mode='city',route=null,town={x:0,z:0,y:0,angle:0,index:null},localRoads=[],physicalRoads=[],navigation=null,range,parkedVehicle}={}){
 range=range??(mode==='city'?65:route?.id?.startsWith('archive:')?550:850);const roads=[],markers=[];
 const close=p=>Math.abs(p.x-state.x)<range*1.5&&Math.abs(p.z-state.z)<range*1.5;
 for(const id of MOTORWAYS){const p=projectMain(id,state.x,state.z,state.roadY||0);if(p.distance>range*1.5)continue;const points=[],spacing=Math.max(6,range/35);for(let s=p.s-range*1.6;s<=p.s+range*1.6;s+=spacing)points.push(mainPoint(id,s));roads.push({id,width:roadSection(id).width,kind:'motorway',active:route?.id===id,points,number:MOTORWAY_DEFS[roadFamily(id)].number});}
 for(const path of CONNECTORS){if(path.routingOnly)continue;const b=path.bounds;if(b.maxX<state.x-range*1.5||b.minX>state.x+range*1.5||b.maxZ<state.z-range*1.5||b.minZ>state.z+range*1.5)continue;if(path.service){markers.push(...servicePlaceMarkers(path));roads.push(serviceApronMap(path));}let last=-Infinity;const points=path.points.filter((p,i)=>i===0||i===path.points.length-1||p.s-last>=Math.max(4,range/75)?(last=p.s,true):false);roads.push({id:path.id,width:path.width,kind:'ramp',active:route?.id===path.id,points});}
 for(const path of physicalRoads){if(path.points.some(close))roads.push({id:path.id,width:path.width,kind:'local',roadType:path.roadType,active:route?.id===path.id,points:path.points.filter((p,i)=>i%4===0||i===path.points.length-1)});}
 // Local road furniture includes crossroad branches absent from the NPC loop.
 for(const path of localRoads){if(path.points.some(close))roads.push({id:'local:'+path.id,width:path.width,kind:'ramp',active:!!route?.id?.startsWith(`town:${path.townIndex}:`)&&['exit','merge'].includes(path.id),points:path.points.filter((p,i)=>i%3===0||i===path.points.length-1)});}
 if(Math.hypot(town.x-state.x,town.z-state.z)<range*1.8){roads.push(...townMapRoads(town));if(navigation?.townPath)roads.push({id:'town-guidance',kind:'town',width:4,active:true,points:navigation.townPath});markers.push({kind:'entry',name:'高速入口',point:mapWorldPoint([44,19],town)},{kind:'place',name:regionForIndex(town.index).name,point:{...town}});for(const m of regionLayout(town.index)?.landmarks||[])markers.push({kind:'place',name:m.name,point:regionWorldPoint(m,town)});}
 if(parkedVehicle)markers.push({id:'player:parked-vehicle',kind:'place',name:'停放车辆',point:{...parkedVehicle}});
 if(navigation?.exit)markers.push({...navigation.exit,name:navigation.exit.name.split(' → ')[0],kind:'exit'});
 if(navigation?.camera)markers.push({...navigation.camera,kind:'camera',name:'摄像头'});
 return{range,roads,markers,state,revision:networkRevision()};
}
export function mapPoint(p,state,range,width,height){const scale=Math.min(width,height)/(2*range);return{x:width/2+(p.x-state.x)*scale,y:height/2+(p.z-state.z)*scale,scale};}
