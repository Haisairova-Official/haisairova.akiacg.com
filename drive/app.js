import {createVirtualJoystick,bindHoldButtons,composeTouchInput,canChangeTouchDirection} from './touch-driving.mjs?rev=world21e';
import {configureVehiclePowertrain,syncTransmissionChoices,chooseElectricRange} from './vehicle-controls.mjs?rev=world21d';
import{setVehiclePaint,disposePreview}from'./vehicle-paint.js?rev=world21d';
import {createDestinationVisit,PARKED_INPUT} from './destination-visit.mjs?rev=world21e';
import {regionForIndex,regionById,CRABBAY_INDEX} from './regions.mjs?rev=world21d';
import {createTankDirectionAssist,createTankView} from './bt7-controls.mjs?rev=world21e';
import {createTurretFollower} from './bt7-model.js?rev=world21d';
import {createTankLookInput} from './tank-look-input.js?rev=world21d';
import {createCameraOcclusion} from './camera-occlusion.mjs?rev=world21g';
import {loadingStage,finishLoading,nextLoadingPaint} from './loading.js?rev=world21d';
import {FLEET,fleetSpec} from './fleet-specs.mjs?rev=world21d';
import {createFleetVehicle,setFleetVisualMode} from './fleet-models.js?rev=world21d';
import {fitsVehicle,releaseRigid} from './rigid-vehicle.mjs?rev=world21d';
import {switchDriveMode} from './physics.mjs?rev=world21d';
import {createWorldMap} from './world-map.js?rev=world21d';
import {createMinimap} from './minimap.js?rev=world21d';
import {GEARBOXES,gearboxSpec} from './gearbox-specs.mjs?rev=world21d';
import { stops, tokenPositions } from './content.js?rev=world21d';
import { createCarState, resetCar, respawnCar, stopCar } from './physics.mjs?rev=world21d';
import { createCHR,prepareCHR,isCHRReady } from './chr-model.js?rev=world21d';
import { createYaris, applyYarisBounce, YARIS_PLAY_SPEED } from './yaris-model.js?rev=world21d';
import { getYarisActivity } from './yaris-activity.mjs?rev=world21d';
import { createYarisAudio } from './yaris-audio.js?rev=world21d';
import { userTrack } from './audio-source.js?rev=world21d';

let createHighway,createTownScene,createRegionScenes,regionScenes;
import { readSceneRoute, syncSceneRoute } from './scene-router.mjs?rev=world21d';
const initialScene=readSceneRoute(location.pathname),initialRegion=initialScene==='town'?regionById(new URLSearchParams(location.search).get('region')):null;
import {createRecoveryHold} from './recovery-input.mjs?rev=world21d';
const recoveryHold=createRecoveryHold(2);let recoveryInMenu=false;
const cancelRecovery=()=>{recoveryHold.cancel();recoveryInMenu=false;for(const id of['recovery-countdown','mobile-recovery-status']){const el=document.getElementById(id);if(el)el.hidden=true;}};

import {powertrainSpec} from './powertrain-specs.mjs?rev=world21d';
import {shiftGear,ignite} from './transmission.mjs?rev=world21d';
import {createSignals,toggleSignal,resetSignals,stepSignals} from './signals.mjs?rev=world21d';
import {addTurnLights,applyTurnLights} from './vehicle-effects.js?rev=world21d';
import {captureGroundHull,rolloverGroundY} from './vehicle-grounding.js?rev=world21d';
import {createInputGuard,createShiftBuffer,createInputSources,DRIVING_KEYS,drivingCode} from './driving-input.mjs?rev=world21d';

