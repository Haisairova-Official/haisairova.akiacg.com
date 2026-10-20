import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {createVoicePreloadSession} from '../game/chapter1-preload-core.mjs';
const bytes=new Uint8Array([1,2,3,4]);
const hash=createHash('sha256').update(bytes).digest('hex');
const actual=JSON.parse(readFileSync(new URL('../game/chapter1-voice-manifest.json',import.meta.url)));
const manifest={...actual,items:actual.items.map(item=>({...item,sha256:hash}))};
const engine=readFileSync(new URL('../assets/index-7fd3a993af70.js',import.meta.url),'utf8');
const source=engine.slice(engine.indexOf('function kotoAbortError()'),engine.indexOf('function Q4('))
 .replace('import("../game/chapter1-preload.mjs")','Promise.resolve(voiceExtension)');
const pause=()=>new Promise(r=>setTimeout(r,2));
async function until(fn){const deadline=Date.now()+4000;while(!fn()&&Date.now()<deadline)await pause();assert.ok(fn(),'loader condition did not settle');}
function setup({choice=true,media}={}){
 const requests=[],buttons=[],progress=[],base=['game/background/test.png','game/bgm/test.mp3'];
 let chosen=choice,askCount=0,resolveChoice,session,removed=false,active=0,maxActive=0,ready=false,report=()=>{};
 const events=new EventTarget();
 const document={baseURI:'https://game.test/kotonoha2/',addEventListener:(...x)=>events.addEventListener(...x),removeEventListener:(...x)=>events.removeEventListener(...x),dispatchEvent:e=>events.dispatchEvent(e),
  createElement:()=>{const b={style:{},dataset:{},textContent:'',remove(){b.removed=true;}};buttons.push(b);return b;}};
 const ui={el:{dataset:{},append(){},remove(){removed=true;}},status:{},progress:{max:1,set value(v){this.current=v;progress.push([v,this.max]);},get value(){return this.current;}}};
 const prepare=async(chapter,{signal})=>{
  askCount++;
  if(chosen===null)await new Promise((resolve,reject)=>{resolveChoice=v=>{chosen=v;signal.removeEventListener('abort',abort);resolve();};const abort=()=>reject(new DOMException('cancelled','AbortError'));signal.addEventListener('abort',abort,{once:true});});
  const notify=value=>{chosen=value;report();const event=new Event('koto-voice-choice');event.detail={enabled:value};events.dispatchEvent(event);};
  session=createVoicePreloadSession({chapter,manifest:chosen?manifest:undefined,enabled:chosen,cryptoProvider:webcrypto,onEnabledChange:notify});
  return {prepare:async()=>session,setProgressReporter:fn=>report=fn,markReady:()=>ready=true,dispose:()=>session.dispose()};
 };
 const fetcher=async(url,options={})=>{
  const path=String(url);requests.push({path,options});
  if(path.endsWith('chapter-assets.json'))return {ok:true,json:async()=>({'1-1':base,'2-1':base})};
  active++;maxActive=Math.max(maxActive,active);
  if(media)return media(path,options,()=>active--);
  return {ok:true,arrayBuffer:async()=>{await pause();active--;return bytes.buffer;}};
 };
 const context={pM:new Set(),v1:new Map(),jv:undefined,voiceExtension:{prepareChapterVoice:prepare},Oye:()=>ui,document,
  window:{kotonohaChapterVoicePreloadReady:()=>ready},navigator:{},fetch:fetcher,URL,AbortController,DOMException,Event,Promise,setTimeout,clearTimeout,console:{warn(){}}};
 runInNewContext(source,context);
 return {run:(signal,chapter='1-1')=>context.Rye(`game/scene/chapter${chapter}-ja-r11-owl.txt`,signal),requests,buttons,progress,ui,base,
  choose:v=>resolveChoice(v),disable:()=>session.disable(),get askCount(){return askCount;},get removed(){return removed;},get maxActive(){return maxActive;},get completed(){return context.pM.has('1-1');}};
}
test('existing loader waits for choice before any network; OFF loads only assets and reuses completion',async()=>{
 const h=setup({choice:null}),controller=new AbortController();const job=h.run(controller.signal);
 await until(()=>h.askCount===1);assert.equal(h.requests.length,0);h.choose(false);await job;
 assert.equal(h.requests.filter(r=>r.path.includes('/vocal/chapter1/')).length,0);assert.equal(h.requests.length,3);assert.equal(h.completed,true);
 await h.run(controller.signal);assert.equal(h.askCount,1);assert.equal(h.requests.length,3);
});
test('existing three-slot queue interleaves voice/assets and reports combined completion',async()=>{
 const h=setup();await h.run(new AbortController().signal);
 const media=h.requests.slice(1);assert.equal(media.length,81);assert.equal(h.maxActive,3);
 assert.ok(media.slice(0,3).some(r=>r.path.includes('/vocal/chapter1/')));assert.ok(media.slice(0,3).some(r=>r.path.includes('/background/')));
 assert.equal(new Set(media.map(r=>r.path)).size,81);assert.equal(h.ui.progress.max,81);assert.equal(h.ui.progress.value,81);assert.equal(h.removed,true);
});
test('cancel aborts current jobs even if fetch ignores signal, and never marks ready',async()=>{
 const h=setup({media:()=>new Promise(()=>{})}),controller=new AbortController();const job=h.run(controller.signal);
 await until(()=>h.requests.length===4);controller.abort();await assert.rejects(job,{name:'AbortError'});
 assert.equal(h.requests.length,4);assert.ok(h.requests.slice(1).every(r=>r.options.signal.aborted));assert.equal(h.completed,false);assert.equal(h.removed,true);
});
test('OFF aborts voice-only jobs, prevents remaining voice starts, and lets assets finish',async()=>{
 const h=setup({media:(path,options,finish)=>path.includes('/vocal/chapter1/')?new Promise(()=>{}):Promise.resolve({ok:true,arrayBuffer:async()=>{finish();return bytes.buffer;}})});
 const job=h.run(new AbortController().signal);await until(()=>h.requests.some(r=>r.path.includes('/vocal/chapter1/')));
 const count=h.requests.filter(r=>r.path.includes('/vocal/chapter1/')).length;h.disable();await job;
 const voice=h.requests.filter(r=>r.path.includes('/vocal/chapter1/'));assert.equal(voice.length,count);assert.ok(voice.every(r=>r.options.signal.aborted));
 assert.equal(h.ui.progress.max,2);assert.equal(h.ui.progress.value,2);assert.equal(h.completed,true);
});
test('voice hash failure remains incomplete and existing retry reloads only the failed file',async()=>{
 let failedPath='';let corrupted=true;
 const h=setup({media:async(path,options,finish)=>({ok:true,arrayBuffer:async()=>{finish();if(path.includes('/vocal/chapter1/')&&(!failedPath||path===failedPath)&&corrupted){failedPath=path;return new Uint8Array([0]).buffer;}return bytes.buffer;}})});
 const job=h.run(new AbortController().signal);await until(()=>h.buttons.some(b=>b.textContent==='重试加载'));
 assert.ok(h.ui.progress.value<h.ui.progress.max);assert.equal(h.completed,false);corrupted=false;
 h.buttons.find(b=>b.textContent==='重试加载').onclick();await job;
 assert.equal(h.requests.filter(r=>r.path===failedPath).length,2);assert.equal(h.ui.progress.value,81);
 for(const file of h.base)assert.equal(h.requests.filter(r=>r.path.endsWith(file)).length,1);
});
test('OFF at a voice failure resumes the original retry screen without hanging',async()=>{
 const h=setup({media:async(path,options,finish)=>({ok:true,arrayBuffer:async()=>{finish();return path.includes('/vocal/chapter1/')?new Uint8Array([0]).buffer:bytes.buffer;}})});
 const job=h.run(new AbortController().signal);await until(()=>h.buttons.some(b=>b.textContent==='重试加载'));h.disable();await job;
 assert.equal(h.ui.progress.value,2);assert.equal(h.ui.progress.max,2);assert.equal(h.removed,true);
});
test('cancel at choice is silent and a later entry can choose normally',async()=>{
 const h=setup({choice:null}),first=new AbortController();const a=h.run(first.signal);await until(()=>h.askCount===1);first.abort();await assert.rejects(a,{name:'AbortError'});assert.equal(h.requests.length,0);
 const b=h.run(new AbortController().signal);await until(()=>h.askCount===2);h.choose(false);await b;assert.equal(h.completed,true);
});
test('other chapters retain their existing asset-only loader and never ask a voice choice',async()=>{
 const h=setup();await h.run(new AbortController().signal,'2-1');assert.equal(h.askCount,0);assert.equal(h.requests.length,3);assert.equal(h.ui.progress.max,2);
});

