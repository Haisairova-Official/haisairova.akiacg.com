import{createShowroomState}from'./showroom-state.mjs?rev=world21d';
import{createShowroomModel,showroomFacts,SHOWROOM_CARS}from'./showroom-model.js?rev=world21d';
import{setVehiclePaint,paintMaterials,disposePreview}from'./vehicle-paint.js?rev=world21d';
import{setFleetVisualMode}from'./fleet-models.js?rev=world21d';
export function createShowroom(T,{dialog,renderer,getDrivingKind,getDriveMode,onOpen=()=>{},onClose=()=>{},onApply=()=>{},modelFactory=createShowroomModel}){
 const find=id=>dialog.querySelector('#'+id),store=createShowroomState(),view=find('showroom-view'),select=find('showroom-car'),color=find('showroom-color'),status=find('showroom-status'),apply=find('showroom-apply'),facts=find('showroom-facts'),mode=find('showroom-mode');
 const scene=new T.Scene();scene.background=new T.Color(0xd9e4e6);scene.add(new T.HemisphereLight(0xffffff,0x809180,3));const sun=new T.DirectionalLight(0xfff4df,3.2);sun.position.set(-6,10,8);scene.add(sun);
 const plinth=new T.Mesh(new T.CylinderGeometry(1,1,.07,48),new T.MeshStandardMaterial({color:0xb9cac5,roughness:.8}));plinth.position.y=-.035;scene.add(plinth);
 const camera=new T.PerspectiveCamera(36,1,.05,150),viewport=new T.Vector4(),scissor=new T.Vector4();let model=null,yaw=.63,pitch=.22,zoom=1,modeValue='tracks';const pointers=new Map();let pointerDistance=0,retryKind=null;
 for(const c of SHOWROOM_CARS){const option=document.createElement('option');option.value=c.id;option.textContent=c.label;select.append(option);}
 function releasePointers(){for(const id of pointers.keys())try{view.releasePointerCapture(id);}catch{}pointers.clear();pointerDistance=0;}
 function controls(){const kind=model?.kind;apply.disabled=store.loading||!kind;apply.textContent=kind===getDrivingKind()?'应用到当前驾驶车辆':'保存此车型配色（不切车）';color.disabled=!kind||store.loading;mode.hidden=kind!=='bt7';}
 function describe(kind){facts.replaceChildren();for(const[label,value]of showroomFacts(kind).rows){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);facts.append(row);}const a=find('showroom-source');a.href=showroomFacts(kind).source;}
 async function choose(kind){
  const token=store.request(kind);retryKind=null;find('showroom-retry').hidden=true;status.textContent='正在准备独立观车模型…';controls();
  try{const next=await modelFactory(T,kind,{mode:modeValue,yieldFrame:()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)))});
   if(!store.complete(token)){disposePreview(next.root);return false;}
   if(model)disposePreview(model.root);model=next;plinth.scale.setScalar(Math.max(2,Math.hypot(model.size.x,model.size.z)*.60));plinth.scale.y=1;scene.add(model.root);setVehiclePaint(model.root,store.color(kind));yaw=.63;pitch=.22;zoom=1;
   color.value=store.color(kind)||'#'+(paintMaterials(model.root)[0]?.color.getHexString()||'b8bdbf');select.value=kind;describe(kind);status.textContent='拖动旋转 · 滚轮/双指缩放 · ↑↓←→微调';controls();return true;
  }catch(error){if(store.fail(token,error.message)){retryKind=kind;find('showroom-retry').hidden=false;status.textContent='模型准备失败，保留当前预览；请点重试。';if(model)select.value=model.kind;controls();}return false;}
 }
 function open(){if(store.opened)return;store.open();releasePointers();modeValue=getDriveMode?.()||'tracks';mode.value=modeValue;onOpen();dialog.showModal();select.value=getDrivingKind();select.focus();choose(select.value);}
 function close(){if(!store.opened)return;store.close();releasePointers();if(model)disposePreview(model.root);model=null;dialog.close();onClose();}
 find('showroom-retry').onclick=()=>{if(retryKind)choose(retryKind);};select.onchange=()=>choose(select.value);color.oninput=()=>{if(!model||store.loading)return;store.draft(model.kind,color.value);setVehiclePaint(model.root,color.value);};
 find('showroom-original').onclick=()=>{if(!model||store.loading)return;store.draft(model.kind,null);setVehiclePaint(model.root,null);color.value='#'+paintMaterials(model.root)[0].color.getHexString();};
 apply.onclick=()=>{if(!model||store.loading)return;const hex=store.apply(model.kind);onApply(model.kind,hex);status.textContent=model.kind===getDrivingKind()?'已应用车漆，停放车辆与位置保持不变':'已保存此车型配色；下次从驾驶设置选车时应用';};
 mode.onchange=()=>{modeValue=mode.value==='wheels'?'wheels':'tracks';if(model?.kind==='bt7')setFleetVisualMode(model.car,modeValue);};
 find('showroom-close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 const separation=()=>{const p=[...pointers.values()];return p.length===2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0;};
 view.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();view.focus();view.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pointerDistance=separation();});
 view.addEventListener('pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){yaw-=(e.clientX-old.x)*.008;pitch=Math.max(-.12,Math.min(1.1,pitch+(e.clientY-old.y)*.006));}else{const next=separation();if(pointerDistance>0&&next>0)zoom=Math.max(.55,Math.min(2.5,zoom*pointerDistance/next));pointerDistance=next;}});
 for(const type of['pointerup','pointercancel','lostpointercapture'])view.addEventListener(type,e=>{pointers.delete(e.pointerId);pointerDistance=separation();});
 view.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.55,Math.min(2.5,zoom*Math.exp(e.deltaY*.001)));},{passive:false});
 view.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Equal','Minus'].includes(e.code))return;e.preventDefault();if(e.code==='ArrowLeft')yaw+=.10;if(e.code==='ArrowRight')yaw-=.10;if(e.code==='ArrowUp')pitch=Math.min(1.1,pitch+.07);if(e.code==='ArrowDown')pitch=Math.max(-.12,pitch-.07);if(e.code==='Equal')zoom=Math.max(.55,zoom*.9);if(e.code==='Minus')zoom=Math.min(2.5,zoom*1.1);});
 window.addEventListener('blur',releasePointers);
 function render(){
  if(!store.opened)return;const r=view.getBoundingClientRect(),canvas=renderer.domElement.getBoundingClientRect();if(r.width<1||r.height<1)return;
  const aspect=r.width/r.height;camera.aspect=aspect;camera.updateProjectionMatrix();const size=model?.size||new T.Vector3(2,2,4),radius=Math.hypot(size.x,size.y,size.z)/2,limit=Math.min(camera.fov*Math.PI/360,Math.atan(Math.tan(camera.fov*Math.PI/360)*aspect)),distance=Math.max(3,radius/Math.sin(limit)*1.12)*zoom,targetY=size.y*.48;
  camera.position.set(Math.sin(yaw)*Math.cos(pitch)*distance,Math.max(.16,targetY+Math.sin(pitch)*distance),Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(0,targetY,0);
  renderer.getViewport(viewport);renderer.getScissor(scissor);const priorScissor=renderer.getScissorTest(),auto=renderer.autoClear;
  try{renderer.setViewport(r.left-canvas.left,canvas.bottom-r.bottom,r.width,r.height);renderer.setScissor(r.left-canvas.left,canvas.bottom-r.bottom,r.width,r.height);renderer.setScissorTest(true);renderer.autoClear=true;renderer.render(scene,camera);}finally{renderer.autoClear=auto;renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(priorScissor);}
 }
 return{get opened(){return store.opened;},open,close,render,applied:kind=>store.applied(kind),state:store};
}
