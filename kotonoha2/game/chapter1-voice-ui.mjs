// UI belongs to WebGAL's transformed 2560x1440 root, including portrait rotation.
export function stageControlLayout({width=2560,height=1440,scale=1,modal=false}={}) {
  scale=Number.isFinite(scale)&&scale>0?scale:1;
  const uiScale=Math.max(1,1/scale);
  return {scale:uiScale,width:Math.min(modal?680:380,width*(modal?.88:.70)/uiScale),
    maxHeight:height*(modal?.88:.52)/uiScale};
}
export function mountStageControl(element,{modal=false,document=globalThis.document,window=globalThis.window}={}) {
  const root=document.getElementById('root');
  if(!root)throw Error('Game viewport unavailable');
  root.append(element);
  const update=()=>{
    if(element.parentElement!==root)root.append(element);
    const transform=window.getComputedStyle(root).transform;
    const values=transform.match(/^matrix(?:3d)?\(([^)]+)\)$/)?.[1].split(',').map(Number);
    const scale=values?Math.hypot(values[0],values[1]):1;
    const layout=stageControlLayout({width:root.clientWidth||2560,height:root.clientHeight||1440,scale,modal});
    element.style.setProperty('--koto-voice-ui-scale',String(layout.scale));
    element.style.setProperty('--koto-voice-ui-width',layout.width+'px');
    element.style.setProperty('--koto-voice-ui-height',layout.maxHeight+'px');
  };
  const observer=typeof MutationObserver==='function'?new MutationObserver(update):null;
  observer?.observe(root,{attributes:true,attributeFilter:['style']});
  window.addEventListener('resize',update);window.addEventListener('orientationchange',update);update();
  return {update,dispose(){observer?.disconnect();window.removeEventListener('resize',update);window.removeEventListener('orientationchange',update);}};
}
