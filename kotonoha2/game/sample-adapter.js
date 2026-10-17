// Temporarily silence track B, including B restored by an existing save or history jump.
// Preserve the engine state and original audio file so the track can be enabled again later.
(()=>{
  const suppressB=e=>{
    const a=e.target;
    if(!(a instanceof HTMLAudioElement))return;
    const src=a.getAttribute('src')||a.currentSrc;
    if(!src)return;
    let path;try{path=new URL(src,document.baseURI).pathname;}catch{return;}
    if(!path.endsWith('/game/bgm/B_sample.mp3'))return;
    a.pause();
    a.removeAttribute('src');
    a.load();
  };
  document.addEventListener('loadstart',suppressB,true);
  document.addEventListener('play',suppressB,true);
})();

// Thin DOM adapter: WebGAL remains responsible for video playback and scene progression.
(()=>{const b=document.getElementById('koto-skip-op');let v;
const find=()=>{v=document.getElementById('playVideoElement');b.hidden=!v;if(v){v.playsInline=true;v.setAttribute('playsinline','');}};
new MutationObserver(find).observe(document.getElementById('videoContainer')||document.body,{childList:true,subtree:true});
const skip=()=>{if(v){v.pause();v.dispatchEvent(new Event('ended'));}};b.addEventListener('click',skip);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&v){e.preventDefault();e.stopPropagation();skip();}},true);find();})();

// Portrait uses its own top-anchored layer, not the engine's bottom-anchored mini-avatar box.
(()=>{const root=document.getElementById('root');const panel=document.createElement('div');panel.id='speaker-portrait';panel.hidden=true;const img=document.createElement('img');img.alt='';panel.appendChild(img);root.appendChild(panel);
const update=()=>{const box=document.getElementById('textBoxMain');if(box&&panel.parentElement!==box)box.appendChild(panel);const original=document.querySelector('#miniAvatar img');const video=document.getElementById('playVideoElement');const next=original?.getAttribute('src')||'';panel.dataset.full= /\/(ellie|hyde_lou|mastema|police|auctioneer|sean|sean_r14|guard_r15)\.png$/.test(next)?'true':'false';const portrait=next.replace(/\/([^/]+)\.png$/, '/portrait_$1.png');if(portrait&&portrait!==img.getAttribute('src'))img.src=portrait;panel.hidden=!next||!!video;};
new MutationObserver(update).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});update();
document.addEventListener('click',e=>{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)return;const label=e.target.textContent?.trim();const wanted=label==='中文'?'中文（减少动态）':label==='日本語'?'日本語（動きを減らす）':null;if(!wanted)return;const target=[...root.querySelectorAll('div,span,button')].find(n=>n.childElementCount===0&&n.textContent.trim()===wanted);if(target){e.preventDefault();e.stopImmediatePropagation();target.click();}},true);
})();
