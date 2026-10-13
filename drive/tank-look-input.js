// BT-7 viewing owns its own gesture surface; canvas buttons remain gear controls.
// Pointer lock starts only from the explicit button. Touch and unsupported
// browsers retain the drag pad. Escape/loss never automatically re-locks.
export function createTankLookInput({canvas,button,pad,enabled,blocked,onMove,onActivate,onLost,onError,doc=canvas.ownerDocument,now=()=>performance.now()}){
 let locked=false,wanted=false,pointer=null,lastX=0,lastY=0,generation=0,unlockAt=-Infinity;
 const handlers=[];const on=(o,n,f)=>{o.addEventListener(n,f);handlers.push(()=>o.removeEventListener(n,f));};
 function status(){button.setAttribute('aria-pressed',String(locked));button.textContent=locked?'环视中 · Esc 释放':'鼠标环视';}
 function releasePad(){if(pointer!==null){const id=pointer;pointer=null;if(pad.hasPointerCapture?.(id))pad.releasePointerCapture(id);}}
 function suspend(){generation++;wanted=false;releasePad();if(doc.pointerLockElement===canvas)doc.exitPointerLock();}
 on(button,'click',()=>{if(!enabled()||blocked())return;if(locked){suspend();return;}if(wanted)return;onActivate();canvas.focus({preventScroll:true});if(!canvas.requestPointerLock){onError?.();return;}wanted=true;const ticket=++generation;try{const result=canvas.requestPointerLock();result?.catch(()=>{if(ticket===generation){wanted=false;onError?.();}});}catch{wanted=false;onError?.();}});
 on(doc,'pointerlockchange',()=>{const next=doc.pointerLockElement===canvas,was=locked;locked=next;if(next&&(!wanted||!enabled()||blocked())){wanted=false;doc.exitPointerLock();}else if(!next&&was){const unexpected=wanted;wanted=false;if(unexpected){unlockAt=now();if(!blocked())onLost?.();}}status();});
 on(doc,'pointerlockerror',()=>{if(wanted){wanted=false;onError?.();}});
 on(doc,'mousemove',e=>{if(locked&&wanted&&enabled()&&!blocked())onMove(e.movementX||0,e.movementY||0);});
 on(pad,'pointerdown',e=>{if(!enabled()||blocked()||pointer!==null||e.button!==0)return;e.preventDefault();pointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;pad.setPointerCapture(pointer);onActivate();});
 on(pad,'pointermove',e=>{if(e.pointerId!==pointer||!enabled()||blocked())return;e.preventDefault();onMove(e.clientX-lastX,e.clientY-lastY);lastX=e.clientX;lastY=e.clientY;});
 const end=e=>{if(e.pointerId===pointer)releasePad();};for(const type of['pointerup','pointercancel','lostpointercapture'])on(pad,type,end);
 status();return{suspend,get locked(){return locked;},justUnlocked(){return now()-unlockAt<180;},dispose(){suspend();for(const off of handlers)off();}};
}