const $ = id => document.getElementById(id);
const routeMap=createMinimap($('minimap'));
const inputSources=createInputSources(),keys=inputSources.keys,heldPointers=inputSources.pointers,inputGuard=createInputGuard(),shiftBuffer=createShiftBuffer();
const state = createCarState(),signal=createSignals();const visit=createDestinationVisit(state,{onMessage:text=>toast(text)});let walkerModel;let signalOn=false;
const panel = $('panel'),pauseMenu=$('pause-menu');
let showroom=null,touchStick=null,holdButtons=null,touchDirection=1;
let paused=false,modelLoading=false,steeringMode='keys',mouseSteer=0,mouseAnchorX=innerWidth/2,lastMouseX=innerWidth/2;
let nearest = null, started = false, toastTimer, renderer, scene, camera, vehicle;
let lastTime = 0, accumulator = 0, elapsed = 0, uiTime = 0, frameAverage=1/60, performanceWindow=0, renderScale=1;
let cameraOcclusion,highway,highwayStats={},sunLight,cameraTrackX=state.x,sceneObjects=0;const cameraAim={x:0,y:1,z:0};let cameraHeading=0,townRoot,townSerial=0,townPose={x:0,z:0,y:0,angle:0,index:null};
const localTown=s=>{const dx=s.x-townPose.x,dz=s.z-townPose.z,c=Math.cos(townPose.angle),a=Math.sin(townPose.angle);return{x:dx*c-dz*a,z:dx*a+dz*c,heading:s.heading-townPose.angle};};
let bounceClock=0,activeCar='yaris',yarisMode='stopped',tankLook;const tankAssist=createTankDirectionAssist(),tankView=createTankView();let followTankTurret;
const music=createYarisAudio(s=>{
  Object.assign(document.body.dataset,{audioLoaded:String(s.loaded),audioPlaying:String(s.playing),audioBlocked:String(s.blocked)});
  const status=$('audio-status');if(status)status.textContent=s.failed?'音乐读取失败。可点击重试保留进度，或选择浏览器支持的音频。':s.reloading?'正在重新读取音乐，将从暂停处继续。':s.interrupted?'音乐播放被中断，请重新操作驾驶或点击启用。':s.blocked?'浏览器阻止播放，请点击启用，再驾驶。':s.loaded?`已载入本地文件：${s.name}。${s.playing?'正在联动播放。':'等待驾驶或按住空格。'}`:'本包未带曲目。可加载你有权使用的《Why’s This Dealer》音频。';
}, userTrack);
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
const bounceMotionEnabled=()=>globalThis.driveMotionPreference?.enabled!==false;
globalThis.driveMotionPreference?.subscribe(enabled=>{
  if(!enabled){
    yarisMode='stopped';bounceClock=0;music.stop();if(vehicle)syncVehicle();
    // Neutralize only visual bounce even while a menu freezes the simulation.
    // Do not call highway.animate here: it also pumps road generation.
    for(const t of highway?.traffic||[]){
      t.visual.scale.set(1,1,1);t.visual.position.y=0;t.sprung.position.y=0;t.sprung.rotation.x=0;
      if(t.trailerVisual){t.trailerVisual.scale.set(1,1,1);t.trailerVisual.position.y=0;}
    }
  }
});
const vehicles=new Map();
const boxes = [], tokens = [], wheels = [], fish = [];
const clearInput = () => {
  cancelRecovery();shiftBuffer.clear();tankAssist.reset();tankLook?.suspend();
  inputGuard.block();
  touchStick?.reset();holdButtons?.reset();inputSources.clear();mouseSteer=0; stopCar(state);resetSignals(signal);signalOn=false;
  yarisMode='stopped';bounceClock=0;music.stop();
  if(vehicle){syncVehicle();}
  document.querySelectorAll('.pressed').forEach(b => b.classList.remove('pressed'));
  if (vehicle) updateUI();
};
function releaseDrivingControls(){tankAssist.reset();tankLook?.suspend();shiftBuffer.clear();touchStick?.reset();holdButtons?.reset();inputSources.clear();mouseSteer=0;document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));}
function pauseDriving(){
 cancelRecovery();if(paused)return;inputGuard.block();paused=true;releaseDrivingControls();music.stop();if(document.pointerLockElement)document.exitPointerLock();
 if(panel.open)panel.close();document.body.classList.add('paused');pauseMenu.showModal();$('resume-button').focus();updateUI();
}
function resumeDriving(){
 if(!paused)return;cancelRecovery();releaseDrivingControls();lastTime=0;accumulator=0;paused=false;pauseMenu.close();document.body.classList.remove('paused');music.gesture();renderer?.domElement.focus({preventScroll:true});updateUI();
}
const mapContext=()=>({...(highway?.mapContext?.(state)||{mode:'city',town:townPose}),...(visit.walking?{parkedVehicle:{x:state.x,z:state.z,y:state.roadY},range:110}:{})});
const activePose=()=>visit.walking?{...visit.walker,roadY:visit.walker.y,vehicle:'walker'}:state;
const worldMap=createWorldMap({dialog:$('world-map'),canvas:$('world-map-canvas'),getState:activePose,getContext:mapContext,
 onOpen(){showroom?.close();cancelRecovery();inputGuard.block();releaseDrivingControls();music.stop();if(document.pointerLockElement)document.exitPointerLock();document.body.classList.add('map-open');updateUI();},
 onClose(){inputGuard.block();releaseDrivingControls();lastTime=0;accumulator=0;document.body.classList.remove('map-open');if(paused)$('resume-button').focus();else if(!panel.open)renderer?.domElement.focus({preventScroll:true});updateUI();}
});
const simulationPaused=()=>paused||worldMap.opened||modelLoading||!!showroom?.opened;
$('minimap').onclick=()=>worldMap.open();
$('minimap').addEventListener('keydown',e=>{if(['Enter','Space'].includes(e.code)){e.preventDefault();e.stopPropagation();if(!e.repeat)worldMap.open();}});
$('pause-map').onclick=()=>worldMap.open();
function centerMouse(){if(visit.walking){visit.centre();toast('步行视角已回中');return;}if(activeCar==='bt7'){tankView.centre(state.heading);toast('环视回中 · 观察方向对准车头');return;}mouseAnchorX=lastMouseX;mouseSteer=0;toast('鼠标已回中 · 当前位置为新的转向中点');}
$('resume-button').onclick=resumeDriving;$('pause-reset').onclick=()=>{resumeDriving();reset();};
pauseMenu.addEventListener('cancel',e=>{e.preventDefault();resumeDriving();});
$('steering-select').onchange=e=>{if(visit.walking)return;steeringMode=e.target.value==='mouse'?'mouse':'keys';mouseSteer=0;mouseAnchorX=innerWidth/2;lastMouseX=mouseAnchorX;toast(steeringMode==='mouse'?'鼠标位置转向：左右移动，C 回中；A/D 仍可转向。':'已切回键盘 / 触屏转向。');renderer?.domElement.focus({preventScroll:true});updateUI();};
$('mouse-center').onclick=()=>{centerMouse();renderer?.domElement.focus({preventScroll:true});};
function toast(text) {
  $('toast').textContent = text; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 3500);
}
function start() {
  if(document.body.dataset.ready!=='true')return;
  started = true; document.body.classList.add('started'); $('welcome').hidden = true;
  renderer?.domElement.focus({preventScroll:true});
}
function showPanel(title, tag, contents) {
  cancelRecovery();if(visit.walking){inputGuard.block();releaseDrivingControls();music.stop();}else clearInput(); $('panel-title').textContent = title; $('panel-tag').textContent = tag;
  $('panel-body').replaceChildren(...contents); document.body.classList.add('panel-open');
  if (!panel.open) panel.showModal();
  $('close-panel').focus();
}
function node(tag, text, cls) {
  const n = document.createElement(tag); if (text) n.textContent = text;
  if (cls) n.className = cls; return n;
}
function link(stop, cls) {
  const a = node('a', stop.link, cls); a.href = stop.url;
  if (stop.url.startsWith('http')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  return a;
}
function navigation() {
  const list = node('div', null, 'link-list');
  for (const s of stops) {
    const a = link(s); a.replaceChildren(node('span', s.name),node('small',s.tag.includes('已停止') ? '已停止运营 ↗' : '↗'));
    list.append(a);
  }
  showPanel('原来的入口，都还在。', 'INDEX / LEGACY LINKS', [node('p','也可以直接点击导航。外部链接会在新标签页打开。'),list]);
}
function interact() {
  if (panel.open) { panel.close(); return; }
  if(visit.walking){const result=visit.interact();if(result?.kind==='message')toast(result.text);else if(result?.kind==='showroom')showroom?.open();else if(result?.kind==='work'){const stop=stops.find(s=>s.id===result.contentId);if(stop)showPanel(stop.name,'服务区存档展室',[node('p',stop.text),link(stop,'primary-link')]);}return;}
  if (nearest) showPanel(nearest.name, nearest.tag, [...(nearest.quote?[node('blockquote',nearest.quote)]:[]),node('p',nearest.text),...(nearest.url?[link(nearest,'primary-link')]:[])]);
}
function reset() {
  if(visit.walking){resetCar(state);toast('已将停放车辆原地扶正');return;}
  cameraOcclusion?.reset();clearInput(); highway?.recoverLocal(); resetCar(state); bounceClock=0; if (panel.open) panel.close();
  if (camera && vehicle) { syncVehicle(); positionCamera(true); }
  toast('已原地扶正 · 道路位置与朝向保留');
  renderer?.domElement.focus({preventScroll:true});
}
function respawn(){touchDirection=1;visit.dispose();document.body.classList.remove('walking');cameraOcclusion?.reset();
 clearInput();if(panel.open)panel.close();respawnCar(state);
 highway.reset();if(initialScene==='highway')highway.startOnRoad(state,'A+',-1550,0);else if(initialScene==='crabbay')highway.startInRegion(state,CRABBAY_INDEX);else if(initialRegion?.index)highway.startInRegion(state,initialRegion.index);
 bounceClock=0;tankView.reset(state.heading);cameraTrackX=state.x;syncVehicle();positionCamera(true);syncSceneRoute(highway.mode,townPose);toast('已回到本次出发点 · 车辆姿态与速度已重置');renderer?.domElement.focus({preventScroll:true});
}
function beginRecovery(source){const inMenu=paused&&pauseMenu.open&&source.startsWith('pointer:')&&!worldMap.opened&&!showroom?.opened&&!modelLoading;if(document.body.dataset.ready!=='true'||panel.open||simulationPaused()&&!inMenu)return;if(recoveryHold.begin(source)){recoveryInMenu=inMenu;if(!inMenu)start();$(inMenu?'mobile-recovery-status':'recovery-countdown').hidden=false;}}
function endRecovery(source){if(recoveryHold.release(source)==='local')reset();if(!recoveryHold.active)cancelRecovery();}
function stepRecovery(raw){
  if(!document.hidden&&recoveryHold.active&&!panel.open&&(!simulationPaused()||recoveryInMenu&&paused&&!worldMap.opened&&!showroom?.opened&&!modelLoading)){if(recoveryHold.step(raw)==='spawn')respawn();else{$(recoveryInMenu?'mobile-recovery-status':'recovery-countdown').textContent=`继续按住 ${recoveryHold.remaining.toFixed(1)} 秒 → 回到出生点`;}}
}
function changeGear(direction){if(visit.walking)return;if(shiftBuffer.request(direction,state,keys.has('ControlLeft')||keys.has('ControlRight')))return;const result=shiftGear(state,direction);toast(result.reason);updateUI();renderer?.domElement.focus({preventScroll:true});}
$('drive-mode-button').onclick=()=>{if(visit.walking)return;const result=switchDriveMode(state);if(result.ok){inputGuard.block();releaseDrivingControls();syncVehicle();updateUI();}toast(result.reason);renderer?.domElement.focus({preventScroll:true});};
$('transmission-select').onchange=e=>{if(visit.walking)return;if(powertrainSpec(state.vehicle).type==='ev'){const result=chooseElectricRange(state,e.target.value);inputGuard.block();releaseDrivingControls();updateUI();toast(result.reason);renderer?.domElement.focus({preventScroll:true});return;}clearInput();state.transmission=['mt','at','cvt'].includes(e.target.value)?e.target.value:'at';state.cvtRatio=gearboxSpec(state.vehicle,'cvt').max;state.gear=state.transmission==='mt'?0:1;updateUI();toast(state.transmission==='cvt'?'CVT 连续传动比：W 油门，S 脚刹及倒车；鼠标换挡不适用。':state.transmission==='mt'?activeCar==='bt7'?'BT-7 4MT 方向辅助：W/S 前后；Ctrl + 鼠标选前进挡，I 点火。':'MT：Ctrl 离合，Z 降挡 / X 升挡，W 油门 / S 刹车；I 点火。':'AT：自动换挡，W 前进 / S 刹车及倒车。');renderer?.domElement.focus({preventScroll:true});};
for(const b of document.querySelectorAll('[data-shift]'))b.onclick=()=>changeGear(+b.dataset.shift);
for(const b of document.querySelectorAll('[data-signal]'))b.onclick=()=>{if(visit.walking)return;toggleSignal(signal,+b.dataset.signal);start();};
$('tuning-select').onchange=e=>{if(visit.walking)return;clearInput();state.tuning=e.target.value==='stock'?'stock':'arcade';state.gear=state.transmission==='mt'?0:1;toast(state.tuning==='stock'?'使用原厂峰值与传动比参考；曲线中间节点与环境阻力为估算。':'街机扭矩助力已开启，传动比与倍率见驾驶设置。');updateUI();renderer?.domElement.focus({preventScroll:true});};
$('junction-select').onchange=e=>{if(visit.walking)return;if(highway?.setJunction(e.target.value))toast('首个周期市镇出口已设为'+e.target.selectedOptions[0].textContent);renderer?.domElement.focus({preventScroll:true});};
$('challenge-button').onclick=()=>{if(visit.walking)return;if(highway?.startChallenge(state.x)){toast('1 km 计时开始 · 碰撞 +3秒；出口与复位会取消挑战');renderer.domElement.focus({preventScroll:true});}else toast('先驶入 S01 高速，再开始 1 km 计时。');};
$('ignition-button').onclick=()=>{if(visit.walking)return;toast(ignite(state).reason);updateUI();renderer?.domElement.focus({preventScroll:true});};
$('stall-toggle').onchange=e=>{if(visit.walking)return;state.stallEnabled=e.target.checked;toast(state.stallEnabled?'MT 熄火模拟已开启：停车记得踩离合。':'友好防熄火已开启；已经熄火时仍需 I 点火。');renderer?.domElement.focus({preventScroll:true});};
$('start-button').onclick = start;
$('nav-button').onclick = navigation;
$('close-panel').onclick = () => panel.close();
$('interact').onclick = interact;
function toggleVisit(){if(simulationPaused()||panel.open)return;inputGuard.block();cancelRecovery();releaseDrivingControls();music.stop();const result=visit.toggle();if(result.ok){resetSignals(signal);document.body.classList.toggle('walking',visit.walking);positionCamera(true);updateUI();}renderer?.domElement.focus({preventScroll:true});}
$('visit-button').onclick=toggleVisit;
const recoveryButton=$('reset-button');
recoveryButton.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();recoveryButton.setPointerCapture(e.pointerId);beginRecovery('pointer:'+e.pointerId);};
recoveryButton.onpointermove=e=>{const r=recoveryButton.getBoundingClientRect();if(e.clientX<r.left-6||e.clientX>r.right+6||e.clientY<r.top-6||e.clientY>r.bottom+6)cancelRecovery();};
recoveryButton.onpointerup=e=>{e.preventDefault();endRecovery('pointer:'+e.pointerId);};recoveryButton.onpointercancel=cancelRecovery;recoveryButton.onlostpointercapture=cancelRecovery;
recoveryButton.onkeydown=e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();e.stopPropagation();if(!e.repeat)beginRecovery('button:'+e.code);}};recoveryButton.onkeyup=e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();e.stopPropagation();endRecovery('button:'+e.code);}};recoveryButton.onclick=e=>e.preventDefault();
$('help-button').onclick = () => showPanel('驾驶说明', 'HOW TO / 轻轻开，慢慢逛', [node('p','W 前进，S 刹停后倒车。A / D 转向。S 是四轮脚刹；Space 是后轮手刹，转向时可使后轮侧滑，同时保留原动作弹跳和音乐。松开 Space 后若仍在滑行，行驶联动继续。短按 R 松开原地扶正；长按 R / 复位 2 秒回到本次出发点。靠近地标按 F 阅读，再按 F 或关闭按钮返回；Esc 会暂停整套模拟，再按 Esc 或点击继续恢复。M 或点击小地图打开可拖动缩放的世界地图，查看已探索和已知连接；打开时暂停，M / Esc 返回。Q / E 左右转向灯；真正转向后回正自动关闭。鼠标左键降挡 / 右键升挡，Z / X 也可。'),node('p','蔚来 ET5T 与领克10 EV 使用原厂单速固定减速。变速选择器为 D / N / R，D/R须完全停稳并松油门；N只滑行，无驱动与回收。W/S默认前进、刹停后倒车。松油回收与脚刹共用总制动力预算；没有燃油离合、怠速、MT/CVT模拟或点火。参数页标明质量/减速比等估计，暂不模拟电量消耗或充电；加油泵不适用于电动车。'),node('p','CVT 为连续变比，鼠标换挡不适用。车型与年款决定原厂变速箱，非原厂选项标（模拟）；C-HR 1.2T 为机械 CVT，不是混动 e-CVT。03+ 为 8AT、思域 1.8GL 为 5AT，其起步耦合仍为近似。大运有真实铰接挂车；BT-7 的 W/S 是前进/刹停后倒车，A/D 操纵车体；点击右侧“鼠标环视”或拖动环视区观察，炮塔平滑跟随视角，C 回中，Esc 释放并暂停。4MT 加了方向辅助，前进挡仍用 Ctrl + 鼠标换挡；按住 Ctrl 可在 N 挡空转，启用熄火后仍须 I 点火。BT-7 停稳后按 T 或驾驶设置按钮切换履带/轮式，切换过程为游戏简化。所有车型共享物理与娱乐弹跳独立层；驾驶设置可切原厂参考或街机调校，显示独立扭矩和终传倍率。MT 默认 N：按住 Ctrl 离合，在驾驶画布上用鼠标左键降挡 / 右键升挡（Z / X 备用）；W 油门、S 刹车，缓慢释放离合起步。停稳后可降到 R，W 驱动倒车。I 点火，须停稳且 N 或踩住离合。默认防熄火；勾选模拟熄火后，停车不踩离合或低速高挡可能熄火。高速过度降挡会被转速保护拒绝。触屏可以同时按住方向与油门，并使用仪表旁灯光与换挡按钮。方块按钮后轮手刹并弹跳，停稳后原地弹跳。收集 8 枚蓝色存档碎片。沿出生点前方道路直行进入 S01 高速；高速和互通按种子随行驶生成，可到更多高速；双向总4/6/8车道，外侧应急车道不作正常行车道。市镇出口位于互通之间，驶完整段连接路进入提前加载的街区，保留车辆位置与速度；沿街区道路可经加速车道重新汇入。高速上轻按方向键换道。可开始 1 km 计时，碰撞 +3 秒；安全超车可连击加分，碰撞会清连击。'),node('p','驾驶设置可选鼠标位置转向和灵敏度，C 将鼠标当前位置设为回中点；不锁鼠标，离开画布或打开菜单即释放转向，A/D 和触屏仍可使用。高速剧烈反向转向可能引起侧滑、动态载荷转移与翻车，和弹跳动画无关；短按 R 在当前位置扶正，保留道路与朝向；长按 2 秒回到本次出发点。'),node('p','监控是游戏自定义规则：低于60 km/h扣50，60至不足100不计分，100至120加50，超过120至144不计分，超过144至不足180扣200，180及以上扣500。监控前300米有预告；附近实际超车未打对应方向灯扣50，持续骑线扣100，项目可叠加。倒车和复位不能重复刷分。'),node('p','江湾高速南北双向各设独立服务区，沿本方向加减速道驶入驶出，不能穿越中分带掉头。整车停进停车场后按 G 下车，WASD 或触屏方向步行，鼠标环视；F 操作油泵、休息长椅与作品展板；观车棚展台可自由旋转全部车型、查看参数并调色。打开观车界面暂停车辆、交通和音乐，关闭后回原位置。回到车门旁按 G 上车。加油为无费用的游戏补给演示，尚不模拟油耗和燃油耗尽。步行打开 M 地图或 Esc 会暂停，关闭后重新按键才移动。'),node('p','所有车型行驶时弹跳并联动本地音频；停驶恢复正常。♫ 可加载你有权使用的原曲、调音量或静音。面板、失焦、切车型会暂停歌曲并保留进度，下次弹跳从原处继续；读取动画始终静音。弹跳动画可独立开启、关闭或跟随系统；镜头动态和碰撞闪光仍遵循系统减少动态效果设置。')]);
$('music-button').onclick=()=>{
  const status=node('p');status.id='audio-status';
  const file=document.createElement('input');file.type='file';file.accept='audio/*';file.setAttribute('aria-label','加载本地原曲音频');file.onchange=()=>{if(file.files[0])music.load(file.files[0]);};
  const volume=node('label','音量 ');const range=document.createElement('input');range.type='range';range.min=0;range.max=1;range.step=.01;range.value=music.status().volume;range.setAttribute('aria-label','音乐音量');range.oninput=()=>music.volume(range.value);volume.append(range);
  const mute=node('label',' 静音 ');const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=music.status().muted;checkbox.setAttribute('aria-label','音乐静音');checkbox.onchange=()=>music.mute(checkbox.checked);mute.append(checkbox);
  const unlock=node('button','启用 / 重试播放');unlock.type='button';unlock.onclick=()=>{music.retry();toast('继续驾驶或按住空格，即可联动播放。');};
  showPanel('驾驶音乐', 'LOCAL AUDIO / 仅在本浏览器使用', [status,file,volume,mute,unlock,node('p','已接入经站点所有者批准用于此试玩站的曲目，首次活动才读取。可用你有权使用的本地音频替换，替换文件仅留在当前浏览器。')]);music.stop();
};
panel.addEventListener('close', () => { document.body.classList.remove('panel-open'); if(!simulationPaused())(renderer?.domElement||$('nav-button')).focus({preventScroll:true}); });
panel.addEventListener('click', e => {
  const r = panel.getBoundingClientRect();
  if (e.target === panel && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) panel.close();
});
// Suppress the native menu throughout this game document, including HUD/dialog overlays.
// Only the focused driving canvas pointer handler is allowed to shift gears.
document.addEventListener('contextmenu',e=>{if(renderer&&$('fallback').hidden)e.preventDefault();},{capture:true});
window.addEventListener('keydown', e => {
  const code=drivingCode(e);
  if(document.body.dataset.ready!=='true'){inputGuard.keydown(code,e.repeat);inputGuard.block();return;}
  if (code === 'Escape') {e.preventDefault();if(!e.repeat){if(tankLook?.justUnlocked())return;if(worldMap.opened)worldMap.close();else if(showroom?.opened)showroom.close();else if(paused)resumeDriving();else pauseDriving();}return;}
  const editing=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable;
  if(code==='KeyM'&&!editing&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat)worldMap.toggle();return;}
  if(showroom?.opened){inputGuard.keydown(code,e.repeat);inputGuard.block();return;}
  if(editing&&e.ctrlKey)return;
  if(!inputGuard.keydown(code,e.repeat)){if(!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))e.preventDefault();return;}
  if(simulationPaused()){inputGuard.block();return;}
  if (code === 'KeyF' && !e.repeat) { e.preventDefault(); interact(); return; }
  if (panel.open || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {inputGuard.block();return;}
  if(code==='KeyG'&&!e.repeat){e.preventDefault();toggleVisit();return;}
  if(visit.walking){if(code==='KeyR'){e.preventDefault();if(!e.repeat)beginRecovery('key');return;}if(code==='KeyC'&&!e.repeat){e.preventDefault();centerMouse();return;}if(DRIVING_KEYS.has(code)&&!['Space','ControlLeft','ControlRight'].includes(code)){e.preventDefault();inputSources.keydown(code);}return;}
  if(code==='KeyR'){e.preventDefault();if(!e.repeat)beginRecovery('key');return;}
  if(code==='KeyC'&&!e.repeat&&(steeringMode==='mouse'||activeCar==='bt7')){e.preventDefault();centerMouse();return;}
  if(code==='KeyT'&&!e.repeat&&activeCar==='bt7'){e.preventDefault();$('drive-mode-button').click();return;}
  if(code==='KeyI'&&!e.repeat){e.preventDefault();$('ignition-button').click();return;}
  if((code==='KeyQ'||code==='KeyE')&&!e.repeat){e.preventDefault();toggleSignal(signal,code==='KeyQ'?1:-1);start();return;}
  if((code==='KeyZ'||code==='KeyX')&&!e.repeat){e.preventDefault();changeGear(code==='KeyX'?1:-1);return;}
  if (DRIVING_KEYS.has(code)) {
    // Preserve native keyboard activation when a button has focus.
    if (code === 'Space' && e.target.tagName === 'BUTTON') return;
    e.preventDefault(); inputSources.keydown(code); start();music.gesture();
  }
});
window.addEventListener('keyup',e=>{const code=drivingCode(e);if(code==='KeyR'){e.preventDefault();endRecovery('key');}inputSources.keyup(code);inputGuard.keyup(code);});
window.addEventListener('blur',()=>{cancelRecovery();inputGuard.blur();if(simulationPaused()){releaseDrivingControls();music.stop();}else clearInput();music.suspend();});
document.addEventListener('visibilitychange', () => {cancelRecovery();inputGuard.blur();if(simulationPaused()){releaseDrivingControls();music.stop();}else clearInput();music.suspend();lastTime = 0; accumulator = 0;});
// Touch controls own their gestures independently. Menus invalidate every owner.
const touchBlocked=key=>document.body.dataset.ready!=='true'||panel.open||simulationPaused()||visit.walking&&['Space','ControlLeft','ControlRight','TouchThrottle','TouchBrake'].includes(key);
holdButtons=bindHoldButtons({buttons:document.querySelectorAll('[data-key]'),sources:inputSources,blocked:touchBlocked,onActivate(){start();music.gesture();}});
touchStick=createVirtualJoystick({pad:$('touch-stick'),knob:$('touch-stick-knob'),blocked:()=>touchBlocked('Stick'),walking:()=>visit.walking,onActivate(){mouseSteer=0;start();music.gesture();}});
$('mobile-pause').onclick=pauseDriving;
for(const b of document.querySelectorAll('[data-touch-direction]'))b.onclick=()=>{
 if(simulationPaused()||panel.open||visit.walking||state.transmission==='mt')return;
 if(!canChangeTouchDirection(state,keys)){toast('先松开油门并刹停，再选择前进 / 倒车');return;}
 const next=Number(b.dataset.touchDirection);if(powertrainSpec(state.vehicle).type==='ev'){const result=chooseElectricRange(state,'ev:'+next);if(!result.ok){toast(result.reason);return;}}else{state.gear=next;state.shiftCooldown=Math.max(state.shiftCooldown||0,.18);}
 touchDirection=next;updateUI();
};
// Move the original controls rather than creating conflicting duplicate selects.
const mobileMedia=matchMedia('(pointer:coarse), (max-width:700px)');
const mobileMoves=[[$('hud-options'),$('mobile-options')],[$('nav-button'),$('mobile-options')],[$('transmission-select'),$('mobile-options')],[$('car-select'),$('mobile-options')],[$('reset-button'),$('mobile-options')],[$('music-button'),$('mobile-options')],[$('help-button'),$('mobile-options')],[$('ignition-button'),$('mobile-options')],[$('signal-left'),$('touch-signals')],[$('signal-right'),$('touch-signals')],...Array.from(document.querySelectorAll('.shift-controls>*')).map(n=>[n,n.dataset.key?$('touch-clutch-slot'):$('touch-shift-slot')])].map(([node,target])=>{const marker=document.createComment('desktop control position');node.before(marker);return{node,target,marker};});
function syncTouchLayout(){releaseDrivingControls();const enabled=mobileMedia.matches;document.body.classList.toggle('touch-layout',enabled);for(const {node,target,marker}of mobileMoves)if(enabled)target.append(node);else marker.after(node);}
mobileMedia.addEventListener('change',syncTouchLayout);syncTouchLayout();
window.addEventListener('resize',()=>{touchStick.reset();holdButtons.reset();tankLook?.suspend();cancelRecovery();});
window.addEventListener('pagehide',()=>{inputGuard.blur();releaseDrivingControls();music.suspend();});
const fallbackList = node('div',null,'link-list');
for (const s of stops) {
  const a=link(s); a.replaceChildren(node('span',s.name),node('small',s.tag.includes('已停止')?'已停止运营 ↗':'↗'));
  fallbackList.append(a);
}
$('fallback-links').append(fallbackList);
// The text navigation is initialized before Three.js, so a failed module load is recoverable.
try {
  await loadingStage('读取三维画面与场景');
  const THREE = await import('./vendor/three.module.min.js');
  [{createTownScene},{createHighway},{createRegionScenes}]=await Promise.all([import('./town/scene.js?rev=world21d'),import('./highway/scene.js?rev=world21d'),import('./region-scene.js?rev=world21d')]);
  await init(THREE);
} catch (error) {
  console.error('Drive scene unavailable:',error); clearInput();
  $('welcome').hidden = true; $('fallback').hidden = false;
  $('interact').hidden = true;
  document.querySelectorAll('.map-card,.dashboard,.touch-controls').forEach(n => n.hidden = true);
  throw error;
}

