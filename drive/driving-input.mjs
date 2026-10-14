export const drivingCode=e=>e.code||(e.key==='Control'?(e.location===2?'ControlRight':'ControlLeft'):'');
export const DRIVING_KEYS=new Set(['ShiftLeft','ShiftRight','ControlLeft','ControlRight','KeyW','KeyA','KeyS','KeyD','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
// Physical keyboard state is separate from pointer/touch buttons. Clearing a
// menu must not let held-key autorepeat restart the car, or lock out a future
// keyboard press because a touch pointer was released while the menu was open.
export function createInputGuard(){
 const physical=new Set(),blocked=new Set();
 return {
  keydown(code,repeat=false){
   if(!DRIVING_KEYS.has(code))return true;
   if(blocked.has(code)){
    if(repeat||physical.has(code))return false;
    blocked.delete(code); // Fresh keydown after focus loss; its keyup was unobservable.
   }
   physical.add(code);return true;
  },
  keyup(code){physical.delete(code);blocked.delete(code);},
  block(){for(const code of physical)blocked.add(code);},
  blur(){for(const code of physical)blocked.add(code);physical.clear();}
 };
}

// A click just after Ctrl-down may precede the next physics sample. Retain it
// briefly, but shift only after the physical clutch has actually disengaged.
export function createShiftBuffer(){let pending=null;return{
 request(direction,state,held){if(state.transmission==='mt'&&state.clutch<.65&&held){pending={direction,time:.25};return true;}return false;},
 step(dt,state,held){if(!pending)return null;pending.time-=dt;if(!held||state.transmission!=='mt'||pending.time<0){pending=null;return null;}if(state.clutch>=.65){const d=pending.direction;pending=null;return d;}return null;},
 clear(){pending=null;}
};}

// Independent physical sources: releasing a touch does not release a held key,
// and vice versa. The aggregate remains the existing read-only key Set for physics.
export function createInputSources(){const keyboard=new Set(),pointers=new Map(),keys=new Set();const refresh=code=>{if(keyboard.has(code)||[...pointers.values()].includes(code))keys.add(code);else keys.delete(code);};return{keys,pointers,keydown(code){keyboard.add(code);refresh(code);},keyup(code){keyboard.delete(code);refresh(code);},pointerdown(id,code){const old=pointers.get(id);pointers.set(id,code);if(old)refresh(old);refresh(code);},pointerup(id){const old=pointers.get(id);pointers.delete(id);if(old)refresh(old);return old;},clear(){keyboard.clear();pointers.clear();keys.clear();}};}
