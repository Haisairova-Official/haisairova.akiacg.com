// This module has no Three.js, physics or audio dependency. The HTML and
// compositor-only sprite are already visible before these stages execute.
export function setLoadingStage(text){const el=document.getElementById('loading-stage');if(el)el.textContent=text;document.body.dataset.loadingStage=text;}
export const nextLoadingPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
export async function loadingStage(text){setLoadingStage(text);await nextLoadingPaint();}
export async function finishLoading(){
 setLoadingStage('准备好了');document.body.dataset.ready='true';
 const layer=document.getElementById('loading');layer?.setAttribute('aria-busy','false');layer?.classList.add('loading-complete');
 // Clear loading-time input before enabling controls. Opacity fades only after
 // the first real scene has rendered; the loader never controls game pause.
 await nextLoadingPaint();document.body.classList.remove('booting');
 if(layer){setTimeout(()=>{layer.hidden=true;},matchMedia('(prefers-reduced-motion: reduce)').matches?0:180);}
}
export function failLoading(error){
 const message=String(error?.message||error||'游戏模块未能载入');document.body.dataset.startupError=message;document.body.classList.add('booting');
 const layer=document.getElementById('loading');if(layer){layer.hidden=false;layer.classList.add('loading-failed');layer.setAttribute('aria-busy','false');}
 setLoadingStage('读取未完成');const note=document.getElementById('loading-error');if(note){note.textContent=message;note.hidden=false;}
 const retry=document.getElementById('loading-retry');if(retry){retry.hidden=false;retry.onclick=()=>location.reload();}
 document.getElementById('loading-return')?.removeAttribute('hidden');
}