async function init(T) {
  await loadingStage('准备三维画布');
  scene = new T.Scene(); scene.background = new T.Color(0xdce8ee); scene.fog = new T.Fog(0xdce8ee,62,145);
  camera = new T.PerspectiveCamera(47,innerWidth/innerHeight,.1,650);
  renderer = new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7)); renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.domElement.setAttribute('aria-label','第三人称驾驶视角');
  renderer.domElement.tabIndex=0;
  $('world').append(renderer.domElement);
  scene.add(new T.HemisphereLight(0xdcedff,0x899582,2.8));
  const sun = new T.DirectionalLight(0xffefdc,3.5); sun.position.set(-32,52,22); sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:130});
  sun.shadow.normalBias=.045; sun.shadow.bias=-.0007; scene.add(sun);scene.add(sun.target);sunLight=sun;
  await loadingStage('构建出生点与周边道路');
  let sign;
  {
   const town=createTownScene(T,scene,{stops,tokenPositions,boxes,fish,tokens,mapTokens:$('map-tokens')});townRoot=town.root;sign=town.sign;
   regionScenes=createRegionScenes(T,scene,town,{sign,defer:true});const moveTown=pose=>{townPose={...pose};townSerial++;const entry=regionScenes.load(pose);townRoot=entry.root;cameraOcclusion?.reset();return entry.prepare;};moveTown(townPose);
   await loadingStage('构建高速、匝道与地形');
   highway=createHighway(T,scene,{sign,toast,onTownLoad:moveTown,deferBuild:true});
   if(initialScene==='highway')highway.startOnRoad(state,'A+',-1550,0);else if(initialScene==='crabbay')highway.startInRegion(state,CRABBAY_INDEX);else if(initialRegion?.index)highway.startInRegion(state,initialRegion.index);
  }
  if(initialScene==='crabbay'){$('welcome').querySelector('h1').textContent='CRABBAY · 螃蟹湾';$('welcome').querySelector('p').textContent='沿海岸道路看看后勤基地与码头，再沿连接路驶回高速。当前为环境原型，具体剧情仍待确认。';}
  await loadingStage('准备车辆与驾驶界面');
  vehicles.set('yaris',createYaris(T));
  for(const car of vehicles.values()){addTurnLights(T,car);scene.add(car);car.userData.groundHull??=captureGroundHull(T,car);car.visible=false;}
  const switchCar=kind=>{
    const next=kind==='chr'||FLEET[kind]?kind:'yaris';
    if(next==='chr'&&!isCHRReady())return false;
    if(next!==activeCar&&!fitsVehicle(state,next)){$('car-select').value=activeCar;toast('附近空间不足，驶到开阔直路停稳后再换这辆车。');return false;}
    let prepared=vehicles.get(next),created=false;
    // Construction is a transaction: keep the live vehicle and its rigid world
    // untouched until lamps, support geometry and optional trailer are ready.
    try{
      if(!prepared){prepared=next==='chr'?createCHR(T):createFleetVehicle(T,next);created=true;addTurnLights(T,prepared);prepared.userData.groundHull??=captureGroundHull(T,prepared);if(prepared.userData.trailerModel)addTurnLights(T,prepared.userData.trailerModel);}
    }catch(error){
      if(created&&prepared)disposePreview(prepared,{additionalRoots:[prepared.userData.trailerModel].filter(Boolean)});
      inputGuard.block();releaseDrivingControls();$('car-select').value=activeCar;console.error('Vehicle preparation failed:',error);toast('这辆车暂时未能准备完成，保留当前车辆；可以重新选择重试。');
      if(!vehicle)switchCar(activeCar);return false;
    }
    cameraOcclusion?.reset();clearInput();releaseRigid(state);activeCar=next;touchDirection=1;state.vehicle=activeCar;delete state.trailer;delete state.quaternion;delete state.modeChangePose;state.chassisY=undefined;state.driveMode=kind==='bt7'?'tracks':undefined;
    configureVehiclePowertrain(state,activeCar);
    if(created){vehicles.set(activeCar,prepared);scene.add(prepared);if(prepared.userData.trailerModel)scene.add(prepared.userData.trailerModel);}
    for(const [key,car] of vehicles){car.visible=key===activeCar;if(car.userData.trailerModel)car.userData.trailerModel.visible=key===activeCar;}
    vehicle=vehicles.get(activeCar);if(showroom)setVehiclePaint(vehicle,showroom.applied(activeCar));tankView.reset(state.heading);document.body.classList.toggle('tank-driving',activeCar==='bt7');$('tank-view-controls').hidden=activeCar!=='bt7';wheels.length=0;wheels.push(...vehicle.userData.wheels);bounceClock=0;
    $('car-select').value=activeCar;syncVehicle();updateUI();return true;
  };
  for(const [key,spec] of Object.entries(FLEET)){const o=document.createElement('option');o.value=key;o.textContent=spec.label;$('car-select').append(o);}
  const selectCar=async kind=>{if(visit.walking)return false;
   if(kind==='chr'&&!isCHRReady()){
    modelLoading=true;inputGuard.block();releaseDrivingControls();music.stop();$('car-select').disabled=true;toast('正在读取 C-HR 精修模型…');
    try{await prepareCHR(nextLoadingPaint);}catch(error){console.error('C-HR model unavailable:',error);toast('C-HR 模型读取失败，保留当前车辆；可以重新选择重试。');$('car-select').value=activeCar;if(!vehicle)switchCar(activeCar);return false;}
    finally{modelLoading=false;$('car-select').disabled=false;inputGuard.block();releaseDrivingControls();lastTime=0;accumulator=0;}
   }
   return switchCar(kind);
  };
  await selectCar(new URLSearchParams(location.search).get('car'));
  $('car-select').onchange=async e=>{if(await selectCar(e.target.value))toast('车型已选择：停稳恢复车身；Space 驻车制动并保留娱乐弹跳。');if(!simulationPaused()&&!panel.open)renderer.domElement.focus({preventScroll:true});};
  syncVehicle(); positionCamera(true);
  const {createShowroom}=await import('./showroom.js?rev=world21d');
  showroom=createShowroom(T,{dialog:$('showroom'),renderer,getDrivingKind:()=>activeCar,getDriveMode:()=>state.driveMode,
   onOpen(){cancelRecovery();inputGuard.block();releaseDrivingControls();music.stop();if(document.pointerLockElement)document.exitPointerLock();document.body.classList.add('showroom-open');updateUI();},
   onClose(){inputGuard.block();releaseDrivingControls();lastTime=0;accumulator=0;document.body.classList.remove('showroom-open');if(worldMap.opened)$('world-map-close').focus();else if(paused)$('resume-button').focus();else renderer.domElement.focus({preventScroll:true});updateUI();},
   onApply(kind,hex){const car=vehicles.get(kind);if(car)setVehiclePaint(car,hex);}
  });
  followTankTurret=createTurretFollower(T);walkerModel=new T.Group();const coat=new T.MeshStandardMaterial({color:0x497980,roughness:.8}),skin=new T.MeshStandardMaterial({color:0xe0be9f,roughness:.8});const torso=new T.Mesh(new T.CapsuleGeometry(.22,.48,4,8),coat);torso.position.y=1.0;const head=new T.Mesh(new T.SphereGeometry(.19,10,8),skin);head.position.y=1.63;walkerModel.add(torso,head);for(const side of[-1,1]){const leg=new T.Mesh(new T.CylinderGeometry(.10,.09,.58,7),coat);leg.position.set(side*.13,.30,0);walkerModel.add(leg);}walkerModel.visible=false;scene.add(walkerModel);
  tankLook=createTankLookInput({canvas:renderer.domElement,button:$('tank-look-button'),pad:$('tank-look-pad'),enabled:()=>activeCar==='bt7'||visit.walking,blocked:()=>simulationPaused()||panel.open,onMove:(dx,dy)=>visit.walking?visit.look(dx,dy):tankView.move(dx,dy),onActivate:()=>{start();music.gesture();},onLost:pauseDriving,onError:()=>toast('鼠标环视未启用，可拖动右侧环视区观察。')});
  window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7)*renderScale);});
  renderer.domElement.addEventListener('pointermove',e=>{if(visit.walking||activeCar==='bt7'||e.pointerType!=='mouse'||simulationPaused()||panel.open||steeringMode!=='mouse'||!started||document.activeElement!==renderer.domElement)return;lastMouseX=e.clientX;mouseSteer=Math.max(-1,Math.min(1,(mouseAnchorX-e.clientX)/(innerWidth*.35)*+$('mouse-sensitivity').value));});
  renderer.domElement.addEventListener('pointerleave',()=>{mouseSteer=0;});
  renderer.domElement.addEventListener('pointerdown',e=>{if(visit.walking||e.pointerType!=='mouse'||simulationPaused()||panel.open||!started||document.activeElement!==renderer.domElement)return;if(e.button===0||e.button===2){e.preventDefault();changeGear(e.button===0?-1:1);}});
  renderer.domElement.addEventListener('contextmenu',e=>{if(!simulationPaused()&&!panel.open&&started&&document.activeElement===renderer.domElement)e.preventDefault();});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();clearInput();toast('3D 画面暂时中断，可使用站点导航或返回文字主页。');});
  scene.traverse(()=>sceneObjects++);
  await loadingStage('准备车辆接地与道路碰撞');
  await highway.preparePhysics?.(state,nextLoadingPaint);
  cameraOcclusion=createCameraOcclusion(T,scene,{excluded:()=>[walkerModel,...vehicles.values()].flatMap(v=>[v,v.userData.trailerModel]).concat((highway.traffic||[]).flatMap(t=>[t.node,t.trailerNode])).filter(Boolean),protectedRoads:()=>highway.cameraRoadOwners?.()||[]});
  await loadingStage('准备第一帧画面');
  highwayStats=highway.animate(state,0,0,false,bounceMotionEnabled());scene.updateMatrixWorld(true);cameraOcclusion.update(camera,state,0);updateUI();renderer.render(scene,camera);
  releaseDrivingControls();inputGuard.block();await finishLoading();
  requestAnimationFrame(frame);
}
function syncVehicle(){
  const baseY=state.chassisY??(.22+(state.roadY||0));
  vehicle.position.set(state.x,baseY,state.z);
  applyYarisBounce(vehicle,bounceClock,baseY,YARIS_PLAY_SPEED,yarisMode!=='stopped'&&bounceMotionEnabled()&&!state.rolled);
  if(state.quaternion)vehicle.quaternion.set(state.quaternion.x,state.quaternion.y,state.quaternion.z,state.quaternion.w);
  else vehicle.rotation.set(0,state.heading,0);
  vehicle.userData.body.rotation.z=0;
  applyTurnLights(vehicle,signal.side,signalOn);
  for(const w of wheels){w.pivot.rotation.y=w.front&&(activeCar!=='bt7'||state.driveMode==='wheels') ? state.wheelAngle||0 : 0;w.spin.rotation.x=activeCar==='bt7'?(w.side>0?vehicle.userData.trackPhases.left:vehicle.userData.trackPhases.right)/.415:vehicle.userData.rollAngle;}
  setFleetVisualMode(vehicle,state.driveMode);
  const trailer=vehicle.userData.trailerModel;if(trailer){const f=fleetSpec(activeCar).trailer,t=state.trailer||{x:state.x-Math.sin(state.heading)*6.15,z:state.z-Math.cos(state.heading)*6.15,y:baseY,quaternion:{x:0,y:Math.sin(state.heading/2),z:0,w:Math.cos(state.heading/2)}};trailer.position.set(t.x,t.y,t.z);applyYarisBounce(trailer,bounceClock,t.y,YARIS_PLAY_SPEED,yarisMode!=='stopped'&&bounceMotionEnabled()&&!state.rolled);trailer.quaternion.set(t.quaternion.x,t.quaternion.y,t.quaternion.z,t.quaternion.w);for(const w of trailer.userData.wheels)w.spin.rotation.x=vehicle.userData.rollAngle;applyTurnLights(trailer,signal.side,signalOn);}
}
function positionCamera(snap=false,dt=1/60){
 const onHighway=['highway','ramp','local'].includes(highway?.mode);scene.fog.near=onHighway?170:62;scene.fog.far=onHighway?440:145;
 if(visit.walking){const p=visit.walker,h=visit.viewYaw,pitch=visit.viewPitch,d=7.5,t=snap?1:1-Math.exp(-dt*8);const target={x:p.x-Math.sin(h)*Math.cos(pitch)*d,y:p.y+1.25+Math.sin(pitch)*d,z:p.z-Math.cos(h)*Math.cos(pitch)*d};for(const k of['x','y','z'])camera.position[k]+=(target[k]-camera.position[k])*t;camera.lookAt(p.x,p.y+1.1,p.z);camera.fov=47;camera.updateProjectionMatrix();if(sunLight){sunLight.position.set(p.x-32,p.y+52,p.z+22);sunLight.target.position.set(p.x,p.y,p.z);}return;}

  if(Math.abs(cameraTrackX-state.x)>80)snap=true;cameraTrackX=state.x;
  const delta=Math.atan2(Math.sin(state.heading-cameraHeading),Math.cos(state.heading-cameraHeading));cameraHeading+=delta*(snap?1:1-Math.exp(-dt*7));const dx=Math.sin(cameraHeading),dz=Math.cos(cameraHeading);
  const narrow=innerWidth<700;
  const follow=activeCar==='dayun'?32:activeCar==='bt7'?17:(narrow?12:14),extraY=activeCar==='dayun'?6:activeCar==='bt7'?2:0;
  let target={x:state.x-dx*follow+dz*2.8,y:(state.roadY||0)+extraY+(onHighway?(narrow?8.5:7.7):(narrow?10.5:10)),z:state.z-dz*follow-dx*2.8};
  if(activeCar==='bt7'){const distance=narrow?11:13,horizontal=Math.cos(tankView.pitch)*distance;target={x:state.x-Math.sin(tankView.yaw)*horizontal,y:(state.chassisY??state.roadY??0)+1.2+Math.sin(tankView.pitch)*distance,z:state.z-Math.cos(tankView.yaw)*horizontal};}
  const t=snap?1:1-Math.exp(-dt*4);
  camera.position.x+=(target.x-camera.position.x)*t;camera.position.y+=(target.y-camera.position.y)*t;camera.position.z+=(target.z-camera.position.z)*t;
  const aim=activeCar==='bt7'?{x:state.x,y:(state.chassisY??state.roadY??0)+1.2,z:state.z}:{x:state.x+dx*(onHighway?9:4),y:1+(state.roadY||0),z:state.z+dz*(onHighway?9:4)};for(const k of ['x','y','z'])cameraAim[k]+=(aim[k]-cameraAim[k])*(snap?1:1-Math.exp(-dt*9));camera.lookAt(cameraAim.x,cameraAim.y,cameraAim.z);
  const fov=47+(onHighway&&!reduceMotion.matches?Math.abs(state.speed)*.24:0);if(Math.abs(camera.fov-fov)>.05){camera.fov+=(fov-camera.fov)*t;camera.updateProjectionMatrix();}
  if(sunLight){sunLight.position.set(state.x-32,52,state.z+22);sunLight.target.position.set(state.x,0,state.z);}
}
function updateTankTurret(dt){if(!visit.walking&&activeCar==='bt7'&&!panel.open)followTankTurret?.(vehicle,camera,dt);}
function updateUI(){
  if(state.transmission!=='mt'&&state.gear!==0)touchDirection=Math.sign(state.gear);
  $('touch-stick-label').textContent=visit.walking?'移动':'转向';$('touch-stick').setAttribute('aria-label',visit.walking?'虚拟摇杆：二维步行':'虚拟摇杆：向左或向右转向，松手回正');for(const b of document.querySelectorAll('[data-touch-direction]'))b.setAttribute('aria-pressed',String(state.gear!==0&&Number(b.dataset.touchDirection)===touchDirection));
  const electric=powertrainSpec(activeCar,state.tuning).type==='ev';document.body.classList.toggle('electric',electric);
  $('steering-select').disabled=activeCar==='bt7'||visit.walking;$('mouse-center').textContent=activeCar==='bt7'?'C · 环视回中':'C · 鼠标回中';$('tank-view-status').textContent=state.driveMode==='wheels'?'轮式 · 前轮转向':'履带 · 左右差速';$('steering-hint').textContent=activeCar==='bt7'?'W/S 前后 · A/D 车身 · 鼠标环视 / 炮塔 · C 回中':steeringMode==='mouse'?'鼠标位置转向 · C 回中 · Esc 暂停':'WASD / 触屏 · Esc 暂停';$('rollover-state').hidden=!state.rolled;
  $('speed').textContent=String(Math.round((state.groundSpeed??Math.abs(state.speed))*3.6)).padStart(2,'0');
  $('gear').textContent=`${state.transmission.toUpperCase()} / ${state.gear<0?'R':state.gear===0?'N':state.transmission==='cvt'||electric?'D':state.gear+'挡'}`;
  $('rpm').textContent=electric?`电机 ${Math.round(state.rpm/100)*100} rpm`:state.engineRunning?`${Math.round(state.rpm/100)*100} rpm`:'已熄火 · I点火';
  const driveSpec=powertrainSpec(activeCar,state.tuning),f=fleetSpec(activeCar);$('vehicle-configuration').textContent=f?`${f.year||'当前配置'} ${f.market} · ${f.configuration}。${f.assumptions}`:driveSpec.name;$('drive-mode-button').hidden=activeCar!=='bt7';$('drive-mode-button').textContent=`T · ${state.driveMode==='wheels'?'轮式 → 履带':'履带 → 轮式'}`;$('tuning-description').textContent=`扭矩 ×${driveSpec.gameTorqueMultiplier} · 终传 ×${driveSpec.gameFinalDrive} · ${driveSpec.mass+(f?.trailer?.mass||0)} kg${f?.trailer?'（牵引车7875 + 挂车14000）':activeCar==='bt7'?'（战斗质量含乘员）':'（含驾驶员）'} · 参数含估计${activeCar==='chr'?' · 外观参考中国2020；动力为2017 UK 1.2T':''}`;
  $('engine-state').textContent=electric?`单速固定减速 · 电机 ${(state.motorPowerKW||0).toFixed(0)} kW · 回收 ${(state.regenPowerKW||0).toFixed(0)} kW（模型请求）`:state.transmission==='mt'?`${activeCar==='bt7'?'4MT 方向辅助 · ':''}离合 ${Math.round(state.clutch*100)}% · 滑差 ${Math.round(state.clutchSlip)} rpm`:state.transmission==='cvt'?`CVT 比值 ${(state.cvtRatio||0).toFixed(3)} · ${gearboxSpec(activeCar,'cvt').factory?'机械无级变速':'模拟配置'}`:gearboxSpec(activeCar,'at').kind==='torque-converter'?`原厂AT类型 · ${gearboxSpec(activeCar,'at').ratios.length}挡 · 起步耦合近似`:'AT 辅助操作手动齿比';
  syncTransmissionChoices($('transmission-select'),state);
  document.body.classList.toggle('manual',state.transmission==='mt');
  for(const [id,side] of [['signal-left',1],['signal-right',-1]]){$(id).classList.toggle('lit',signal.side===side&&signalOn);$(id).setAttribute('aria-pressed',String(signal.side===side));}
  const local=localTown(state);nearest=highway?.mode!=='city'?null:(townPose.index==null?stops:regionScenes?.current.interactions||[]).filter(s=>Math.hypot(s.x-local.x,s.z-local.z)<s.radius).sort((a,b)=>Math.hypot(a.x-local.x,a.z-local.z)-Math.hypot(b.x-local.x,b.z-local.z))[0]||null;
  const visitTarget=visit.target();$('interact').hidden=visit.walking?!visitTarget||panel.open:!nearest||panel.open;
  if(visit.walking&&visitTarget)$('interact').querySelector('span').textContent=visitTarget.kind==='stand'?'起身':visitTarget.name;else if(nearest)$('interact').querySelector('span').textContent='阅读 · '+nearest.name;
  $('visit-button').hidden=!started||!visit.walking&&!visit.nearby();$('visit-button').textContent=visit.walking?'G · 回到车内':'G · 停稳下车';$('visit-status').hidden=!visit.walking;$('visit-status').textContent=visit.action?`加油中 ${Math.max(0,visit.action.remaining).toFixed(1)}s`:visit.resting?'休息中 · F起身':electric?'WASD步行 · F交互 · 纯电车不使用油泵':`WASD步行 · F交互 · 燃油${Math.round(state.fuelLevel*100)}%`;for(const id of['car-select','transmission-select','tuning-select','drive-mode-button','ignition-button','pause-reset','stall-toggle','junction-select','challenge-button'])$(id).disabled=visit.walking;
  $('stall-toggle').checked=state.stallEnabled;$('stall-toggle').disabled=visit.walking||electric;$('ignition-button').disabled=visit.walking||electric;$('tuning-select').disabled=visit.walking||electric;$('tuning-select').value=state.tuning;
  if(electric)$('tuning-description').textContent=`原厂电驱峰值 · 单速 ${driveSpec.motors.map(m=>m.reductionRatio.toFixed(1)).join(' / ')} :1（估计） · ${driveSpec.mass}kg 含驾驶员${activeCar==='et5t'?'，质量估计':''} · 回收与轮胎模型；暂无电量消耗/充电仿真`;
  $('tank-view-controls').hidden=activeCar!=='bt7'&&!visit.walking;$('tank-view-controls').setAttribute('aria-label',visit.walking?'步行观察控制':'BT-7 观察控制');$('tank-look-pad').querySelector('small').textContent=visit.walking?'观察周围 · C 回中':'炮塔跟随 · C 回中';


  // Observable state used by the browser acceptance checks; no control hooks.
  Object.assign(document.body.dataset,{buildVersion:'world21g',bounceEnabled:String(bounceMotionEnabled()),bouncePreference:globalThis.driveMotionPreference?.choice||'on',powertrainType:electric?'ev':'ice',motorPowerKW:(state.motorPowerKW||0).toFixed(2),regenPowerKW:(state.regenPowerKW||0).toFixed(2),showroomOpen:String(!!showroom?.opened),actorMode:visit.mode,walker:JSON.stringify(visit.walking?visit.walker:null),fuelLevel:state.fuelLevel,cameraOccluders:cameraOcclusion?.stats.active||0,driveMode:state.driveMode||'',tankViewYaw:tankView.yaw.toFixed(4),tankViewPitch:tankView.pitch.toFixed(4),turretYaw:(vehicle?.userData.turretPivot?.rotation.y||0).toFixed(4),tankLookLocked:String(!!tankLook?.locked),trailer:JSON.stringify(state.trailer||null),paused:String(simulationPaused()),modelLoading:String(modelLoading),userPaused:String(paused),mapOpen:String(worldMap.opened),steeringMode,mouseSteer:mouseSteer.toFixed(3),rolled:String(!!state.rolled),loadTransfer:(state.loadTransfer||0).toFixed(4),lateralAcceleration:(state.lateralAcceleration||0).toFixed(4),rolloverAngle:(state.rolloverAngle||0).toFixed(4),physicsEngine:state.physicsEngine||'',physicsMass:state.physicsMass||0,chassisY:(state.chassisY||0).toFixed(4),wheelLoads:JSON.stringify(state.wheelLoads||[]),wheelContacts:JSON.stringify(state.wheelContacts||[]),quaternion:JSON.stringify(state.quaternion||{}),brakePressure:(state.brakePressure||0).toFixed(3),handbrakePressure:(state.handbrakePressure||0).toFixed(3),cvtRatio:(state.cvtRatio||0).toFixed(4),x:state.x.toFixed(3),z:state.z.toFixed(3),heading:state.heading.toFixed(3),speed:state.speed.toFixed(3),collisions:state.collisions,nearest:nearest?.id||'',collected:tokens.filter(t=>t.collected).length,car:activeCar,yarisMode,recoveryHolding:String(recoveryHold.active),recoveryRemaining:recoveryHold.remaining.toFixed(2),bodyScaleY:vehicle?.scale.y.toFixed(4)||'1',bodyScaleX:vehicle?.scale.x.toFixed(4)||'1',suspension:(vehicle?.userData.suspension||0).toFixed(4),bounceLift:(vehicle?.userData.bounceLift||0).toFixed(4),tuning:state.tuning,transmission:state.transmission,gear:state.gear,rpm:state.rpm.toFixed(0),clutch:state.clutch.toFixed(3),clutchSlip:state.clutchSlip.toFixed(0),engineRunning:String(state.engineRunning),stallEnabled:String(state.stallEnabled),vx:state.vx.toFixed(3),vz:state.vz.toFixed(3),slip:state.slip.toFixed(3),steer:state.steer.toFixed(3),wheelAngle:(state.wheelAngle||0).toFixed(5),shaftRpm:(state.shaftRPM||0).toFixed(1),engineTorque:(state.engineTorque||0).toFixed(1),clutchTorque:(state.clutchTorque||0).toFixed(1),wheelForce:(state.wheelForce||0).toFixed(1),roadResistance:(state.roadResistance||0).toFixed(1),enginePower:(state.enginePower||0).toFixed(1),clutchEngagement:(state.clutchEngagement||0).toFixed(3),throttle:(state.throttle||0).toFixed(3),pitch:state.pitch.toFixed(4),roll:state.roll.toFixed(4),signalSide:signal.side,signalOn:String(signalOn),signalArmed:String(signal.armed),lampLeft:vehicle?.userData.turnLights.get(1).emissiveIntensity||0,lampRight:vehicle?.userData.turnLights.get(-1).emissiveIntensity||0,wheelScale:vehicle?.userData.wheels[0].pivot.scale.toArray().join(',')||'1,1,1'});
  Object.assign(document.body.dataset,highwayStats,{sceneObjects,gpuGeometries:renderer?.info.memory.geometries||0,gpuTextures:renderer?.info.memory.textures||0});
  const motorway=['highway','ramp','local'].includes(highway?.mode);document.body.classList.toggle('on-highway',motorway);const speedBox=$('speed').parentElement,slot=$('hud-speed-slot');if(speedBox.parentElement!==slot)slot.prepend(speedBox);
  $('junction-select').disabled=visit.walking||highwayStats.junctionSelectable!=='true';
  $('road-label').textContent=motorway?`${highwayStats.highwayRoadNumber||'S01'} / ${highwayStats.highwayLanes||6}车道 · ${highwayStats.highwayJunctionName||'存档高速'}`:(regionForIndex(townPose.index).kind==='crabbay'?'CRABBAY / ':'TOWN / ')+regionForIndex(townPose.index).name;
  $('road-distance').textContent=highwayStats.navigationInstruction||'沿街区道路驶向高速入口 →';
  $('challenge-button').disabled=visit.walking||!motorway||highway.mode==='returning';
  $('challenge-status').textContent=highwayStats.challengeActive==='true'?`计时 ${highwayStats.challengeTime}s · ${highwayStats.challengeDistance}/1000m${+highwayStats.challengePenalty?' · 罚 '+highwayStats.challengePenalty+'s':''}`:highwayStats.challengeFinished==='true'?`1 km 完成 · ${highwayStats.challengeTime}s`:`安全超车 ${highwayStats.overtakeScore||0}分 · 连击 ×${highwayStats.overtakeCombo||0}`;
  $('road-exit').textContent=`${highwayStats.nextExitName||'S01 高速入口'}${highwayStats.nextExitDistance!==''&&highwayStats.nextExitDistance!==undefined?' · '+highwayStats.nextExitDistance+' m':''}`;
  $('camera-distance').textContent=`${highwayStats.nextCameraDistance!==''&&highwayStats.nextCameraDistance!==undefined?highwayStats.nextCameraDistance+' m':highwayStats.nextCameraName||'当前道路无摄像头'}`;
  $('monitor-score').textContent=`监控总分 ${highwayStats.monitorScore||0}`;
  const eventText=highwayStats.monitorEvents||'';if($('monitor-events').dataset.events!==eventText){$('monitor-events').dataset.events=eventText;$('monitor-events').replaceChildren(...(eventText?JSON.parse(eventText):[]).map(e=>node('li',`${e.label} ${e.points>0?'+':''}${e.points}${e.speed!==undefined?' · '+e.speed.toFixed(1)+' km/h':''}`)));}
  const context=mapContext();routeMap.draw(activePose(),context);worldMap.observe(activePose(),context);$('map-direction').textContent=context.navigation?.instruction||highwayStats.navigationInstruction||'沿当前道路继续行驶';$('map-mode').textContent=highway?.mode==='city'?'街区':'北朝上';
  if(visit.walking){$('gear').textContent='步行';$('speed').textContent=(visit.walker.speed*3.6).toFixed(0).padStart(2,'0');$('rpm').textContent='车辆已驻车';$('steering-hint').textContent='WASD步行 · 鼠标观察 · F交互 · G上车';$('tank-view-status').textContent='步行观察';$('mouse-center').textContent='C · 视角回中';$('road-distance').textContent='步行探索'+visit.path.serviceName+' · G回到车内';$('road-exit').textContent='停车场 / 加油泵 / 休息室';$('camera-distance').textContent='当前步行区域无摄像头';$('map-direction').textContent='按小地图查看停车位置';}
  $('space-help').textContent='手刹 + 弹跳';
  document.querySelector('[data-key="Space"]').setAttribute('aria-label','后轮手刹并弹跳');
}
function frame(time){
  const raw=lastTime?(time-lastTime)/1000:1/60,dt=Math.min(raw,.25);lastTime=time;
  if(started&&!simulationPaused()&&!document.hidden){frameAverage+=(raw-frameAverage)*.08;performanceWindow+=raw;if(performanceWindow>2&&frameAverage>.045&&renderScale>.55){renderScale=renderScale>.8?.75:.55;renderer.setPixelRatio(Math.min(devicePixelRatio,1.7)*renderScale);renderer.shadowMap.enabled=false;performanceWindow=0;}document.body.dataset.frameMs=(frameAverage*1000).toFixed(1);document.body.dataset.renderScale=renderScale;}
  stepRecovery(raw);
  if(!document.hidden&&simulationPaused()){renderer.render(scene,camera);try{showroom?.render();}catch(error){showroom?.close();toast('观车画面暂时中断，已返回原位置；可重新打开。');console.error('Showroom renderer:',error);}requestAnimationFrame(frame);return;}
  if(!document.hidden){
    elapsed+=dt;accumulator+=dt;
    const baseInput={steer:activeCar!=='bt7'&&steeringMode==='mouse'?mouseSteer:0,forward:keys.has('KeyW')||keys.has('ArrowUp'),reverse:keys.has('KeyS')||keys.has('ArrowDown'),left:keys.has('KeyA')||keys.has('ArrowLeft'),right:keys.has('KeyD')||keys.has('ArrowRight'),handbrake:keys.has('Space'),clutch:keys.has('ControlLeft')||keys.has('ControlRight')};
    const input=composeTouchInput(baseInput,touchStick.value,keys,touchDirection,state,visit.walking);
    const wasRolled=state.rolled;
    while(accumulator>=1/120){if((!panel.open||visit.walking)&&started){visit.beforeStep(input,1/120,panel.open);highway.step(state,visit.walking?PARKED_INPUT:{...tankAssist.step(state,input),signalSide:signal.side},1/120,boxes);visit.afterStep();const shift=visit.walking?null:shiftBuffer.step(1/120,state,input.clutch);if(shift!==null){const result=shiftGear(state,shift);toast(result.reason);}}signalOn=stepSignals(signal,state.steer,state.speed,1/120);accumulator-=1/120;}
    if(state.rolled&&!wasRolled){releaseDrivingControls();toast('车身已倾覆 · 按 R 原地扶正');}
    yarisMode=getYarisActivity({car:activeCar,started,paused:!bounceMotionEnabled()||visit.walking||state.rolled||panel.open||document.hidden||highway.mode==='returning',space:input.handbrake,speed:state.speed});
    if(yarisMode==='stopped')bounceClock=0;else bounceClock+=dt;
    music.setActive(yarisMode!=='stopped');
    vehicle.userData.rollAngle+=state.speed*dt/(activeCar==='bt7'?.415:powertrainSpec(activeCar).tyreRadius);
    if(activeCar==='bt7'){const phase=vehicle.userData.trackPhases;vehicle.userData.updateTracks(phase.left+(state.speed-(state.yawRate||0)*.98)*dt,phase.right+(state.speed+(state.yawRate||0)*.98)*dt);}
    syncVehicle();walkerModel.visible=visit.walking;if(visit.walking){walkerModel.position.set(visit.walker.x,visit.walker.y,visit.walker.z);walkerModel.rotation.y=visit.walker.heading;}highwayStats=highway.animate(state,dt,bounceClock,yarisMode!=='stopped',bounceMotionEnabled());syncSceneRoute(highway.mode,townPose);
    $('tunnel-fade').style.opacity=String(highwayStats.highwayFade);
    $('impact-flash').style.opacity=reduceMotion.matches?'0':String(+highwayStats.highwayImpact*.35);
    positionCamera(false,dt);updateTankTurret(dt);cameraOcclusion.update(camera,activePose(),dt);
    for(let i=0;i<tokens.length;i++){
      const t=tokens[i];if(t.collected)continue;
      t.g.rotation.y=elapsed*.8+t.phase;t.g.position.y=1.45+Math.sin(elapsed*2+t.phase)*.12;
      if(highway.mode==='city'&&townPose.index==null&&Math.hypot(t.x-localTown(state).x,t.z-localTown(state).z)<1.8){t.collected=true;t.g.visible=false;$('token-'+i).setAttribute('fill','#d7e2e7');
        const count=tokens.filter(t=>t.collected).length;$('progress').textContent=count+' / 8';
        if(count===8){$('quest').textContent='存档完整了。继续随便逛逛吧。';toast('8 / 8 · 存档找齐了！「甭写了，兜风去。」');}
        else toast('存档碎片 +1 · '+count+' / 8');
      }
    }
    for(const {f,base,phase} of fish){f.position.x=base.x+Math.sin(elapsed*.7+phase)*.28;f.position.y=base.y+Math.sin(elapsed+phase)*.1;}
    uiTime+=dt;if(uiTime>.08){updateUI();uiTime=0;}
    renderer.render(scene,camera);
  }
  requestAnimationFrame(frame);
}
