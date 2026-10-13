// One persistent Audio element. Ordinary stops only pause. Reloading the same
// source is explicit error recovery; its saved timeline is restored at metadata.
export function createYarisAudio(onState=()=>{},defaultSource=null) {
  const audio=document.createElement('audio');audio.id='yaris-audio';audio.preload='none';audio.loop=true;audio.volume=.25;audio.hidden=true;document.body.append(audio);
  let url=null,name=defaultSource?.name||'',wanted=false,pending=null,blocked=false,failed=false,generation=0;
  let suspended=false,interrupted=false,abortRetries=0,savedTime=0,restoreTime=null,restorePreload=null;
  const status=()=>({loaded:!!(url||defaultSource),name,active:wanted,playing:!audio.paused,blocked,failed,suspended,interrupted,reloading:restoreTime!==null,volume:audio.volume,muted:audio.muted});
  const emit=()=>onState(status());
  function remember(){if(restoreTime===null&&Number.isFinite(audio.currentTime)&&audio.currentTime>=0&&(!failed||audio.currentTime>0||savedTime===0))savedTime=audio.currentTime;}
  function restorePolicy(){if(restorePreload!==null){audio.preload=restorePreload;restorePreload=null;}}
  function stop(){wanted=false;remember();audio.pause();emit();}
  function play(){
    if(!wanted||suspended||!(url||defaultSource)||blocked||failed||interrupted||pending||restoreTime!==null||!audio.paused){emit();return;}
    const attempt={generation};pending=attempt;
    if(!audio.hasAttribute('src'))audio.src=url||defaultSource.src;
    let retryAbort=false;
    let request;try{request=audio.play();}catch(error){request=Promise.reject(error);}
    Promise.resolve(request).then(()=>{
      if(pending===attempt&&attempt.generation===generation){abortRetries=0;if(!wanted||suspended)audio.pause();}
    }).catch(e=>{
      if(pending!==attempt||attempt.generation!==generation||!wanted||suspended)return;
      if(e.name==='AbortError'){
        if(abortRetries<1){abortRetries++;retryAbort=true;}else interrupted=true;
      }else{blocked=e.name==='NotAllowedError';failed=!blocked;}
    }).finally(()=>{
      if(pending!==attempt||attempt.generation!==generation)return;
      pending=null;emit();
      if(retryAbort&&wanted&&!suspended)play();
    });
  }
  function gesture(){suspended=false;blocked=false;interrupted=false;abortRetries=0;if(wanted)play();else emit();}
  audio.addEventListener('play',()=>{if(!wanted||suspended)audio.pause();emit();});
  audio.addEventListener('pause',emit);
  audio.addEventListener('timeupdate',()=>{if(!failed)remember();});
  audio.addEventListener('loadedmetadata',()=>{
    if(restoreTime===null)return;
    const time=restoreTime;
    try{audio.currentTime=Number.isFinite(audio.duration)?Math.min(time,Math.max(0,audio.duration)):time;}catch{failed=true;restoreTime=null;restorePolicy();audio.pause();emit();return;}
    savedTime=audio.currentTime;restoreTime=null;restorePolicy();emit();if(wanted&&!suspended)play();
  });
  audio.addEventListener('error',()=>{if(audio.currentTime>0||savedTime===0)remember();generation++;pending=null;failed=true;restoreTime=null;restorePolicy();audio.pause();emit();});
  return {
    status,stop,
    suspend(){suspended=true;stop();},
    load(file){generation++;pending=null;stop();restorePolicy();if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(file);name=file.name;blocked=false;failed=false;interrupted=false;abortRetries=0;savedTime=0;restoreTime=null;audio.src=url;audio.load();emit();},
    retry(){
      if(!failed){gesture();return;}
      if(!(url||defaultSource))return;
      if(audio.currentTime>0||savedTime===0)remember();const time=savedTime;generation++;pending=null;audio.pause();blocked=false;failed=false;interrupted=false;abortRetries=0;suspended=false;restoreTime=time;restorePreload=audio.preload;audio.preload='metadata';
      if(!audio.hasAttribute('src'))audio.src=url||defaultSource.src;
      audio.load();emit();
    },
    setActive(value){if(!value){if(wanted||!audio.paused)stop();return;}wanted=true;play();},
    gesture,
    volume(value){audio.volume=Math.max(0,Math.min(1,Number(value)));emit();},
    mute(value){audio.muted=!!value;emit();}
  };
}
