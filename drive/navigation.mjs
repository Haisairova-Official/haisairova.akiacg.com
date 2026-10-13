import{nextRoadExit}from'./road-guidance.mjs?rev=world21d';
import {townExitNavigation}from './town-roads.mjs?rev=world21d';
import {physicalLocalById,localComponentById,MOTORWAYS,CONNECTORS,JUNCTIONS,MOTORWAY_NAMES,roadFamily,roadPoint,mainPoint,projectMain,mainArcDistance,aheadJunction,NETWORK_CENTRE,ARCHIVE_ACCESS} from './road-network.mjs?rev=world21d';
import {projectPath,INTERCHANGE_NAMES} from './interchange-logic.mjs?rev=world21d';
import {monitorAt} from './monitor.mjs?rev=world21d';
export const pathDestination=p=>p.service?p.serviceName:p.city?(p.local?`${p.destinationName||'街区'} · ${INTERCHANGE_NAMES[p.id.split(':')[2]]||'市镇出口'}`:'存档街区'):MOTORWAY_NAMES[roadFamily(p.to)];
export function nextMainTargets(id,s){
 const target=nextRoadExit(id,s),exit=target?{id:target.id,name:target.kind==='town'?target.routeName:`${target.name} → ${target.routeName}`,distance:mainArcDistance(id,s,target.referenceS),point:target.point,roadId:id,kind:target.kind}:null;
 let index=Math.floor((s+NETWORK_CENTRE.x-500)/1440);while(monitorAt(index).x<=s+NETWORK_CENTRE.x+.1||(id==='A+'&&monitorAt(index).x<600))index++;
 const station=monitorAt(index).x-NETWORK_CENTRE.x,camera={id:`${id}:${index}`,name:'下一摄像头',distance:mainArcDistance(id,s,station),point:mainPoint(id,station),roadId:id,kind:'camera'};
 return{exit,camera};
}
export function routeNavigation({state,mode,route,town={x:0,z:0,y:0,angle:0,index:null},localRoute=null}){
 const physical=route?.id&&physicalLocalById(route.id);if(physical){const graph=localComponentById(physical.componentId),projection=projectPath(physical,state.x,state.z,state.roadY||0),forward=Math.cos(state.heading-projection.heading)>=0,target=graph.ports[forward?1:0],lane=graph.laneEdges[forward?0:1],q=projectPath(lane,state.x,state.z,state.roadY||0);return{exit:{id:target.region.destinationId,name:target.region.name+' · 地方路入口',distance:Math.max(0,lane.length-q.s),point:target.point,roadId:physical.id,kind:'town'},camera:null,cameraEmpty:'地方公路无摄像头',instruction:'沿地方公路 → '+target.region.name,localRoadType:physical.points.reduce((a,p)=>Math.abs(p.s-projection.s)<Math.abs(a.s-projection.s)?p:a,physical.points[0]).roadType};}
 if(route?.network&&MOTORWAYS.includes(route.id)){const p=projectMain(route.id,state.x,state.z,state.roadY||0);return{...nextMainTargets(route.id,p.s),instruction:'沿当前高速继续行驶'};}
 let path=route?.network?CONNECTORS.find(p=>p.id===route.id):localRoute;
 if(mode==='city')path=town.index===null?ARCHIVE_ACCESS:localRoute||CONNECTORS.find(p=>p.local&&p.junctionId===`town:${town.index}`);
 if(path){
  let station=route?.id===path.id?route.s:projectPath(path,state.x,state.z,state.roadY||0).s;
  if(mode==='city')station=Math.max(path.townEntryS??0,Math.min(path.townExitS??path.length,station));
  if(path.service&&projectPath(path,state.x,state.z,state.roadY||0).lane>5.5)return{exit:null,camera:null,exitEmpty:(path.exitLabel||'出口 → 高速').replace('出口','停车区'),cameraEmpty:'驶回服务区行车道后显示',instruction:'沿停车场出口箭头驶回行车道 · 距离未计入无固定路线的车位'};
  const destination=pathDestination(path),intoTown=path.city&&station<(path.townEntryS??0)-.1;
  if(path.service&&station<path.serviceEntryS)return{exit:{id:path.id,name:path.serviceName,distance:Math.max(0,path.serviceEntryS-station),point:roadPoint(path.id,path.serviceEntryS),kind:'service',roadId:path.id},camera:null,cameraEmpty:'服务区连接路无摄像头',instruction:'减速驶入'+path.serviceName};
  if(intoTown)return{exit:{id:path.id,name:destination,distance:Math.max(0,path.townEntryS-station),point:roadPoint(path.id,path.townEntryS),kind:'town',roadId:path.id},camera:null,cameraEmpty:'本匝道至街区无摄像头',instruction:'沿连接路进入'+(path.destinationName||'存档街区')};
  const townGuide=mode==='city'?townExitNavigation(state,town):null;if(townGuide?.offRoad)return{exit:null,camera:null,exitEmpty:'先返回街区道路',cameraEmpty:'回到道路后显示沿路距离',instruction:'当前位置偏离街道 · 避开建筑与路缘'};const downstream=nextMainTargets(path.to,path.joinS),remaining=Math.max(0,path.length-(townGuide?path.townExitS:station))+(townGuide?.distance||0);
  for(const key of ['exit','camera'])if(downstream[key])downstream[key]={...downstream[key],distance:downstream[key].distance+remaining,via:destination};
  const joining=MOTORWAY_NAMES[roadFamily(path.to)];return{...downstream,instruction:mode==='city'?`沿街区道路 → ${joining}`:path.service?`沿服务区出口 → ${joining}`:`沿匝道汇入 → ${joining}`,joinDistance:remaining,joinRoad:path.to,townPath:townGuide?.points};
 }
 return{exit:null,camera:null,exitEmpty:'暂无前方出口',cameraEmpty:'当前道路无摄像头',instruction:mode==='city'?'沿街区道路驶向高速入口':'沿道路继续行驶'};
}
export function navigationStats(nav){return{nextExitName:nav.exit?.name||nav.exitEmpty||'暂无前方出口',nextExitDistance:nav.exit?Math.max(0,nav.exit.distance).toFixed(0):'',nextCameraName:nav.camera?'下一摄像头':nav.cameraEmpty||'当前道路无摄像头',nextCameraDistance:nav.camera?Math.max(0,nav.camera.distance).toFixed(0):'',navigationInstruction:nav.instruction||'',navigationJoinDistance:nav.joinDistance===undefined?'':Math.max(0,nav.joinDistance).toFixed(0)};}
