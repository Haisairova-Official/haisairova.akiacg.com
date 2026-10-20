// Preview-only audio lane. Never accesses WebGAL BGM, effects, saves, or script timing.
export function createVoicePlayer({ manifest, baseURL, fetcher = fetch, makeAudio = () => new Audio(),
  urls = URL, cryptoProvider = crypto, maxCacheBytes = 96 * 1024 * 1024, timeoutMs = 8000, onStatus = () => {}, onActivity = () => {} }) {
  const items = new Map(manifest.items.map(item => [item.taskId, item]));
  const cache = new Map(), pending = new Map(), controllers = new Set();
  let generation = 0, loadGeneration = 0, current = null, disposed = false, cacheBytes = 0, watchdog = null, currentVolume = 1;
  const available = item => item && ['available_emotion_candidate','available_approved'].includes(item.status) &&
    /^[a-f0-9]{64}$/.test(item.sha256 || '') && /^game\/vocal\/chapter1\/[A-Za-z0-9_./-]+\.(wav|mp3|opus)$/.test(item.src || '') &&
    !item.src.split('/').includes('..');
  function releaseAudio() {
    clearTimeout(watchdog); watchdog=null;
    if (current) {
      const {audio, url} = current; current = null;
      audio.onended = null; audio.onerror = null; audio.pause(); audio.removeAttribute('src'); audio.load(); urls.revokeObjectURL(url);
    }
  }
  function stop() { generation++; releaseAudio(); onActivity(false); }
  function cancelPending() {
    stop(); loadGeneration++;
    for (const controller of controllers) controller.abort();
    controllers.clear(); pending.clear();
  }
  function setVolume(volume) {
    currentVolume = Math.max(0, Math.min(1, Number(volume) || 0));
    if (current) current.audio.volume = currentVolume;
  }
  async function load(item) {
    if (!available(item) || disposed) return null;
    const key = `${item.src}:${item.sha256}`;
    if (cache.has(key)) { const blob=cache.get(key);cache.delete(key);cache.set(key,blob);return blob; }
    if (pending.has(key)) return pending.get(key);
    const loadToken = loadGeneration;
    let promise;
    promise = (async () => {
      const controller=new AbortController();controllers.add(controller);
      const timer=setTimeout(()=>controller.abort(),timeoutMs);
      try {
        const response=await fetcher(new URL(item.src,baseURL).href,{signal:controller.signal,cache:'force-cache'});
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        const bytes=await response.arrayBuffer();
        const digest=await cryptoProvider.subtle.digest('SHA-256',bytes);
        const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
        if(hash!==item.sha256) throw Error('Audio hash mismatch');
        if(disposed||loadToken!==loadGeneration)return null;
        const blob=new Blob([bytes],{type:item.src.endsWith('.mp3')?'audio/mpeg':item.src.endsWith('.opus')?'audio/ogg':'audio/wav'});
        if(blob.size<=maxCacheBytes){
          while(cacheBytes+blob.size>maxCacheBytes && cache.size){const first=cache.keys().next().value;cacheBytes-=cache.get(first).size;cache.delete(first);}
          cache.set(key,blob);cacheBytes+=blob.size;
        }
        return blob;
      } catch(error){if(!disposed&&loadToken===loadGeneration)onStatus({type:'unavailable',taskId:item.taskId,error:String(error)});return null;}
      finally{clearTimeout(timer);controllers.delete(controller);if(pending.get(key)===promise)pending.delete(key);}
    })();
    pending.set(key,promise);return promise;
  }
  async function playQueue(taskIds,volume=1) {
    stop(); setVolume(volume); const token=generation;
    const queue=taskIds.map(id=>items.get(id)).filter(available);
    if(!queue.length||disposed)return false;
    onActivity(true);let cursor=0,started=false;
    async function next() {
      if(token!==generation||disposed)return false;
      releaseAudio();
      const item=queue[cursor++];
      if(!item){stop();return started;}
      const blob=await load(item);
      if(token!==generation||disposed)return false;
      if(!blob)return next();
      const audio=makeAudio(),url=urls.createObjectURL(blob);current={audio,url};
      audio.loop=false;audio.volume=currentVolume;audio.src=url;
      const finish=()=>{if(current?.audio===audio)void next();};
      audio.onended=finish;
      audio.onerror=()=>{if(current?.audio!==audio)return;onStatus({type:'playback-error',taskId:item.taskId});finish();};
      // Bound browser stalls/missing ended events; this is not the normal progression clock.
      watchdog=setTimeout(()=>{onStatus({type:'playback-timeout',taskId:item.taskId});finish();},
        Math.min(300000,Math.max(15000,(Number(item.durationSeconds)||30)*1000+10000)));
      try {await audio.play();if(token!==generation){audio.pause();return false;}started=true;onStatus({type:'playing',taskId:item.taskId,status:item.status});return true;}
      catch(error){if(token===generation&&!disposed){stop();onStatus({type:'blocked',taskId:item.taskId,error:String(error)});}return false;}
    }
    return next();
  }
  const play=(taskId,volume=1)=>playQueue([taskId],volume);
  async function preloadChapter() {
    const queue=manifest.items.filter(available);let cursor=0;
    await Promise.all(Array.from({length:3},async()=>{while(cursor<queue.length&&!disposed)await load(queue[cursor++]);}));
    return {available:queue.length,cached:cache.size,pending:manifest.items.length-queue.length};
  }
  function dispose(){disposed=true;cancelPending();cache.clear();cacheBytes=0;}
  return {play,playQueue,stop,cancelPending,setVolume,preloadChapter,dispose,stats:()=>({cached:cache.size,cacheBytes,inFlight:pending.size,playing:!!current})};
}
