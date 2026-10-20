// Use WebGAL's documented runtime perform interface, never rewrite auto flags/timers.
export function createVoiceAutoGate(engine, cancelVoice, {name='koto-preview-voice-wait'}={}) {
  const controller=engine.gameplay.performController;
  let registered=false,disposing=false;
  const supported=typeof controller?.arrangeNewPerform==='function' && typeof controller?.unmountPerform==='function';
  function setActive(active) {
    if(!supported||disposing||active===registered)return;
    registered=active;
    if(!active){controller.unmountPerform(name,true);return;}
    controller.arrangeNewPerform({performName:name,duration:600000,isHoldOn:false,skipNextCollect:true,
      startFunction:()=>{},stopFunction:()=>{registered=false;},
      blockingNext:()=>false,blockingAuto:()=>registered&&!engine.gameplay.skipAnimation,
      goNextWhenOver:false}, {command:0,commandRaw:'',content:'',args:[],sentenceAssets:[],subScene:[],inlineComment:'',isLineBreakHolder:false}, false);
  }
  // The first user-next may only complete the typewriter. Context changes and
  // actual skip/menu lifecycle updates, rather than raw clicks, stop the voice.
  function dispose(){setActive(false);disposing=true;}
  return {setActive,dispose,supported};
}
