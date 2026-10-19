// Local opening v7: one cancellable task per screen and an opaque home gate.
(()=>{
  let pending;
  const logo=new URL('./intro/akiacg-community-current.svg',document.currentScript.src).href;
  function visibleDelay(milliseconds,signal){
    return new Promise(resolve=>{
      let remaining=milliseconds,started=0,timer=null,done=false;
      const pause=()=>{if(timer!==null){clearTimeout(timer);timer=null;remaining=Math.max(0,remaining-(performance.now()-started))}};
      const finish=()=>{if(done)return;done=true;pause();document.removeEventListener('visibilitychange',changed);signal?.removeEventListener('abort',finish);resolve()};
      const arm=()=>{if(done||document.hidden)return;if(remaining<=0){finish();return}started=performance.now();timer=setTimeout(()=>{timer=null;remaining=0;finish()},remaining)};
      const changed=()=>{pause();arm()};
      document.addEventListener('visibilitychange',changed);signal?.addEventListener('abort',finish,{once:true});if(signal?.aborted)finish();else arm();
    });
  }
  const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  async function homeReady(prepareHome){
    await prepareHome();
    let root;
    while(!(root=document.getElementById('root'))||!root.querySelector('.title__enter-game-target'))await frame();
    // The accepted theme omits the engine's default Title_main class. Wait for
    // its stable native entry target, then decode the actual themed DOM assets.
    await frame();await frame();
    const urls=new Set();
    for(const el of [root,...root.querySelectorAll('*')]){
      const style=getComputedStyle(el);
      for(const hit of style.backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g))urls.add(hit[1]);
      if(el instanceof HTMLImageElement&&el.currentSrc)urls.add(el.currentSrc);
    }
    await Promise.all([...urls].map(async src=>{const image=new Image();image.src=src;await image.decode()}));
    await frame();await frame();
  }
  window.kotoOpening={show(prepareHome=async()=>{}){
    if(pending)return pending;
    pending=new Promise(resolve=>{
      const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      const overlay=document.createElement('section');overlay.id='koto-opening';overlay.dataset.screen='brand';overlay.dataset.phase='loading-brand';overlay.tabIndex=-1;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','开场');
      const page=document.createElement('div');page.className='opening-page opening-brand is-changing';overlay.append(page);
      page.innerHTML='<h1>Presenting By</h1>';
      const image=document.createElement('img');image.className='opening-logo';image.src=logo;image.alt='AkiACG Community';image.width=2138;image.height=735;page.append(image);
      const behind=[document.getElementById('root'),document.querySelector('.html-body__title-enter')].filter(Boolean);
      const previous=behind.map(el=>el.inert);behind.forEach(el=>{el.inert=true});
      const landing=document.querySelector('.html-body__title-enter');if(landing)landing.style.visibility='hidden';
      let currentScreen=null;
      const skip=()=>{
        // Cancel this screen's decode/fade/hold/fade-out as one unit. No old
        // timeout may subsequently write a phase belonging to the next screen.
        if(document.hidden||!currentScreen)return;
        overlay.dataset.phase='skipped';currentScreen.abort();
      };
      const stop=e=>e.stopPropagation();
      for(const type of ['pointerup','touchend'])overlay.addEventListener(type,stop);
      // Only the gesture's DOWN advances. Its later UP and compatibility CLICK
      // are consumed, so a physical touch cannot skip the newly mounted screen.
      const down=e=>{e.stopPropagation();if(!e.target.closest('a')){e.preventDefault();skip()}};
      if(window.PointerEvent)overlay.addEventListener('pointerdown',down);
      else{overlay.addEventListener('mousedown',down);overlay.addEventListener('touchstart',down,{passive:false})}
      overlay.addEventListener('click',e=>{e.stopPropagation();if(e.detail===0&&!e.target.closest('a')){e.preventDefault();skip()}});
      const keys=e=>{
        if(!overlay.isConnected)return;e.stopImmediatePropagation();
        if((e.code==='Space'||e.key==='Enter')&&!e.target.closest?.('a')){e.preventDefault();if(e.type==='keydown'&&!e.repeat)skip()}
        if(e.key==='Tab'){
          const links=[...overlay.querySelectorAll('a')];
          if(!links.length){e.preventDefault();return}
          const first=links[0],last=links[links.length-1];
          if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
          else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
        }
      };
      const screen=async(name,decode)=>{
        const controller=new AbortController();currentScreen=controller;
        const signal=controller.signal;
        overlay.dataset.screen=name;overlay.dataset.phase='loading';
        if(decode){await Promise.race([decode.catch(()=>{}),new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}))]);if(signal.aborted)return}
        const step=async(phase,milliseconds)=>{overlay.dataset.phase=phase;await visibleDelay(milliseconds,signal);return !signal.aborted};
        void page.offsetWidth;page.classList.remove('is-changing');
        if(!await step('fade-in',reduced?0:480))return;
        if(!await step('hold',3000))return;
        page.classList.add('is-changing');
        await step('fade-out',reduced?0:480);
      };
      window.addEventListener('keydown',keys,true);window.addEventListener('keyup',keys,true);
      // Opaque black is committed synchronously during the initial click handler.
      document.body.append(overlay);overlay.focus({preventScroll:true});
      (async()=>{
        await screen('brand',image.decode());
        page.className='opening-page opening-rights is-changing';overlay.dataset.screen='copyright';
        page.innerHTML=`<h1>版权声明</h1><div class="opening-copy" tabindex="0">
<p>本故事纯属虚构。登场人物、团体及名称等均为虚构，与现实中的人物、团体无关。</p>
<p>© SEGA<br>「Kotonoha Project／言ノ葉プロジェクト」「maimai」相关名称、标识及原作图片、文字、音频、视频等内容，其权利归原权利人所有。<br>本作品由 AkiACG Community 制作，为非官方改编作品。未经权利人许可，请勿擅自复制或转载受保护内容。</p>
<p>「言ノ葉プロジェクト」官方网站由世嘉飞舞运营。</p>
<div class="opening-links"><span>官方网站</span><a href="https://maimai.sega.jp/kotonoha/" target="_blank" rel="noopener noreferrer">https://maimai.sega.jp/kotonoha/</a><span>官方咨询</span><a href="https://sega.jp/contact/arcade/" target="_blank" rel="noopener noreferrer">https://sega.jp/contact/arcade/</a><span>世嘉飞舞隐私政策</span><a href="https://www.segafave.co.jp/privacy/" target="_blank" rel="noopener noreferrer">https://www.segafave.co.jp/privacy/</a></div>
<p>VOCALOID 是雅马哈株式会社的注册商标。</p></div>`;
        await screen('copyright');
        currentScreen=null;
        page.classList.add('is-changing');
        overlay.dataset.screen='loading-home';overlay.dataset.phase='loading-home';
        page.replaceChildren();
        const status=document.createElement('p');status.className='opening-loading';status.textContent='正在加载…';page.append(status);
        // Keep black over all native canvas/title startup until actual home art is decoded.
        for(;;){try{await homeReady(prepareHome);break}catch{status.textContent='主页资源加载失败，正在重试…';await visibleDelay(1000)}}
        status.remove();overlay.dataset.phase='reveal-home';overlay.classList.add('is-revealing');if(!reduced)await visibleDelay(540);
        window.removeEventListener('keydown',keys,true);window.removeEventListener('keyup',keys,true);
        overlay.remove();behind.forEach((el,i)=>{el.inert=previous[i]});resolve();
      })();
    });
    return pending;
  }};
})();
