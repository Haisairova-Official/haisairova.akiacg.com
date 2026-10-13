// Touch axes are independent of keyboard keys and of the BT-7 view gesture.
const clamp=(v,a=-1,b=1)=>Math.max(a,Math.min(b,v));
export function joystickAxes(dx,dy,radius,walking=false){
 const x=dx/Math.max(1,radius),y=dy/Math.max(1,radius),length=Math.hypot(x,y),n=Math.max(1,length),dead=.12;
 const curve=v=>Math.sign(v)*Math.pow(clamp((Math.abs(v)-dead)/(1-dead),0,1),1.3);
 if(!walking)return{x:clamp(x),y:0,steer:-curve(x)||0,walkRight:0,walkForward:0};
 const magnitude=Math.pow(clamp((length-dead)/(1-dead),0,1),1.3),unit=length||1;
 return{x:x/n,y:y/n,steer:0,walkRight:x/unit*magnitude,walkForward:-y/unit*magnitude};
}
export function createVirtualJoystick({pad,knob,blocked,walking=()=>false,onActivate=()=>{}}){
 let owner=null,rect=null,radius=1,axes=joystickAxes(0,0,1),active=false;const handlers=[];
 const on=(name,fn)=>{pad.addEventListener(name,fn);handlers.push(()=>pad.removeEventListener(name,fn));};
 function reset(){const id=owner;owner=null;active=false;axes=joystickAxes(0,0,1);pad.classList.remove('active');knob.style.transform='translate(0px,0px)';pad.setAttribute('aria-valuenow','0');if(id!==null&&pad.hasPointerCapture?.(id))pad.releasePointerCapture(id);}
 function move(e){if(e.pointerId!==owner)return;if(blocked()||e.clientX<rect.left-24||e.clientX>rect.right+24||e.clientY<rect.top-24||e.clientY>rect.bottom+24){reset();return;}e.preventDefault();axes=joystickAxes(e.clientX-(rect.left+rect.width/2),e.clientY-(rect.top+rect.height/2),radius,walking());knob.style.transform=`translate(${axes.x*radius}px,${axes.y*radius}px)`;pad.setAttribute('aria-valuenow',String(Math.round(-axes.steer*100)));}
 on('pointerdown',e=>{if(blocked()||owner!==null||e.button!==0)return;e.preventDefault();owner=e.pointerId;active=true;rect=pad.getBoundingClientRect();radius=Math.max(16,Math.min(rect.width,rect.height)/2-27);pad.classList.add('active');pad.setPointerCapture(owner);onActivate();move(e);});
 on('pointermove',move);for(const type of['pointerup','pointercancel','lostpointercapture'])on(type,e=>{if(e.pointerId===owner)reset();});
 reset();return{reset,get value(){return{...axes,active};},dispose(){reset();for(const off of handlers)off();}};
}
// A finger owns only the control it started on. Sliding off a pedal cancels it
// until a new press; it never transfers invisibly to another pedal.
export function bindHoldButtons({buttons,sources,blocked,onActivate=()=>{}}){
 const owners=new Map(),handlers=[];
 const paint=b=>b.classList.toggle('pressed',[...owners.values()].includes(b));
 function release(id){const b=owners.get(id);if(!b)return;owners.delete(id);sources.pointerup(id);paint(b);if(b.hasPointerCapture?.(id))b.releasePointerCapture(id);}
 for(const b of buttons){const on=(type,fn)=>{b.addEventListener(type,fn);handlers.push(()=>b.removeEventListener(type,fn));};
  on('pointerdown',e=>{if(e.button!==0||blocked(b.dataset.key)||owners.has(e.pointerId))return;e.preventDefault();owners.set(e.pointerId,b);b.setPointerCapture(e.pointerId);sources.pointerdown(e.pointerId,b.dataset.key);paint(b);onActivate();});
  on('pointermove',e=>{if(owners.get(e.pointerId)!==b)return;const r=b.getBoundingClientRect(),m=6;if(blocked(b.dataset.key)||e.clientX<r.left-m||e.clientX>r.right+m||e.clientY<r.top-m||e.clientY>r.bottom+m)release(e.pointerId);});
  for(const type of['pointerup','pointercancel','lostpointercapture'])on(type,e=>{if(owners.get(e.pointerId)===b)release(e.pointerId);});
 }
 return{reset(){for(const id of [...owners.keys()])release(id);},dispose(){this.reset();for(const off of handlers)off();},get size(){return owners.size;}};
}
export function composeTouchInput(base,axes,keys,direction,state,walking=false){
 const throttle=keys.has('TouchThrottle'),manual=state.transmission==='mt',reverse=throttle&&!manual&&direction<0;
 const steer=axes.active?axes.steer:base.steer;
 return{...base,steer,touchSteer:axes.active?axes.steer:0,forward:base.forward||throttle&&!reverse,reverse:base.reverse||reverse,brake:!!base.brake||keys.has('TouchBrake'),gearThrottle:throttle&&manual,
  ...(walking?{walkRight:axes.walkRight,walkForward:axes.walkForward}:{})};
}
export function canChangeTouchDirection(state,keys){return Math.max(Math.abs(state.speed||0),state.groundSpeed||0,Math.hypot(state.vx||0,state.vz||0))<.2&&!keys.has('TouchThrottle')&&!keys.has('KeyW')&&!keys.has('KeyS');}
