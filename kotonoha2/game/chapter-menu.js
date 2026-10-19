// Menu navigation delegates every launch and back action to authored engine choices.
(()=>{
 const root=document.getElementById('root');
 const page=document.createElement('section');page.id='koto-chapters';page.hidden=true;page.setAttribute('aria-label','章节选择');
 const css=document.createElement('style');css.textContent=`
 #koto-chapters{position:fixed;inset:0;z-index:1900;box-sizing:border-box;overflow:auto;overscroll-behavior:contain;background:radial-gradient(ellipse at top,#263442,#10151d 65%);color:#f4e7c6;font-family:serif;padding:clamp(16px,4vw,44px)}
 #koto-chapters[hidden]{display:none}#koto-chapters .menu-content{max-width:1000px;margin:auto}#koto-chapters h1{font-size:clamp(24px,4vw,38px);font-weight:400;letter-spacing:.12em;margin:0 0 10px}#koto-chapters p{margin:6px 0 18px;font-size:clamp(14px,2vw,18px)}
 #koto-chapters h2{font-size:18px;font-weight:400;margin:14px 0 8px}#koto-chapters nav{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:12px 0 20px}#koto-chapters .menu-options{display:grid;grid-template-columns:repeat(2,minmax(110px,1fr));gap:12px}
 #koto-chapters button{min-height:48px;color:#f4e7c6;background:#15202dd9;border:1px solid #a28d60;border-radius:3px;padding:14px 18px;font:inherit;font-size:clamp(16px,2.5vw,23px);cursor:pointer;touch-action:manipulation}#koto-chapters button:hover,#koto-chapters button:focus-visible{background:#394351;outline:2px solid #e4d0a5;outline-offset:2px}#koto-chapters button[aria-pressed=true]{background:#4a463b;border-color:#f4e7c6}#koto-chapters footer{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px}#koto-chapter-entry{position:absolute;right:6%;top:8%;padding:12px 24px;border:1px solid #a28d60;color:#f4e7c6;background:#15202ddd;font:24px serif;cursor:pointer;z-index:30}
 @media(max-width:520px){#koto-chapters nav{grid-template-columns:repeat(2,minmax(110px,1fr))}#koto-chapters button{padding:12px}#koto-chapters footer button{flex:1}}@media(max-height:450px){#koto-chapters{padding:14px 24px}#koto-chapters h1{font-size:24px}#koto-chapters p{margin-bottom:10px}#koto-chapters nav{margin:10px 0}#koto-chapters button{padding:10px 16px}#koto-chapters footer{margin-top:12px}}
 `;document.head.append(css);document.body.append(page);
 page.addEventListener('click',e=>e.stopPropagation());page.addEventListener('keydown',e=>{if(e.key!=='Tab')e.stopPropagation();});
 const variants={zhfull:'中文 · 标准动效',zhstill:'中文 · 减少动态',jafull:'日本語 · 標準動作',jastill:'日本語 · 動きを減らす'};
 let prefs={language:'zh',motion:'full'};try{const saved=JSON.parse(localStorage.getItem('koto-menu-preferences-v1'));if(saved&&['zh','ja'].includes(saved.language)&&['full','still'].includes(saved.motion))prefs=saved;}catch{}
 let selectedChapter='',signature='',choices=[];
 const remember=()=>{try{localStorage.setItem('koto-menu-preferences-v1',JSON.stringify(prefs));}catch{}};
 const summary=()=>`${prefs.language==='zh'?'中文':'日本語'} · ${prefs.motion==='full'?'标准动效':'减少动态'}`;
 const button=(label,fn,pressed)=>{const b=document.createElement('button');b.type='button';b.textContent=label;if(pressed!==undefined)b.setAttribute('aria-pressed',String(pressed));b.onclick=fn;return b;};
 const forward=(label)=>{const original=choices.find(x=>x.textContent.trim()===label);if(original){signature='';original.click();}};
 const render=(level)=>{
  page.replaceChildren();page.hidden=false;page.dataset.level=String(level);const content=document.createElement('div');content.className='menu-content';page.append(content);
  const title=document.createElement('h1');title.textContent=['','1 · 语言与动效','2 · 大章节','3 · '+selectedChapter+'小节'][level];content.append(title);
  const status=document.createElement('p');status.textContent=summary();status.id='koto-menu-selection';content.append(status);
  if(level===1){
   for(const [heading,values,key] of [['语言',[['中文','zh'],['日本語','ja']],'language'],['动效',[['标准动效','full'],['减少动态','still']],'motion']]){
    const h=document.createElement('h2');h.textContent=heading;content.append(h);const group=document.createElement('div');group.className='menu-options';content.append(group);
    for(const [label,value] of values)group.append(button(label,()=>{prefs[key]=value;remember();render(1);},prefs[key]===value));
   }
   const footer=document.createElement('footer');footer.append(button('下一步：大章节',()=>forward(variants[prefs.language+prefs.motion])),button('返回主菜单',()=>forward('返回主菜单')));content.append(footer);
  }else{
   const nav=document.createElement('nav');nav.setAttribute('aria-label',level===2?'大章节':'小节');
   for(const original of choices){const label=original.textContent.trim();if(label.startsWith('返回'))continue;nav.append(button(label,()=>{if(level===2)selectedChapter=label;signature='';original.click();}));}content.append(nav);
   const footer=document.createElement('footer');footer.append(button(level===2?'返回：语言与动效':'返回：大章节',()=>forward(level===2?'返回语言与动效':'返回大章节')));content.append(footer);
  }
  page.scrollTop=0;
 };
 const update=()=>{
  const title=document.querySelector('[class*="_Title_main_"]')||[...document.querySelectorAll('span')].find(x=>x.textContent==='开始游戏')?.parentElement?.parentElement?.parentElement?.parentElement;
  if(title&&!title.querySelector('#koto-chapter-entry')){const b=button('章节选择',e=>{e.stopPropagation();document.dispatchEvent(new Event('koto-open-chapters'));});b.id='koto-chapter-entry';title.append(b);}
  choices=[...root.querySelectorAll('div')].filter(x=>x.childElementCount===0&&(/^(第一章|第二章|第三章|第[1-7]节|返回语言与动效|返回大章节|返回主菜单)$/.test(x.textContent.trim())||Object.values(variants).includes(x.textContent.trim())));
  const labels=choices.map(x=>x.textContent.trim());const level=labels.length===5&&Object.values(variants).every(x=>labels.includes(x))?1:labels.includes('返回语言与动效')?2:labels.includes('返回大章节')?3:0;
  if(!level){page.hidden=true;signature='';return;}
  const key=level+'|'+labels.join('|');if(signature===key)return;signature=key;render(level);
 };
 new MutationObserver(update).observe(root,{subtree:true,childList:true});update();
})();
