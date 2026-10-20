import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {stageControlLayout} from '../game/chapter1-voice-ui.mjs';
import {createChapterVoiceController,resolveVoiceCue,sourceParagraphId,chapterVoiceContext,VOICE_ENABLED_KEY,VOICE_VOLUME_KEY} from '../game/chapter1-voice-core.mjs';
const bytes=new Uint8Array([1,2,3,4]);
const hash=createHash('sha256').update(bytes).digest('hex');
const item=id=>({taskId:id,status:'available_emotion_candidate',src:`game/vocal/chapter1/${id}.wav`,sha256:hash,durationSeconds:.1});
const manifest={available:938,pending:0,items:[item('a'),item('b'),...Array.from({length:936},(_,i)=>({taskId:'unused'+i,status:'pending'}))],scenes:{
 'chapter1-1-ja-r11-owl.txt':{lines:{10:{paragraphId:'p',text:'a',taskIds:['a']},11:{paragraphId:'p',text:'b',taskIds:['b']},12:{paragraphId:'n',text:'narration',taskIds:[]}}},
 'chapter1-1-zh-r11-owl.txt':{lines:{20:{paragraphId:'p',text:'中文',taskIds:['a','b']},21:{paragraphId:'p',text:'后半',taskIds:[]}}}
}};
const activeControllers=new Set();
afterEach(()=>{for(const controller of activeControllers)controller.dispose();activeControllers.clear();});
const delay=()=>new Promise(resolve=>setTimeout(resolve,12));
async function waitFor(predicate) {
 const deadline=Date.now()+2000;
 while(!predicate()&&Date.now()<deadline)await delay();
 assert.ok(predicate(),'asynchronous playback did not settle');
}
const ctx=(overrides={})=>({scene:'chapter1-1-ja-r11-owl.txt',line:10,paragraphId:'p',text:'a',dialogKey:'one',blocked:false,isDialogue:true,...overrides});
function setup({saved,fetcher,storage,timeoutMs}={}) {
 const values=new Map(Object.entries(saved||{})),requests=[],audios=[],revoked=[],activity=[];
 const controller=createChapterVoiceController({baseURL:'https://game.test/kotonoha2/',timeoutMs,
  storage:storage||{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},
  fetcher:async(url,options)=>{requests.push({url,options});if(fetcher)return fetcher(url,options);return url.endsWith('.json')?{ok:true,json:async()=>manifest}:{ok:true,arrayBuffer:async()=>bytes.buffer};},
  onActivity:value=>activity.push(value),playerOptions:{cryptoProvider:webcrypto,
   makeAudio:()=>{const a={loop:true,paused:false,play:async()=>{},pause(){this.paused=true;},removeAttribute(){},load(){}};audios.push(a);return a;},
   urls:{createObjectURL:()=>`blob:${audios.length}`,revokeObjectURL:url=>revoked.push(url)}}});
 activeControllers.add(controller);
 return {controller,values,requests,audios,revoked,activity,audioRequests:()=>requests.filter(x=>x.url.endsWith('.wav'))};
}
test('default ON loads only the current dialogue, never preloads the chapter',async t=>{
 const h=setup();t.after(()=>h.controller.dispose());assert.equal(h.controller.snapshot().enabled,true);assert.equal(h.requests.length,0);
 h.controller.update(ctx());await waitFor(()=>h.audios.length===1);assert.equal(h.requests.length,2);assert.equal(h.audioRequests().length,1);
 assert.equal(h.audios.length,1);assert.equal(h.audios[0].loop,false);h.controller.dispose();
});
test('saved OFF survives reload and causes zero manifest/audio requests',async()=>{
 for(let i=0;i<2;i++){const h=setup({saved:{[VOICE_ENABLED_KEY]:'off'}});h.controller.update(ctx());await delay();
  assert.equal(h.controller.snapshot().enabled,false);assert.equal(h.requests.length,0);h.controller.dispose();}
});
test('OFF aborts pending manifest and an ignored late response cannot start audio',async()=>{
 let release;const h=setup({fetcher:()=>new Promise(resolve=>release=resolve)});
 h.controller.update(ctx());h.controller.setEnabled(false);assert.equal(h.requests[0].options.signal.aborted,true);
 release({ok:true,json:async()=>manifest});await delay();assert.equal(h.audios.length,0);assert.equal(h.requests.length,1);
 assert.equal(h.activity.at(-1),false);h.controller.dispose();
});
test('OFF aborts pending audio; ON starts a fresh request and late old work cannot resurrect',async()=>{
 const releases=[];const h=setup({fetcher:(url)=>url.endsWith('.json')?Promise.resolve({ok:true,json:async()=>manifest}):new Promise(resolve=>releases.push(resolve))});
 h.controller.update(ctx());await delay();h.controller.setEnabled(false);
 assert.equal(h.audioRequests()[0].options.signal.aborted,true);
 h.controller.setEnabled(true);await waitFor(()=>releases.length===2);assert.equal(releases.length,2);
 releases[1]({ok:true,arrayBuffer:async()=>bytes.buffer});await waitFor(()=>h.audios.length===1);assert.equal(h.audios.length,1);
 releases[0]({ok:true,arrayBuffer:async()=>bytes.buffer});await delay();assert.equal(h.audios.length,1);
 h.controller.dispose();
});
test('OFF stops active playback, releases object URL, and prevents rest of Chinese queue',async()=>{
 const h=setup();h.controller.update(ctx({scene:'chapter1-1-zh-r11-owl.txt',line:20,text:'中文'}));await waitFor(()=>h.audios.length===1);
 const ended=h.audios[0].onended;h.controller.setEnabled(false);assert.equal(h.audios[0].paused,true);
 assert.equal(h.revoked.length,1);ended();await delay();assert.equal(h.audioRequests().length,1);h.controller.dispose();
});
test('repeated ON is idempotent, preferences persist, and repeated OFF remains network silent',async()=>{
 const h=setup({saved:{[VOICE_ENABLED_KEY]:'off'}});h.controller.update(ctx());h.controller.setEnabled(true);await waitFor(()=>h.audios.length===1);
 const count=h.requests.length;h.controller.setEnabled(true);h.controller.setEnabled(true);await delay();assert.equal(h.requests.length,count);
 assert.equal(h.values.get(VOICE_ENABLED_KEY),'on');h.controller.setEnabled(false);h.controller.setEnabled(false);
 h.controller.update(ctx({line:11,text:'b',dialogKey:'two'}));await delay();assert.equal(h.requests.length,count);
 assert.equal(h.values.get(VOICE_ENABLED_KEY),'off');h.controller.dispose();
});
test('menu, hidden, skip, or scene-lock blocking stops voice and does not replay on dismissal',async()=>{
 const h=setup();h.controller.update(ctx());await waitFor(()=>h.audios.length===1);h.controller.update(ctx({blocked:true}));
 assert.equal(h.audios[0].paused,true);const count=h.requests.length;
 h.controller.update(ctx());await delay();assert.equal(h.requests.length,count);
 h.controller.update(ctx({line:11,text:'b',dialogKey:'two'}));await waitFor(()=>h.audios.length===2);assert.equal(h.audios.length,2);h.controller.dispose();
});
test('blocked initial scene and other chapters/narration never request even manifest',async()=>{
 for(const context of [ctx({blocked:true}),ctx({scene:'chapter2-1-ja-c2-owl.txt'}),ctx({isDialogue:false})]){
  const h=setup();h.controller.update(context);await delay();assert.equal(h.requests.length,0);h.controller.dispose();
 }
});
test('language change cancels Japanese speech, Chinese queue is sequential, continuation never repeats',async()=>{
 const h=setup();h.controller.update(ctx());await waitFor(()=>h.audios.length===1);
 h.controller.update(ctx({scene:'chapter1-1-zh-r11-owl.txt',line:20,text:'中文',dialogKey:'zh'}));await waitFor(()=>h.audios.length===2);
 assert.equal(h.audios[0].paused,true);assert.equal(h.audios.length,2);h.audios[1].onended();await waitFor(()=>h.audios.length===3);assert.equal(h.audios.length,3);
 h.controller.update(ctx({scene:'chapter1-1-zh-r11-owl.txt',line:21,text:'后半',dialogKey:'zh2'}));await delay();
 assert.equal(h.audios[2].paused,true);assert.equal(h.audios.length,3);h.controller.dispose();
});
test('save/backlog jumps resolve original source line and not an incrementing session counter',async()=>{
 const h=setup();h.controller.update(ctx({line:11,text:'b',dialogKey:'loaded-save'}));await delay();
 assert.match(h.audioRequests()[0].url,/\/b\.wav$/);
 h.controller.update(ctx({dialogKey:'earlier-save'}));await delay();assert.match(h.audioRequests()[1].url,/\/a\.wav$/);h.controller.dispose();
});
test('wrong paragraph or text fails closed without speaking a different line',async()=>{
 for(const context of [ctx({paragraphId:'wrong'}),ctx({text:'wrong'}),ctx({line:999})]){
  const h=setup();h.controller.update(context);await delay();assert.equal(h.audioRequests().length,0);assert.equal(h.activity.at(-1),false);h.controller.dispose();
 }
});
test('manual skip cancels queue, releases auto hold and does not auto-restart same dialogue',async()=>{
 const h=setup();h.controller.update(ctx());await waitFor(()=>h.audios.length===1);h.controller.interrupt();
 assert.equal(h.audios[0].paused,true);assert.equal(h.activity.at(-1),false);
 h.controller.update(ctx());await delay();assert.equal(h.audios.length,1);h.controller.dispose();
});
test('manifest network failure releases auto wait; next dialogue can retry',async()=>{
 let fail=true;const h=setup({fetcher:async url=>{if(fail)throw Error('offline');return url.endsWith('.json')?{ok:true,json:async()=>manifest}:{ok:true,arrayBuffer:async()=>bytes.buffer};}});
 h.controller.update(ctx());await delay();assert.equal(h.activity.at(-1),false);assert.equal(h.controller.snapshot().status,'unavailable');
 fail=false;h.controller.update(ctx({line:11,text:'b',dialogKey:'retry'}));await waitFor(()=>h.audios.length===1);assert.equal(h.audios.length,1);h.controller.dispose();
});
test('inaccessible storage is nonfatal and independent volume persists/changes live audio only',async()=>{
 const h=setup({storage:{getItem(){throw Error('denied');},setItem(){throw Error('denied');}}});assert.equal(h.controller.snapshot().enabled,true);
 h.controller.update(ctx());await waitFor(()=>h.audios.length===1);h.controller.setVolume(.2);assert.equal(h.audios[0].volume,.2);h.controller.setEnabled(false);h.controller.dispose();
 const saved=setup();saved.controller.setVolume(.35);assert.equal(saved.values.get(VOICE_VOLUME_KEY),'0.35');saved.controller.dispose();
});
test('formal manifest has all 938 candidates and maps only byte-identical original scenes',()=>{
 const actual=JSON.parse(readFileSync(new URL('../game/chapter1-voice-manifest.json',import.meta.url)));
 assert.equal(actual.available,938);assert.equal(actual.pending,0);assert.equal(actual.finalApproved,0);assert.equal(actual.complete,false);
 const counts={ja:[],zh:[]};assert.equal(Object.keys(actual.scenes).length,14);
 for(const [name,scene] of Object.entries(actual.scenes)){
  assert.match(name,/^chapter1-[1-7]-(ja|zh)-r11-owl\.txt$/);
  const raw=readFileSync(new URL('../game/scene/'+name,import.meta.url));assert.equal(createHash('sha256').update(raw).digest('hex'),scene.sourceSHA256);
  const lines=raw.toString().split('\n');
  for(const [number,cue] of Object.entries(scene.lines)){
   const source=lines[Number(number)];assert.ok(source.includes(':'));
   if(source.startsWith(':'))assert.deepEqual(cue.taskIds,[]);
   assert.equal(source.slice(source.indexOf(':')+1).replace(/;[^;]*$/,'').split(' -')[0].trim(),cue.text);
   assert.deepEqual(resolveVoiceCue(actual,{scene:name,line:Number(number),paragraphId:cue.paragraphId,text:cue.text}),cue.taskIds);
   counts[scene.language].push(...cue.taskIds);
  }
 }
 for(const values of Object.values(counts)){assert.equal(values.length,938);assert.equal(new Set(values).size,938);}
 assert.equal(JSON.stringify(actual).includes('/workspace/'),false);assert.equal(JSON.stringify(actual).includes('productionActorID'),false);
});
test('rapid next/next/back aborts old downloads and only latest line can play',async()=>{
 const releases=[];const h=setup({fetcher:(url)=>url.endsWith('.json')?Promise.resolve({ok:true,json:async()=>manifest}):new Promise(resolve=>releases.push(resolve))});
 h.controller.update(ctx());await delay();
 h.controller.update(ctx({line:11,text:'b',dialogKey:'two'}));await delay();
 h.controller.update(ctx({dialogKey:'three'}));await delay();
 assert.equal(releases.length,3);assert.equal(h.audioRequests()[0].options.signal.aborted,true);assert.equal(h.audioRequests()[1].options.signal.aborted,true);
 for(const release of releases)release({ok:true,arrayBuffer:async()=>bytes.buffer});
 await waitFor(()=>h.audios.length===1);assert.equal(h.audios.length,1);assert.equal(h.audios[0].paused,false);h.controller.dispose();
});
test('advancing Chinese fragment while first clip plays cancels unplayed paragraph remainder',async()=>{
 const h=setup();h.controller.update(ctx({scene:'chapter1-1-zh-r11-owl.txt',line:20,text:'中文'}));await waitFor(()=>h.audios.length===1);
 const ended=h.audios[0].onended;
 h.controller.update(ctx({scene:'chapter1-1-zh-r11-owl.txt',line:21,text:'后半',dialogKey:'continued'}));
 ended();await delay();assert.equal(h.audioRequests().length,1);assert.equal(h.audios[0].paused,true);assert.equal(h.activity.at(-1),false);h.controller.dispose();
});
test('formal auto gate holds only current queue, allows skip, and releases on OFF/end',async()=>{
 const {createVoiceAutoGate}=await import('../game/voice-preview-auto.mjs');
 let perform=null,next,controller;const gateEngine={gameplay:{skipAnimation:false,performController:{
  arrangeNewPerform(p,script,sync){assert.equal(sync,false);perform=p;},
  unmountPerform(){const old=perform;perform=null;old?.stopFunction();}
 }},events:{userInteractNext:{on(fn){next=fn;},off(){next=null;}}}};
 const gate=createVoiceAutoGate(gateEngine,()=>controller?.interrupt(),{name:'formal-test'});
 const audios=[];
 controller=createChapterVoiceController({baseURL:'https://game.test/',onActivity:gate.setActive,
  fetcher:async url=>url.endsWith('.json')?{ok:true,json:async()=>manifest}:{ok:true,arrayBuffer:async()=>bytes.buffer},
  playerOptions:{cryptoProvider:webcrypto,makeAudio:()=>{const audio={play:async()=>{},pause(){},removeAttribute(){},load(){}};audios.push(audio);return audio;},urls:{createObjectURL:()=> 'blob:gate',revokeObjectURL(){}}}});
 activeControllers.add(controller);
 controller.update(ctx({scene:'chapter1-1-zh-r11-owl.txt',line:20,text:'中文'}));await waitFor(()=>audios.length===1);
 assert.equal(perform.blockingAuto(),true);assert.equal(perform.blockingNext(),false);
 audios[0].onended();await waitFor(()=>audios.length===2);assert.equal(perform.blockingAuto(),true);audios[1].onended();await delay();assert.equal(perform,null);
 controller.update(ctx());await delay();gateEngine.gameplay.skipAnimation=true;assert.equal(perform.blockingAuto(),false);gateEngine.gameplay.skipAnimation=false;
 assert.equal(next,undefined);assert.ok(perform);
 controller.update(ctx({line:11,text:'b',dialogKey:'actual-next'}));await waitFor(()=>audios.length===4);
 controller.setEnabled(false);controller.setEnabled(true);await delay();assert.ok(perform);controller.setEnabled(false);assert.equal(perform,null);
 gate.dispose();controller.dispose();
});

