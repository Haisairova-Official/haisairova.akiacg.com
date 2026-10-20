import {createVoicePlayer} from './voice-preview-player.mjs';

export const VOICE_ENABLED_KEY='kotonoha.chapter1.voice.enabled.v1';
export const VOICE_VOLUME_KEY='kotonoha.chapter1.voice.volume.v1';
const formalScene=/^chapter1-[1-7]-(?:ja|zh)-r11-owl\.txt$/;
const normalText=text=>String(text??'').replace(/\u00a0/g,' ').trim();
const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));

export function sourceParagraphId(sentenceList,index) {
  if(!Array.isArray(sentenceList)||!Number.isInteger(index)||index<0||index>=sentenceList.length)return '';
  // The original unquoted setVar IDs are parsed as arithmetic (NaN) by WebGAL.
  // Read the authored label from the unchanged parsed script, not mutable GameVar.
  for(let i=index;i>=0;i--){
    const sentence=sentenceList[i];
    if(sentence?.commandRaw==='label'){
      const label=String(sentence.content??'').trim();
      return /^KOTO-C1-[1-7]-l_\d+$/.test(label)?label:'';
    }
  }
  return '';
}

export function chapterVoiceContext(scene,state,{baseURL,blocked=false}={}) {
  const current=scene.currentScene??{};
  const index=Number(scene.currentSentenceId)-1;
  const sentence=current.sentenceList?.[index];
  let name='';try{name=new URL(current.sceneUrl,baseURL).pathname.split('/').at(-1);}catch{}
  return {scene:name,line:sentence?.startLine??index,
    paragraphId:sourceParagraphId(current.sentenceList,index),
    text:state.showText,dialogKey:state.currentDialogKey,blocked,
    isDialogue:/^[^\x00-\x7f]/.test(sentence?.commandRaw??'')};
}

export function resolveVoiceCue(manifest,context) {
  const scene=manifest.scenes?.[context.scene];
  const line=scene?.lines?.[String(context.line)];
  if(!line||line.paragraphId!==context.paragraphId||normalText(line.text)!==normalText(context.text))return [];
  return line.taskIds;
}

export function createChapterVoiceController({baseURL,storage,fetcher=fetch,makePlayer=createVoicePlayer,
  playerOptions={},onActivity=()=>{},onChange=()=>{},timeoutMs=8000}) {
  const read=(key,fallback)=>{try{return storage?.getItem(key)??fallback;}catch{return fallback;}};
  let enabled=read(VOICE_ENABLED_KEY,'on')!=='off';
  let volume=clamp(read(VOICE_VOLUME_KEY,'.8'));
  let manifest=null,player=null,request=null,context=null,lastKey='',attemptedKey='',serial=0,disposed=false,status='idle';
  const write=(key,value)=>{try{storage?.setItem(key,value);}catch{/* Private browsing must not break playback. */}};
  const snapshot=()=>({enabled,volume,status,manifestLoaded:!!manifest,playing:!!player?.stats().playing});
  const notify=next=>{status=next;onChange(snapshot());};
  const eligible=()=>enabled&&!disposed&&context&&!context.blocked&&context.isDialogue&&formalScene.test(context.scene);
  function interrupt() {
    serial++;
    request?.abort();request=null;
    player?.cancelPending();onActivity(false);
    notify(enabled?'idle':'disabled');
  }
  async function playCurrent() {
    if(!eligible())return false;
    const token=serial;
    try {
      if(!manifest) {
        const controller=new AbortController();request=controller;
        const timer=setTimeout(()=>controller.abort(),timeoutMs);
        onActivity(true);notify('loading');
        try {
          const response=await fetcher(new URL('./game/chapter1-voice-manifest.json',baseURL).href,
            {signal:controller.signal,cache:'no-cache'});
          if(!response.ok)throw Error('Voice manifest unavailable');
          const data=await response.json();
          if(token!==serial||!eligible())return false;
          if(data.available!==938||data.pending!==0||data.items?.length!==938||!data.scenes)throw Error('Incomplete voice manifest');
          manifest=data;
        } finally {clearTimeout(timer);if(request===controller)request=null;}
      }
      if(token!==serial||!eligible())return false;
      const ids=resolveVoiceCue(manifest,context);
      if(!ids.length){onActivity(false);notify('idle');return false;}
      if(!player)player=makePlayer({manifest,baseURL,fetcher,maxCacheBytes:16*1024*1024,...playerOptions,onActivity,
        onStatus:event=>{
          if(!enabled||disposed)return;
          if(event.type==='playing')notify('playing');
          else if(['blocked','unavailable','playback-error','playback-timeout'].includes(event.type))notify('unavailable');
        }});
      // No chapter preload: this is the current Japanese line or Chinese paragraph queue only.
      return await player.playQueue(ids,volume);
    } catch(error) {
      if(token===serial){onActivity(false);notify(enabled?'unavailable':'disabled');}
      return false;
    }
  }
  function update(next) {
    const key=`${next.scene}|${next.line}|${next.dialogKey}|${next.paragraphId}|${next.text}`;
    const changed=key!==lastKey;
    const newlyBlocked=next.blocked&&!context?.blocked;
    context=next;
    if(changed||newlyBlocked){interrupt();lastKey=key;}
    // A blocked new cue still gets its first attempt after the lock/menu clears.
    // A cue already interrupted by a menu must not restart without an explicit replay.
    if(eligible()&&attemptedKey!==key){attemptedKey=key;void playCurrent();}
  }
  function prepareReplay() {
    if(!context||!context.isDialogue||!formalScene.test(context.scene))return null;
    const key=lastKey,allowed=enabled&&!disposed;
    return {run(){
      if(!allowed||lastKey!==key||!eligible())return false;
      interrupt();attemptedKey=key;void playCurrent();return true;
    }};
  }
  function replayCurrent(){const replay=prepareReplay();if(!replay)return false;replay.run();return true;}
  function setEnabled(value,{persist=true}={}) {
    const next=!!value;
    if(persist)write(VOICE_ENABLED_KEY,next?'on':'off');
    if(next===enabled)return;
    enabled=next;interrupt();
    if(!enabled){player?.dispose();player=null;}
    else if(eligible()){attemptedKey=lastKey;void playCurrent();}
  }
  function setVolume(value,{persist=true}={}) {
    volume=clamp(value);if(persist)write(VOICE_VOLUME_KEY,String(volume));
    player?.setVolume(volume);onChange(snapshot());
  }
  function dispose(){disposed=true;interrupt();player?.dispose();player=null;}
  notify(enabled?'idle':'disabled');
  return {update,setEnabled,setVolume,interrupt,dispose,snapshot,prepareReplay,replayCurrent};
}