const preloadUI=readFileSync(new URL('../game/chapter1-preload.mjs',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');
function uiSetup({saved,fetcher}={}){
 const values=new Map(saved?[['kotonoha.chapter1.voice.enabled.v1',saved]]:[]),requests=[],nodes=[],events=new EventTarget();
 class Element extends EventTarget {
  constructor(tag){super();this.tag=tag;this.childNodes=[];this.style={setProperty(){}};this.dataset={};this.hidden=false;nodes.push(this);}
  append(...children){for(const child of children){child.remove?.();child.parentElement=this;this.childNodes.push(child);}}
  prepend(child){child.remove?.();child.parentElement=this;this.childNodes.unshift(child);}
  remove(){if(this.parentElement)this.parentElement.childNodes=this.parentElement.childNodes.filter(n=>n!==this);this.parentElement=null;}
  setAttribute(){}removeAttribute(){}focus(){}get firstElementChild(){return this.childNodes[0];}
 }
 const root=new Element('root'),body=new Element('body');
 const document={baseURI:'https://game.test/kotonoha2/',createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),
  getElementById:id=>id==='root'?root:nodes.find(n=>n.id===id),dispatchEvent:e=>events.dispatchEvent(e)};
 const window={addEventListener(){},removeEventListener(){},localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}};
 const ui={el:new Element('section'),progress:new Element('progress'),status:new Element('div')};
 ui.el.append(new Element('heading'),ui.progress,ui.status,new Element('cancel'));body.append(ui.el);
 const context={document,window,createVoicePreloadSession,VOICE_ENABLED_KEY:'kotonoha.chapter1.voice.enabled.v1',
  mountStageControl:element=>{root.append(element);return{dispose(){}};},AbortController,DOMException,URL,Event,
  CustomEvent:class extends Event{constructor(type,{detail}){super(type);this.detail=detail;}},Promise,setTimeout,clearTimeout,
  fetch:async(url,options)=>{requests.push({url:String(url),options});return fetcher?fetcher(url,options):{ok:true,json:async()=>manifest};}};
 runInNewContext(preloadUI,context);
 return {context,root,ui,values,requests,nodes,prepare:signal=>context.prepareChapterVoice('1-1',{ui,signal}),
  confirm(){nodes.find(n=>n.id==='koto-confirm-preload').dispatchEvent(new Event('click'));},checkbox:()=>nodes.find(n=>n.id==='koto-preload-voice-choice')};
}
test('real choice UI is inside stage, defaults ON, and fetches nothing before explicit confirmation',async()=>{
 const h=uiSetup(),controller=new AbortController();const pending=h.prepare(controller.signal);
 assert.equal(h.ui.el.parentElement,h.root);assert.equal(h.checkbox().checked,true);assert.equal(h.requests.length,0);
 h.confirm();const setup=await pending;assert.equal(h.values.get('kotonoha.chapter1.voice.enabled.v1'),'on');assert.equal(h.requests.length,0);
 const session=await setup.prepare();assert.equal(h.requests.length,1);assert.equal(session.files().length,79);setup.dispose();h.ui.el.remove();
});
test('remembered OFF is shown before preload and no voice manifest is requested',async()=>{
 const h=uiSetup({saved:'off'});const pending=h.prepare(new AbortController().signal);assert.equal(h.checkbox().checked,false);
 h.confirm();const setup=await pending;const session=await setup.prepare();assert.equal(h.requests.length,0);assert.equal(session.files().length,0);setup.dispose();h.ui.el.remove();
});
test('OFF during a manifest fetch that ignores abort releases the loader without voice requests',async()=>{
 const h=uiSetup({fetcher:()=>new Promise(()=>{})});const pending=h.prepare(new AbortController().signal);h.confirm();const setup=await pending;
 const preparation=setup.prepare();assert.equal(h.requests.length,1);setup.disable();const session=await preparation;
 assert.equal(h.requests[0].options.signal.aborted,true);assert.equal(session.files().length,0);assert.equal(h.values.get('kotonoha.chapter1.voice.enabled.v1'),'off');setup.dispose();h.ui.el.remove();
});
test('cancel before confirmation rejects silently and preserves previous preference',async()=>{
 const h=uiSetup(),controller=new AbortController();const pending=h.prepare(controller.signal);controller.abort();await assert.rejects(pending,{name:'AbortError'});
 assert.equal(h.requests.length,0);assert.equal(h.values.size,0);h.ui.el.remove();
});
