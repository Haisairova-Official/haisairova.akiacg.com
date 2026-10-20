import {W as engine} from '../assets/index-7aa7ac9230b2.js';
import {createChapterVoiceController,chapterVoiceContext,VOICE_ENABLED_KEY,VOICE_VOLUME_KEY} from './chapter1-voice-core.mjs?v=7aa7ac9230b2';
import {createVoiceAutoGate} from './voice-preview-auto.mjs?v=7aa7ac9230b2';
import {mountStageControl} from './chapter1-voice-ui.mjs?v=7aa7ac9230b2';
import {cancelVoicePreload} from './chapter1-preload.mjs?v=7aa7ac9230b2';

// Development previews keep their existing isolated controls. Formal scripts stay byte-identical.
if(!/\/preview-[^/]+\.html$/.test(location.pathname)) {
  const panel=document.createElement('aside');panel.id='koto-voice-controls';panel.setAttribute('aria-label','第一章日语配音');
  const toggle=document.createElement('button');toggle.id='koto-voice-toggle';toggle.type='button';toggle.setAttribute('role','switch');
  const details=document.createElement('details');
  const summary=document.createElement('summary');summary.textContent='配音设置';
  const note=document.createElement('p');note.textContent='进入每节前可选择是否一起预加载配音，播放仍逐句进行。关闭立即停止并取消配音下载，不影响背景音乐和音效。';
  const label=document.createElement('label');label.textContent='独立配音音量 ';
  const volume=document.createElement('input');volume.type='range';volume.min='0';volume.max='1';volume.step='.05';volume.setAttribute('aria-label','独立配音音量');
  label.append(volume);
  const status=document.createElement('p');status.id='koto-voice-status';status.setAttribute('aria-live','polite');
  details.append(summary,note,label,status);panel.append(toggle,details);
  const stageMount=mountStageControl(panel);
  let borrowedSound=null,soundParent=null;
  const syncSoundCheck=()=>{
    const sound=document.getElementById('koto-sound-check');
    if(sound&&sound.parentElement!==panel){
      borrowedSound=sound;soundParent=sound.parentElement;
      sound.setAttribute('aria-label','声音检查（原游戏测试音）');panel.insertBefore(sound,details);
    }
  };
  for(const event of ['click','pointerdown','pointerup','touchstart','touchend','keydown','keyup'])panel.addEventListener(event,e=>e.stopPropagation());
  let voice;
  const gate=createVoiceAutoGate(engine,()=>voice?.interrupt(),{name:'koto-chapter1-voice-wait'});
  let storage;try{storage=window.localStorage;}catch{}
  voice=createChapterVoiceController({baseURL:document.baseURI,storage,onActivity:gate.setActive,onChange:state=>{
    toggle.setAttribute('aria-checked',String(state.enabled));
    toggle.textContent=state.enabled?'配音：开':'配音：关';
    toggle.setAttribute('aria-label',state.enabled?'配音下载与播放：开':'配音下载与播放：关');
    volume.value=String(state.volume);volume.disabled=!state.enabled;
    const message=state.enabled?(state.status==='unavailable'?'此句配音暂不可用，剧情仍可继续。可关闭后重新开启再试。':'第一章日语配音 · 预加载后逐句播放 · 音量独立调节'):'已关闭：不下载、不播放配音。';
    if(status.textContent!==message)status.textContent=message;
  }});
  toggle.addEventListener('click',()=>{const next=!voice.snapshot().enabled;voice.setEnabled(next);if(!next)cancelVoicePreload();});
  volume.addEventListener('input',()=>voice.setVolume(volume.value));
  let focused=true;
  const panelModalOpen=()=>!!document.querySelector('[data-koto-preload], #koto-chapters:not([hidden]), [class*="_Backlog_main_"]:not([class*="_Backlog_main_out_"])');
  const menuOpen=()=>panelModalOpen()||!!document.querySelector('[class*="_Menu_main_"]');
  const settingsOpen=()=>!!document.querySelector('[class*="_Menu_main_"] [class*="_Options_main_"]');
  const blocked=()=>!focused||document.hidden||engine.gameplay.skipAnimation||engine.sceneManager.lockSceneWrite||
    menuOpen()||!!document.querySelector('#playVideoElement, #koto-chapter-entry');
  let latest=engine.stageManager.getViewStageState();
  const update=state=>{
    latest=state;
    stageMount.update();syncSoundCheck();
    // Voice controls belong to the title/settings lifecycle, never the story.
    panel.hidden=panelModalOpen()||!(settingsOpen()||(!menuOpen()&&document.getElementById('koto-chapter-entry')));
    if(panel.hidden)details.open=false;
    voice.update(chapterVoiceContext(engine.sceneManager.sceneData,state,{baseURL:document.baseURI,blocked:blocked()}));
  };
  const unsubscribe=engine.stageManager.subscribe(update);
  const observer=new MutationObserver(records=>{
    if(records.every(record=>panel.contains(record.target)))return;
    update(latest);
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
  const visibility=()=>update(latest);
  const interrupt=()=>voice.interrupt();
  const blur=()=>{focused=false;update(latest);};
  const focus=()=>{focused=true;update(latest);};
  const pageshow=()=>update(latest);
  const storageChange=event=>{
    if(event.key===VOICE_ENABLED_KEY){voice.setEnabled(event.newValue!=='off',{persist:false});if(event.newValue==='off')cancelVoicePreload();}
    if(event.key===VOICE_VOLUME_KEY)voice.setVolume(event.newValue??'.8',{persist:false});
  };
  const choice=event=>voice.setEnabled(event.detail.enabled,{persist:false});
  document.addEventListener('koto-voice-choice',choice);
  document.addEventListener('visibilitychange',visibility);
  document.addEventListener('koto-open-chapters',interrupt);
  document.addEventListener('koto-cancel-scene-load',interrupt);
  window.addEventListener('storage',storageChange);
  window.addEventListener('pagehide',interrupt);
  window.addEventListener('pageshow',pageshow);
  window.addEventListener('blur',blur);window.addEventListener('focus',focus);
  update(latest);
  // Read-only diagnostics for release QA, with explicit lifecycle cleanup.
  window.kotonohaChapterVoice={inspect:voice.snapshot,replayCurrent({defer=false}={}){
    update(latest);
    const replay=voice.prepareReplay();if(!replay)return false;
    // The mobile native control closes its own menu before the next frame.
    // The captured request cannot replay a different cue after a scene change.
    if(defer)window.requestAnimationFrame(()=>{update(latest);replay.run();});
    else replay.run();
    return true;
  },dispose(){
    unsubscribe();observer.disconnect();stageMount.dispose();gate.dispose();voice.dispose();
    if(borrowedSound&&soundParent)soundParent.append(borrowedSound);panel.remove();
    document.removeEventListener('koto-voice-choice',choice);
    document.removeEventListener('visibilitychange',visibility);
    document.removeEventListener('koto-open-chapters',interrupt);
    document.removeEventListener('koto-cancel-scene-load',interrupt);
    window.removeEventListener('storage',storageChange);window.removeEventListener('pagehide',interrupt);
    window.removeEventListener('pageshow',pageshow);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus);
  }};
}
