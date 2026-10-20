// Chapter 1 extends the existing loader's screen, queue, retries and cancellation.
import {createVoicePreloadSession} from './chapter1-preload-core.mjs';
import {VOICE_ENABLED_KEY} from './chapter1-voice-core.mjs';
import {mountStageControl} from './chapter1-voice-ui.mjs';
const sections={
 '1-1':{clips:79,bytes:12533406},'1-2':{clips:126,bytes:23517892},
 '1-3':{clips:188,bytes:39276126},'1-4':{clips:147,bytes:24175446},
 '1-5':{clips:57,bytes:13166036},'1-6':{clips:276,bytes:53825932},'1-7':{clips:65,bytes:12133430}
};
const ready=new Map();let active=null;
const storage=()=>{try{return window.localStorage;}catch{return undefined;}};
const isEnabled=()=>{try{return storage()?.getItem(VOICE_ENABLED_KEY)!=='off';}catch{return true;}};
function abortable(promise,signal){if(signal.aborted)return Promise.reject(abortError());return new Promise((resolve,reject)=>{const abort=()=>reject(abortError());signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});}
const abortError=()=>new DOMException('Chapter preload cancelled','AbortError');
function setChoice(enabled){try{storage()?.setItem(VOICE_ENABLED_KEY,enabled?'on':'off');}catch{}document.dispatchEvent(new CustomEvent('koto-voice-choice',{detail:{enabled}}));}
export function chapterVoicePreloadReady(chapter){return ready.get(chapter)===isEnabled();}
export function cancelVoicePreload(){ready.clear();active?.disable();}
window.kotonohaChapterVoicePreloadReady=chapterVoicePreloadReady;

export async function prepareChapterVoice(chapter,{ui,signal}) {
  if(!sections[chapter])throw Error('Unknown Chapter 1 subsection');
  if(signal?.aborted)throw abortError();
  // Reuse the existing progress, status, cancel button and screen, inside the stage.
  ui.el.style.cssText='';ui.el.className='koto-stage-modal';ui.el.dataset.kotoVoice='true';
  const card=document.createElement('div');card.className='koto-stage-card';
  card.append(...Array.from(ui.el.childNodes));ui.el.append(card);ui.content=card;
  ui.progress.style.cssText='width:100%;height:12px';
  const mount=mountStageControl(ui.el,{modal:true});
  const pagehide=()=>document.dispatchEvent(new Event('koto-cancel-scene-load'));window.addEventListener('pagehide',pagehide,{once:true});
  const originalRemove=ui.el.remove.bind(ui.el);ui.el.remove=()=>{window.removeEventListener('pagehide',pagehide);mount.dispose();originalRemove();};
  const prompt=document.createElement('div');prompt.className='koto-preload-choice-panel';
  const title=document.createElement('h2');title.textContent=`第 ${chapter} 节 · 配音预加载`;
  const label=document.createElement('label');label.className='koto-preload-choice';
  const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=isEnabled();checkbox.id='koto-preload-voice-choice';
  label.append(checkbox,document.createTextNode('下载并播放本节日语配音'));
  const note=document.createElement('p');note.textContent=`${sections[chapter].clips} 条配音，约 ${(sections[chapter].bytes/1048576).toFixed(1)} MiB。确认后与本节画面、音乐一起预加载；不勾选则不下载配音。仍按当前台词逐句播放。`;
  const confirm=document.createElement('button');confirm.type='button';confirm.id='koto-confirm-preload';confirm.textContent='确认并开始预加载';
  const heading=card.firstElementChild;if(heading)heading.hidden=true;
  prompt.append(title,label,note,confirm);card.prepend(prompt);ui.progress.hidden=true;ui.status.hidden=true;
  let choice=await new Promise((resolve,reject)=>{
    const abort=()=>{signal?.removeEventListener('abort',abort);reject(abortError());};
    signal?.addEventListener('abort',abort,{once:true});
    confirm.addEventListener('click',()=>{signal?.removeEventListener('abort',abort);resolve(checkbox.checked);},{once:true});
    checkbox.focus();
  });
  if(signal?.aborted)throw abortError();
  setChoice(choice);prompt.remove();if(heading)heading.hidden=false;ui.progress.hidden=false;ui.status.hidden=false;
  const off=document.createElement('button');off.type='button';off.textContent='关闭配音，继续加载画面与音乐';off.hidden=!choice;card.append(off);
  let session=null,manifestController=null,disposed=false,report=()=>{};
  const setup={
    async prepare(){
      if(disposed||signal?.aborted)throw abortError();
      if(session)return session;
      if(!choice){session=createVoicePreloadSession({chapter,enabled:false,onEnabledChange:()=>{}});return session;}
      const controller=new AbortController();manifestController=controller;
      const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(abort,15000);
      try{
        const response=await abortable(fetch(new URL('./game/chapter1-voice-manifest.json',document.baseURI),{signal:controller.signal,cache:'no-cache'}),controller.signal);
        if(!response.ok)throw Error('配音清单 HTTP '+response.status);
        const manifest=await abortable(response.json(),controller.signal);
        if(disposed||signal?.aborted)throw abortError();
        if(!choice){session=createVoicePreloadSession({chapter,enabled:false,onEnabledChange:()=>{}});return session;}
        session=createVoicePreloadSession({chapter,manifest,enabled:true,onEnabledChange:value=>{choice=value;off.hidden=!value;setChoice(value);report();}});
        return session;
      }catch(error){
        if(!choice&&!disposed&&!signal?.aborted){session=createVoicePreloadSession({chapter,enabled:false,onEnabledChange:()=>{}});return session;}
        error.kotoVoice=true;throw error;
      }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(manifestController===controller)manifestController=null;}
    },
    setProgressReporter(fn){report=fn;},
    disable(){choice=false;off.hidden=true;manifestController?.abort();if(session)session.disable();else setChoice(false);ready.clear();report();},
    markReady(){ready.set(chapter,choice);},
    dispose(){disposed=true;manifestController?.abort();session?.dispose();if(active===setup)active=null;}
  };
  off.addEventListener('click',()=>setup.disable());active=setup;return setup;
}
