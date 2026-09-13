const CACHE='siteview-2-10-1';
const SHELL=[
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './favicon-64.png',
  './assets/css/style.css',
  './assets/js/app.js'
];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(async cache=>{await Promise.all(SHELL.map(url=>cache.add(url).catch(()=>null)));}).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(
    keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))
  )).then(()=>self.clients.claim())
));

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
      if(response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      }
      return response;
    }).catch(()=>caches.match('./index.html')))
  );
});
