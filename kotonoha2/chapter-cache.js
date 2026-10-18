const CACHE='kotonoha-c2-local-media-v12-monster-behind-cast';
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==self.location.origin||! /\/game\/(background|figure|bgm|vocal|video)\//.test(u.pathname))return;
 e.respondWith((async()=>{
  const cache=await caches.open(CACHE);let r=await cache.match(u.href);
  if(!r){r=await fetch(e.request);if(r.ok&&r.status===200)try{await cache.put(u.href,r.clone())}catch{}return r;}
  const range=e.request.headers.get('range');
  if(!range)return r;
  const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m)return fetch(e.request);
  const b=await r.arrayBuffer(),len=b.byteLength;
  const start=m[1]?Number(m[1]):Math.max(0,len-Number(m[2]));
  const end=m[1]?(m[2]?Math.min(Number(m[2]),len-1):len-1):len-1;
  if(start>=len||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${len}`}});
  return new Response(b.slice(start,end+1),{status:206,headers:{'Content-Type':r.headers.get('Content-Type')||'application/octet-stream','Content-Range':`bytes ${start}-${end}/${len}`,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}});
 })());
});

