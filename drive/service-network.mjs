import {annotate,projectPath} from './interchange-logic.mjs?rev=world21d';
// Direction-specific, physically separated service branches. No carriageway crossover.
// Metres and speeds below are game design values, not engineering certification.
export const SERVICE_AREA_ID='service:jiangwan-south:B+>B+';
export const SERVICE_AREA_NAME='江湾服务区';
export const SERVICE_PAIR_SPECS=Object.freeze([
 Object.freeze({id:SERVICE_AREA_ID,groupId:'service:jiangwan',roadId:'B+',centreStation:2930,destinationId:'destination:jiangwan-service-south',directionLabel:'南行'}),
 Object.freeze({id:'service:jiangwan-north:B->B-',groupId:'service:jiangwan',roadId:'B-',centreStation:-2930,destinationId:'destination:jiangwan-service-north',directionLabel:'北行'})
]);
export const SERVICE_SHOWROOM=Object.freeze({lane:27.5,along:-77,width:17,length:36,roofY:5.1,terminalLane:34,terminalAlong:-77,targetLane:32.6,displayLane:32.6,displayAlong:-88.2});
export const SERVICE_FUEL_PUMPS=Object.freeze([-37,-23].map((along,index)=>Object.freeze({id:'pump-'+index,lane:21,along})));

export function buildServiceArea({mainPoint,outerLane,smooth},spec=SERVICE_PAIR_SPECS[0]){
 const {roadId,centreStation}=spec,station=d=>centreStation+d,startS=station(-830),joinS=station(970),entryEnd=station(-130),exitStart=station(130),taperOut=station(-650),departure=station(-430),flatten=station(-410),acceleration=station(430),taperIn=station(790);
 const directionLabel=spec.directionLabel,serviceName=SERVICE_AREA_NAME+' · '+directionLabel,showroomName='江湾观车棚 · '+directionLabel,restName='江湾休息站 · '+directionLabel;
 const lane=outerLane(roadId),aux=lane+3.75,far=70,level=mainPoint(roadId,(entryEnd+exitStart)/2).y;
 const offsetAt=s=>s<taperOut?lane+3.75*smooth((s-startS)/180):s<departure?aux:s<entryEnd?aux+(far-aux)*smooth((s-departure)/300):s<=exitStart?far:s<acceleration?far+(aux-far)*smooth((s-exitStart)/300):s<taperIn?aux:aux-3.75*smooth((s-taperIn)/180);
 const raw=[];for(let s=startS;s<=joinS;s+=3){const offset=offsetAt(s),q=mainPoint(roadId,s,offset),blend=s<entryEnd?smooth((s-flatten)/280):s<=exitStart?1:1-smooth((s-exitStart)/280);raw.push([q.x,q.z,q.y+(level-q.y)*blend]);}
 const points=annotate(raw),at=s=>points[Math.round((s-startS)/3)].s;
 // Arc stations are measured on this path, never mistaken for mainline stations.
 const sampleAt=s=>{const q=mainPoint(roadId,s,offsetAt(s));return projectPath({points},q.x,q.z,level).s;};
 for(let i=0;i<points.length;i++){const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];points[i].heading=Math.atan2(b.x-a.x,b.z-a.z);}
 const serviceEntryS=sampleAt(entryEnd),serviceExitS=sampleAt(exitStart),centre=mainPoint(roadId,(entryEnd+exitStart)/2,far);
 const path={id:spec.id,junctionId:spec.id,groupId:spec.groupId,geometryKey:'paired-service-v1:'+roadId,from:roadId,to:roadId,turn:'right',service:true,serviceName,serviceSignName:'江湾',directionLabel,showroomName,restName,exitLabel:'出口 → 江湾高速'+directionLabel,services:['parking','fuel'],destinationId:spec.destinationId,destinationName:serviceName,roadType:'service-access',width:8,offset:1.5,laneWidth:3.5,
  startS,joinS,points,length:points.at(-1).s,rampSpeed:40/3.6,serviceSpeed:20/3.6,serviceEntryS,serviceExitS,
  decelerationStartS:at(taperOut),decelerationEndS:sampleAt(departure),departLength:sampleAt(departure),departureEndS:departure,
  accelerationStartS:sampleAt(acceleration),mergeTaperStartS:at(taperIn),mergeStartS:acceleration,
  auxiliary:[{roadId,startS,endS:departure},{roadId,startS:acceleration,endS:joinS}],
  goreRanges:{departure:{start:sampleAt(departure),end:sampleAt(station(-250))},arrival:{start:sampleAt(station(230)),end:sampleAt(acceleration)}},
  noBarrier:[{side:1,startS:serviceEntryS+20,endS:serviceExitS-20}],
  centre:{...centre,y:level},servicePad:{x:centre.x,z:centre.z,y:level,heading:centre.heading,halfLength:145,inner:-3,outer:62},
  bounds:{minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))}};
 path.apron={inner:5.5,outer:37,points:points.filter(p=>p.s>serviceEntryS+20&&p.s<serviceExitS-20)};
 for(const along of[-145,145])for(const lane of[-3,62]){const x=centre.x-Math.cos(centre.heading)*lane+Math.sin(centre.heading)*along,z=centre.z+Math.sin(centre.heading)*lane+Math.cos(centre.heading)*along;path.bounds.minX=Math.min(path.bounds.minX,x);path.bounds.maxX=Math.max(path.bounds.maxX,x);path.bounds.minZ=Math.min(path.bounds.minZ,z);path.bounds.maxZ=Math.max(path.bounds.maxZ,z);}
 return path;
}
export function buildServicePair(api){return SERVICE_PAIR_SPECS.map(spec=>buildServiceArea(api,spec));}
export function servicePadProjection(path,x,z){const p=path.servicePad;if(!p)return null;const dx=x-p.x,dz=z-p.z,along=dx*Math.sin(p.heading)+dz*Math.cos(p.heading),lane=-dx*Math.cos(p.heading)+dz*Math.sin(p.heading);return{along,lane,distance:Math.hypot(Math.max(0,Math.abs(along)-p.halfLength),Math.max(p.inner-lane,0,lane-p.outer)),y:p.y};}

export function serviceApronContains(path,x,z,y=path.centre.y){if(!path.apron||Math.abs(y-path.centre.y)>1.8)return false;const p=projectPath(path,x,z,y),a=path.apron;return p.s>a.points[0].s+.01&&p.s<a.points.at(-1).s-.01&&p.lane>=a.inner&&p.lane<=a.outer;}
export function serviceApronMap(path){const a=path.apron;return{id:path.id+':parking',sourceId:path.id,kind:'service',geometryKey:path.geometryKey,width:a.outer-a.inner,points:a.points.map((p,i)=>{const before=a.points[Math.max(0,i-1)],after=a.points[Math.min(a.points.length-1,i+1)],h=p.heading??Math.atan2(after.x-before.x,after.z-before.z),offset=(a.inner+a.outer)/2;return{x:p.x-Math.cos(h)*offset,z:p.z+Math.sin(h)*offset,y:p.y};})};}

export function servicePlaceMarkers(path){const p=path.centre,sh=SERVICE_SHOWROOM;return[{id:path.destinationId,kind:'service',name:path.serviceName,point:{...p}},{id:path.destinationId+':showroom',kind:'place',name:path.showroomName||'江湾观车棚',point:{x:p.x-Math.cos(p.heading)*sh.lane+Math.sin(p.heading)*sh.along,y:p.y+.22,z:p.z+Math.sin(p.heading)*sh.lane+Math.cos(p.heading)*sh.along}}];}
