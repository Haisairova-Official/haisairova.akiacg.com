// Tino is a rigid-node animated glTF, not a SkinnedMesh. AnimationMixer binds
// each exported node directly. Keep materials and resource ownership local.
export function createTinoCharacter(T,{url=new URL('./assets/tino.glb?rev=world21k',import.meta.url).href,onStatus=()=>{}}={}){
 const root=new T.Group();root.name='TinoWalker';root.visible=false;
 const fallback=new T.Group(),coat=new T.MeshStandardMaterial({color:0x497980,roughness:.8}),skin=new T.MeshStandardMaterial({color:0xe0be9f,roughness:.8});
 for(const [geometry,material,y] of [[new T.CapsuleGeometry(.22,.48,4,8),coat,1],[new T.SphereGeometry(.19,10,8),skin,1.63]]){const m=new T.Mesh(geometry,material);m.position.y=y;fallback.add(m);}
 for(const side of[-1,1]){const m=new T.Mesh(new T.CylinderGeometry(.10,.09,.58,7),coat);m.position.set(side*.13,.30,0);fallback.add(m);}root.add(fallback);
 let mixer=null,active=null,transition=null,loadedModel=null,status='loading',disposed=false;
 const actions=new Map(),released=new WeakSet();
 function release(object){if(object&&!released.has(object)){released.add(object);object.dispose?.();}}
 function releaseTexture(texture){
  const data=texture.source?.data;for(const image of(Array.isArray(data)?data:[data]))if(image&&typeof image.close==='function'&&!released.has(image)){released.add(image);image.close();}
  release(texture);
 }
 function releaseScene(scene){scene?.traverse(node=>{release(node.geometry);for(const material of(Array.isArray(node.material)?node.material:[node.material]))if(material){for(const value of Object.values(material))if(value?.isTexture)releaseTexture(value);release(material);}});}
 function play(name){
  const next=actions.get(name)||actions.get('idle');if(!next||active===next)return;
  if(!active){next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();}
  else{
   // fadeIn/fadeOut restart at 0/1. Reversing an unfinished fade would jump
   // to the opposite pose. Preserve every current weight and contributing phase.
   const from=new Map([...actions.values()].map(action=>[action,action.getEffectiveWeight()]));
   if((from.get(next)||0)<=0)next.reset();
   next.setEffectiveTimeScale(1).play();
   for(const [action,weight] of from)action.stopFading().setEffectiveWeight(weight);
   transition={from,elapsed:0};
  }
  active=next;root.userData.animation=next.getClip().name;
 }
 function blend(dt){
  if(!transition)return;transition.elapsed+=dt;const t=Math.min(1,transition.elapsed/.16);
  for(const [action,weight] of transition.from)action.setEffectiveWeight(weight*(1-t)+(action===active?t:0));
  if(t>=1){for(const action of actions.values())if(action!==active)action.stop();transition=null;}
 }
 function stopMixer(){mixer?.stopAllAction();if(loadedModel)mixer?.uncacheRoot(loadedModel);mixer=null;active=null;transition=null;actions.clear();}
 const ready=import('./vendor/GLTFLoader.js').then(({GLTFLoader})=>new GLTFLoader().loadAsync(url)).then(gltf=>{
  if(disposed){releaseScene(gltf.scene);return null;}
  const model=loadedModel=gltf.scene,box=new T.Box3().setFromObject(model),height=box.max.y-box.min.y;
  if(!Number.isFinite(height)||height<=0)throw new Error('Tino model has invalid bounds');
  for(const name of ['idle','walk','run'])if(!gltf.animations.some(clip=>clip.name===name))throw new Error('Tino locomotion clips are missing');
  // Total height includes the hat/ribbon. Face points -Z in the converted pack;
  // the controller's forward vector is +Z. Ground using the bind-pose soles.
  const scale=1.85/height;model.scale.setScalar(scale);model.position.y=-box.min.y*scale;model.rotation.y=Math.PI;
  model.traverse(node=>{if(!node.isMesh)return;node.castShadow=true;node.receiveShadow=true;for(const m of(Array.isArray(node.material)?node.material:[node.material])){m.transparent=false;m.opacity=1;m.alphaTest=.45;m.depthWrite=true;m.depthTest=true;m.needsUpdate=true;if(m.map){m.map.magFilter=T.NearestFilter;m.map.minFilter=T.NearestMipmapLinearFilter;m.map.needsUpdate=true;}}});
  mixer=new T.AnimationMixer(model);
  for(const clip of gltf.animations){const action=mixer.clipAction(clip);action.setEffectiveWeight(0);if(clip.name==='blink'){
   // Source pre_parallel1 touches only eyebrow positions and eyelid scales.
   // Its independent four-second clock never restarts with locomotion changes.
   action.setEffectiveWeight(1).play();root.userData.blink=true;
  }else actions.set(clip.name,action);}
  root.add(model);fallback.visible=false;status='ready';root.userData.character='tino';root.userData.height=1.85;play('idle');onStatus(status);return gltf;
 }).catch(error=>{
  stopMixer();if(loadedModel){releaseScene(loadedModel);loadedModel.removeFromParent();loadedModel=null;}
  if(disposed)return null;
  fallback.visible=true;status='fallback';root.userData.loadError=String(error.message||error);onStatus(status);console.warn('Tino character unavailable; basic walker retained.',error);return null;
 });
 return{
  root,ready,get status(){return status;},get animation(){return root.userData.animation||'fallback';},
  get readyToSit(){return status==='loading'||status==='fallback'||status==='ready'&&active?.getClip().name==='idle'&&!transition&&active.getEffectiveWeight()>=1-1e-7;},
  update(visit,dt,blocked=false){
   if(disposed)return;if(!visit.walking){
    if(root.visible){for(const action of actions.values())action.stop().setEffectiveWeight(0);active=null;transition=null;play('idle');mixer?.update(0);root.userData.sitWeight=0;}
    root.visible=false;return;
   }root.visible=true;
   const p=visit.walker;root.position.set(p.x,p.y,p.z);root.rotation.y=p.heading;
   play(visit.standing?'idle':visit.resting?'sit':blocked?'idle':p.speed>.05?(p.speed>2.15?'run':'walk'):'idle');
   const step=Number.isFinite(dt)?Math.min(Math.max(dt,0),.1):0;blend(step);mixer?.update(step);
   // Keep the collision capsule in the aisle. Only the source pose's visual
   // root approaches the seat, using the same blend weight as its animation.
   const seat=visit.restPose,sitWeight=actions.get('sit')?.getEffectiveWeight()||0;root.userData.sitWeight=sitWeight;
   if(seat){root.position.x+=(seat.x-p.x)*sitWeight;root.position.y+=(seat.y-p.y)*sitWeight;root.position.z+=(seat.z-p.z)*sitWeight;root.rotation.y=seat.heading;}
   if(visit.standing&&sitWeight<=1e-7&&(!active||active.getClip().name==='idle'&&!transition))visit.finishStanding?.();
  },
  dispose(){if(disposed)return;disposed=true;status='disposed';root.visible=false;stopMixer();releaseScene(root);loadedModel=null;root.removeFromParent();root.clear();}
 };
}