function parsedSource(name) {
 return readFileSync(new URL('../game/scene/'+name,import.meta.url),'utf8').split('\n')
  .map((line,startLine)=>({commandRaw:line.slice(0,line.indexOf(':')).trim(),
    content:line.slice(line.indexOf(':')+1).replace(/;[^;]*$/,'').split(' -')[0].trim(),startLine}));
}
test('captured real engine NaN resolves through unchanged source label, not GameVar',()=>{
 const actual=JSON.parse(readFileSync(new URL('../game/chapter1-voice-manifest.json',import.meta.url)));
 const captured={scene:'chapter1-1-ja-r11-owl.txt',line:377,paragraphId:'NaN',text:'「あ、いえ、私」'};
 // Exact local WebGL failure: the original context must still fail closed.
 assert.deepEqual(resolveVoiceCue(actual,captured),[]);
 const sentenceList=parsedSource(captured.scene);
 for(const broken of [NaN,'NaN',undefined,'wrong']){
  const context=chapterVoiceContext({currentSentenceId:378,currentScene:{sceneUrl:'game/scene/'+captured.scene,sentenceList}},
   {GameVar:{koto_id:broken},showText:captured.text,currentDialogKey:'captured-WebGL'},
   {baseURL:'https://game.test/kotonoha2/'});
  assert.equal(context.line,377);assert.equal(context.paragraphId,'KOTO-C1-1-l_48');
  assert.equal(context.isDialogue,true);
  assert.deepEqual(resolveVoiceCue(actual,context),['KOTO-C1-1-l_48-s001']);
 }
});
test('every formal source cue resolves from authored labels with NaN game variables',()=>{
 const actual=JSON.parse(readFileSync(new URL('../game/chapter1-voice-manifest.json',import.meta.url)));
 for(const [name,scene] of Object.entries(actual.scenes)){
  const sentenceList=parsedSource(name);
  for(const [line,cue] of Object.entries(scene.lines)){
   const context=chapterVoiceContext({currentSentenceId:Number(line)+1,currentScene:{sceneUrl:'game/scene/'+name,sentenceList}},
    {GameVar:{koto_id:NaN},showText:cue.text,currentDialogKey:'saved'}, {baseURL:'https://game.test/kotonoha2/'});
   assert.equal(context.paragraphId,cue.paragraphId,`${name}:${line}`);
   assert.deepEqual(resolveVoiceCue(actual,context),cue.taskIds);
  }
 }
});
test('source label lookup fails closed at unknown labels and uses source lines, not array positions',()=>{
 const list=[{commandRaw:'label',content:'KOTO-C1-1-l_20',startLine:111},
  {commandRaw:'未具名の少女',content:'x',startLine:116}];
 const context=chapterVoiceContext({currentSentenceId:2,currentScene:{sceneUrl:'https://game.test/chapter1-1-ja-r11-owl.txt',sentenceList:list}},
  {showText:'x',GameVar:{koto_id:NaN}},{});
 assert.equal(context.line,116);assert.equal(context.paragraphId,'KOTO-C1-1-l_20');
 for(const index of [-1,2,NaN,1.5])assert.equal(sourceParagraphId(list,index),'');
 assert.equal(sourceParagraphId(undefined,0),'');
 assert.equal(sourceParagraphId([...list,{commandRaw:'label',content:'different-label'},{commandRaw:'少女'}],3),'');
 assert.equal(sourceParagraphId([{commandRaw:'少女'}],0),'');
});
test('runtime shows voice controls only in title/settings, hides story and other overlays',()=>{
 const runtime=readFileSync(new URL('../game/chapter1-voice-runtime.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
 const elements=[],updates=[];let subscriber,modal=false,title=false,menu=false,settings=false;
 const element=tag=>{const value={tag,hidden:false,open:false,children:[],style:{},
  append(...children){this.children.push(...children);for(const child of children)child.parentElement=this;},insertBefore(child){this.children.push(child);child.parentElement=this;},setAttribute(){},addEventListener(){},removeEventListener(){},
  contains(target){return target===this;},remove(){}};elements.push(value);return value;};
 const root=element('root'),sound=element('button');sound.id='koto-sound-check';
 const document={baseURI:'https://game.test/',hidden:false,body:element('body'),getElementById:id=>id==='root'?root:id==='koto-sound-check'?sound:id==='koto-chapter-entry'&&title?{}:null,
  createElement:element,addEventListener(){},removeEventListener(){},
  querySelector(selector){if(selector.includes('#koto-chapters'))return modal?{}:null;if(selector.includes('_Options_main_'))return settings?{}:null;if(selector.includes('_Menu_main_'))return menu?{}:null;return null;}};
 const engine={sceneManager:{lockSceneWrite:false,sceneData:{currentSentenceId:2,currentScene:{
  sceneUrl:'game/scene/chapter1-1-ja-r11-owl.txt',
  sentenceList:[{commandRaw:'label',content:'KOTO-C1-1-l_20'},{commandRaw:'少女',startLine:116}]}}},
  gameplay:{skipAnimation:false},stageManager:{getViewStageState:()=>({GameVar:{koto_id:NaN},showText:'first'}),
   subscribe(fn){subscriber=fn;return()=>{};}}};
 runInNewContext(runtime,{location:{pathname:'/kotonoha2/'},document,window:{addEventListener(){},removeEventListener(){}},
  engine,chapterVoiceContext,VOICE_ENABLED_KEY,VOICE_VOLUME_KEY,cancelVoicePreload(){},mountStageControl(panel){root.append(panel);return{update(){},dispose(){}};},MutationObserver:class{observe(){} disconnect(){}},
  createVoiceAutoGate:()=>({setActive(){},dispose(){}}),
  createChapterVoiceController:()=>({update:value=>updates.push(value),snapshot:()=>({enabled:true}),interrupt(){},dispose(){}})});
 const panel=elements.find(e=>e.id==='koto-voice-controls'),details=elements.find(e=>e.tag==='details');
 assert.equal(updates[0].paragraphId,'KOTO-C1-1-l_20');assert.equal(panel.hidden,true);assert.equal(panel.parentElement,root);assert.equal(sound.parentElement,panel);
 details.open=true;modal=true;subscriber(engine.stageManager.getViewStageState());
 assert.equal(panel.hidden,true);assert.equal(details.open,false);assert.equal(updates.at(-1).blocked,true);
 modal=false;subscriber(engine.stageManager.getViewStageState());assert.equal(panel.hidden,true);
 title=true;subscriber(engine.stageManager.getViewStageState());assert.equal(panel.hidden,false);
 menu=true;subscriber(engine.stageManager.getViewStageState());assert.equal(panel.hidden,true);
 settings=true;subscriber(engine.stageManager.getViewStageState());assert.equal(panel.hidden,false);
 settings=false;menu=false;title=false;subscriber(engine.stageManager.getViewStageState());assert.equal(panel.hidden,true);
 const css=readFileSync(new URL('../game/chapter1-voice.css',import.meta.url),'utf8');
 assert.match(css,/#root #koto-voice-controls\{position:absolute;top:28px;left:50%;right:auto/);
 assert.match(css,/#koto-voice-controls\[hidden\]\{display:none\}/);
});

test('voice toolbar and preload card stay inside transformed game coordinates, not letterboxing',()=>{
 for(const scale of [.15,.27,.5625,1,1.5])for(const modal of [false,true]){
  const box=stageControlLayout({width:2560,height:1440,scale,modal});
  assert.ok(box.width*box.scale<2560);assert.ok(box.maxHeight*box.scale<1440-28);
  assert.ok(box.width>0&&box.maxHeight>0);
 }
 assert.equal(stageControlLayout({scale:NaN}).scale,1);
});


test('new cue first encountered blocked starts once after unblocking',async()=>{
 const h=setup();h.controller.update(ctx({blocked:true}));await delay();assert.equal(h.requests.length,0);
 h.controller.update(ctx());await waitFor(()=>h.audios.length===1);h.controller.update(ctx());await delay();assert.equal(h.audios.length,1);
});
test('subsequent new blocked cue is not consumed, while already-played menu interruption stays stopped',async()=>{
 const h=setup();h.controller.update(ctx());await waitFor(()=>h.audios.length===1);
 h.controller.update(ctx({line:11,text:'b',dialogKey:'two',blocked:true}));await delay();assert.equal(h.audios.length,1);
 h.controller.update(ctx({line:11,text:'b',dialogKey:'two'}));await waitFor(()=>h.audios.length===2);
 h.controller.update(ctx({line:11,text:'b',dialogKey:'two',blocked:true}));h.controller.update(ctx({line:11,text:'b',dialogKey:'two'}));await delay();assert.equal(h.audios.length,2);
});
test('same cue typewriter update does not stop or duplicate active speech',async()=>{
 const h=setup();h.controller.update(ctx());await waitFor(()=>h.audios.length===1);h.controller.update(ctx());
 assert.equal(h.audios[0].paused,false);assert.equal(h.controller.snapshot().playing,true);assert.equal(h.audioRequests().length,1);
});
test('explicit replay restarts current cue using cached audio without altering OFF preference',async()=>{
 const h=setup();h.controller.update(ctx());await waitFor(()=>h.audios.length===1);assert.equal(h.controller.replayCurrent(),true);await waitFor(()=>h.audios.length===2);
 assert.equal(h.audios[0].paused,true);assert.equal(h.audioRequests().length,1);assert.equal(h.audios[1].paused,false);
 h.controller.setEnabled(false);const count=h.requests.length;assert.equal(h.controller.replayCurrent(),true);await delay();assert.equal(h.requests.length,count);assert.equal(h.controller.snapshot().enabled,false);
});
test('deferred replay is bound to exact cue and cannot play after a scene switch',async()=>{
 const h=setup();h.controller.update(ctx({blocked:true}));const replay=h.controller.prepareReplay();
 h.controller.update(ctx({line:11,text:'b',dialogKey:'two',blocked:true}));assert.equal(replay.run(),false);await delay();assert.equal(h.requests.length,0);
});
test('deferred mobile replay may run after its same-cue menu closes without double playback',async()=>{
 const h=setup();h.controller.update(ctx());await waitFor(()=>h.audios.length===1);h.controller.update(ctx({blocked:true}));
 const replay=h.controller.prepareReplay();h.controller.update(ctx());assert.equal(h.audios.length,1);assert.equal(replay.run(),true);await waitFor(()=>h.audios.length===2);assert.equal(h.audios[1].paused,false);
});
test('replay requested while OFF cannot wake up later after another action enables voice',async()=>{
 const h=setup({saved:{[VOICE_ENABLED_KEY]:'off'}});h.controller.update(ctx());const replay=h.controller.prepareReplay();h.controller.setEnabled(true);await waitFor(()=>h.audios.length===1);
 assert.equal(replay.run(),false);await delay();assert.equal(h.audios.length,1);
});
test('narration and other chapters leave native replay behavior available and never replay previous cue',async()=>{
 const h=setup();h.controller.update(ctx());await waitFor(()=>h.audios.length===1);
 for(const context of [ctx({isDialogue:false,text:'narration'}),ctx({scene:'chapter2-1-ja-c2-owl.txt'})]){h.controller.update(context);assert.equal(h.controller.prepareReplay(),null);assert.equal(h.controller.replayCurrent(),false);}
 assert.equal(h.audios.length,1);
});

function originalReplayHandler(mobile){
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');const path=html.match(/\.\/assets\/index-[a-f0-9]+\.js/)[0];const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const marker=mobile?'onClick:()=>{const handled=window.kotonohaChapterVoice?.replayCurrent?.({defer:!0});':'onClick:()=>{if(window.kotonohaChapterVoice?.replayCurrent?.())';
 const start=source.indexOf(marker);assert.ok(start>=0,'native handler must explicitly call replay API');
 const end=source.indexOf(mobile?'},children:':'},onMouseEnter:n',start);assert.ok(end>start);
 return source.slice(start+'onClick:'.length,end+1);
}
for(const mobile of [false,true])test(`original ${mobile?'mobile':'desktop'} replay handler delegates once and retains native fallback`,()=>{
 const code=originalReplayHandler(mobile);
 for(const handled of [true,false]){let formal=0,native=0,closed=0,clickSound=0,options;const audio={currentTime:3,pause(){},play(){native++;return Promise.resolve();}};
  const fn=runInNewContext('('+code+')',{window:{kotonohaChapterVoice:{replayCurrent(value){formal++;options=value;return handled;}}},document:{getElementById:id=>id==='currentVocal'?audio:null},e:{value:true,set(){closed++;}},i(){clickSound++;}});fn();
  assert.equal(formal,1);assert.equal(native,handled?0:1);if(mobile){assert.equal(options.defer,true);assert.equal(closed,1);}else assert.equal(clickSound,1);
 }
});
