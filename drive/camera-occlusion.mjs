// Local view-corridor fading, independent of all rigid-body/collision data.
// Shared/instanced meshes receive a private material and a world-space mask:
// only the fragments between the camera and the car/near road become translucent.
export function corridorOpacity(point,start,end,{radius=2.1,floor=0,strength=1,minimum=.18}={}){
 const dx=end.x-start.x,dy=end.y-start.y,dz=end.z-start.z,l=dx*dx+dy*dy+dz*dz,t=((point.x-start.x)*dx+(point.y-start.y)*dy+(point.z-start.z)*dz)/(l||1);
 if(t<0||t>.985||point.y<floor+.35)return 1;const d=Math.hypot(point.x-start.x-dx*t,point.y-start.y-dy*t,point.z-start.z-dz*t),u=Math.max(0,Math.min(1,(d-radius*.65)/(radius*.35))),smooth=u*u*(3-2*u);return 1-(1-minimum)*strength*(1-smooth);
}
export function createCameraOcclusion(T,scene,{excluded=()=>[],protectedRoads=()=>[],interval=.14,maxActive=18}={}){
 const entries=new Map(),ray=new T.Ray(),delta=new T.Vector3(),hit=new T.Vector3(),box=new T.Box3();let clock=0,scanAt=-Infinity,inventoryAt=-Infinity,inventory=[],instanceVersions=new WeakMap(),geometryVersions=new WeakMap(),excludedNow=new Set(),protectedNow=new Set();
 const roadRoles=new Set(['pavement','marking','road','road-deck','road-edge']);
 const roadOwner=m=>{for(let p=m;p;p=p.parent)if(p.userData.cameraRoadId)return p.userData.cameraRoadId;return null;};
 const protectionBox=new T.Box3();
 const sameRoadLevel=m=>{if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();protectionBox.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);const slope=shared.slope.value;let high=-Infinity;for(const x of[protectionBox.min.x,protectionBox.max.x])for(const z of[protectionBox.min.z,protectionBox.max.z])high=Math.max(high,protectionBox.max.y-shared.floor.value-((x-shared.car.value.x)*slope.x+(z-shared.car.value.z)*slope.y)*slope.z);return high<=2.4;};
 const protectedMesh=m=>roadRoles.has(m.userData.cameraOccluderRole)&&protectedNow.has(roadOwner(m))&&sameRoadLevel(m);
 const shared={start:{value:new T.Vector3()},car:{value:new T.Vector3()},road:{value:new T.Vector3()},floor:{value:0},slope:{value:new T.Vector3()},radius:{value:2.1}};
 const visible=m=>{for(let p=m;p;p=p.parent){if(!p.visible)return false;if(p===scene)return true;}return false;};
 const blocked=m=>{for(let p=m;p;p=p.parent)if(excludedNow.has(p))return true;return false;};
 function restore(m,e){if(m.material===e.material)m.material=e.original;delete m.userData.cameraFadeOriginalMaterial;e.material.dispose();entries.delete(m);}
 function materialFor(m){const original=m.material,material=original.clone(),strength={value:0};material.transparent=true;// A tree batch includes opaque crowns far outside the local fade corridor.
  // Keep their depth occlusion: transparent render lists do not sort individual
  // instances or triangles. Opaque road/vehicle colour remains visible through
  // the nearby alpha mask; rear transparent tree layers may be depth-rejected.
  material.depthWrite=roadRoles.has(m.userData.cameraOccluderRole)||m.userData.cameraOccluderRole==='tree';material.forceSinglePass=true;material.opacity=original.opacity;const before=original.onBeforeCompile;
  material.onBeforeCompile=shader=>{before?.call(material,shader);Object.assign(shader.uniforms,{viewFadeStart:shared.start,viewFadeCar:shared.car,viewFadeRoad:shared.road,viewFadeFloor:shared.floor,viewFadeSlope:shared.slope,viewFadeRadius:shared.radius,viewFadeStrength:strength,viewFadeMinimumHeight:{value:roadRoles.has(m.userData.cameraOccluderRole)?2.4:.35}});shader.vertexShader='varying vec3 viewFadeWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
vec4 viewFadePosition=vec4(transformed,1.0);
#ifdef USE_BATCHING
viewFadePosition=batchingMatrix*viewFadePosition;
#endif
#ifdef USE_INSTANCING
viewFadePosition=instanceMatrix*viewFadePosition;
#endif
viewFadeWorld=(modelMatrix*viewFadePosition).xyz;`);
   shader.fragmentShader=`varying vec3 viewFadeWorld;
uniform vec3 viewFadeStart,viewFadeCar,viewFadeRoad,viewFadeSlope;
uniform float viewFadeFloor,viewFadeRadius,viewFadeStrength,viewFadeMinimumHeight;
float viewFadeMask(vec3 endPoint){vec3 span=endPoint-viewFadeStart;float t=dot(viewFadeWorld-viewFadeStart,span)/max(dot(span,span),.001);if(t<0.0||t>.985)return 0.0;float d=length(viewFadeWorld-viewFadeStart-span*t);return 1.0-smoothstep(viewFadeRadius*.65,viewFadeRadius,d);}
`+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`if(viewFadeWorld.y>viewFadeFloor+dot(viewFadeWorld.xz-viewFadeCar.xz,viewFadeSlope.xy)*viewFadeSlope.z+viewFadeMinimumHeight){float mask=max(viewFadeMask(viewFadeCar),viewFadeMask(viewFadeRoad));diffuseColor.a*=1.0-.82*viewFadeStrength*mask;}
#include <opaque_fragment>`);};
  material.customProgramCacheKey=()=>original.customProgramCacheKey()+'|local-view-fade-v2-road-protection';m.userData.cameraFadeOriginalMaterial=original;m.material=material;const e={original,material,geometry:m.geometry,strength,target:1,lastSeen:clock};entries.set(m,e);return e;
 }
 function rebuild(){inventory=[];const visit=m=>{if(!m.visible||m.userData.collisionOnly||blocked(m))return;for(const c of m.children)visit(c);if(!m.isMesh||!m.geometry?.attributes.position||Array.isArray(m.material)||m.userData.collisionOnly||m.userData.terrainTile||!m.userData.cameraOccluderRole||m.userData.cameraOcclusion===false||blocked(m))return;const mat=entries.get(m)?.original||m.material;if(!mat||(mat.vertexColors&&!m.userData.scenicBuilding)||mat.opacity<.95||mat.transparent)return;inventory.push(m);};visit(scene);inventoryAt=clock;}
 function scan(){if(clock-inventoryAt>.8)rebuild();const candidates=[];for(const m of inventory){if(!visible(m)||blocked(m))continue;const role=m.userData.cameraOccluderRole,owner=roadOwner(m);if(protectedMesh(m))continue;const attribute=m.geometry.attributes.position;if(geometryVersions.get(m.geometry)!==attribute.version){if(!m.geometry.boundingBox||attribute.version>0)m.geometry.computeBoundingBox();geometryVersions.set(m.geometry,attribute.version);}if(m.isInstancedMesh){if(instanceVersions.get(m)!==m.instanceMatrix.version){m.computeBoundingBox();instanceVersions.set(m,m.instanceMatrix.version);}box.copy(m.boundingBox);}else box.copy(m.geometry.boundingBox);box.applyMatrix4(m.matrixWorld);if(box.max.y<shared.floor.value+.5)continue;if(roadRoles.has(role)){const slope=shared.slope.value;let high=-Infinity;for(const x of[box.min.x,box.max.x])for(const z of[box.min.z,box.max.z])high=Math.max(high,box.max.y-shared.floor.value-((x-shared.car.value.x)*slope.x+(z-shared.car.value.z)*slope.y)*slope.z);if(high<=2.4)continue;}box.expandByScalar(shared.radius.value);let distance=Infinity;for(const end of [shared.car.value,shared.road.value]){delta.subVectors(end,shared.start.value);const length=delta.length();ray.set(shared.start.value,delta.multiplyScalar(1/(length||1)));if(box.containsPoint(shared.start.value)||ray.intersectBox(box,hit)){const d=box.containsPoint(shared.start.value)?0:hit.distanceTo(shared.start.value);if(d<length)distance=Math.min(distance,d);}}if(Number.isFinite(distance))candidates.push({m,distance});}
  candidates.sort((a,b)=>a.distance-b.distance);const selected=new Set(candidates.slice(0,maxActive).map(c=>c.m));for(const[m,e]of entries){e.target=selected.has(m)?1:0;if(e.target)e.lastSeen=clock;}
  for(const m of selected)if(!entries.has(m)){if(entries.size>=maxActive){const retiring=[...entries].filter(([o])=>!selected.has(o)).sort((a,b)=>a[1].strength.value-b[1].strength.value)[0];if(retiring)restore(...retiring);else continue;}materialFor(m);}scanAt=clock;
 }
 return{update(camera,state,dt=1/60){clock+=Math.min(.1,Math.max(0,dt));excludedNow=new Set(excluded());protectedNow=new Set(protectedRoads());shared.start.value.copy(camera.position);const y=state.roadY||0,dx=Math.sin(state.heading),dz=Math.cos(state.heading);shared.floor.value=y;shared.slope.value.set(dx,dz,state.roadGrade||0);shared.radius.value=state.vehicle==='dayun'?2.7:2.1;shared.car.value.set(state.x,y+1.05,state.z);shared.road.value.set(state.x+dx*11,y+.6+(state.roadGrade||0)*11,state.z+dz*11);if(clock-scanAt>=interval)scan();for(const[m,e]of entries){if(!visible(m)||blocked(m)||protectedMesh(m)||m.geometry!==e.geometry){restore(m,e);continue;}e.strength.value+=(e.target-e.strength.value)*(1-Math.exp(-Math.min(dt,.1)*10));if(!e.target&&e.strength.value<.015)restore(m,e);}},reset(){for(const[m,e]of entries)restore(m,e);inventory=[];inventoryAt=scanAt=-Infinity;},get stats(){return{active:entries.size,candidates:inventory.length};}};
}
