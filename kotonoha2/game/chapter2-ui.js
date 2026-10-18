// Stable semantic tags: preserve engine text/read state, remove its redundant backdrop.
(()=>{
  const update=()=>{
    const box=document.getElementById('textBoxMain');if(!box)return;
    box.parentElement?.setAttribute('data-koto-dialogue-container','');
    for(const child of box.children){
      if(child.id==='miniAvatar'||child.id==='speaker-portrait')continue;
      if(child.querySelector('[class*="-showname"]'))child.setAttribute('data-koto-name','');
    }
    const v=document.getElementById('playVideoElement');
    const skip=document.getElementById('koto-skip-op');
    if(skip)skip.textContent=v?.currentSrc.includes('c2_ed')?'跳过 ED · Esc':'跳过视频 · Esc';
  };
  new MutationObserver(update).observe(document.getElementById('root'),{childList:true,subtree:true});update();
})();

