const CACHE='siteview-2-1-1';const SHELL=['./index.html','./manifest.json','./icon-192.png','./icon-512.png','./favicon-64.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(x=>{if(x.ok){const c=x.clone();caches.open(CACHE).then(k=>k.put(e.request,c))}return x}).catch(()=>caches.match('./index.html'))))});
