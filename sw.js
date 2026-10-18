/* Static application shell only: never cache authentication, API, weather, or user records. */
const PREFIX='roadledger-shell-'+self.registration.scope;
// Bump this release version whenever shell assets/schema change. Do not skipWaiting.
const CACHE=PREFIX+'v1';
const FILES=['./','./index.html','./roadledger-storage.js','./roadledger-accounting.js','./roadledger-navigation.js','./roadledger-ai.js','./roadledger-gps.js','./roadledger-weather.js','./sync/config.js','./sync/core.js','./sync/http.js','./sync/app.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url),base=new URL(self.registration.scope);
 if(event.request.method!=='GET'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||url.pathname.includes('/api/'))return;
 const path=url.pathname.slice(base.pathname.length);if(event.request.mode==='navigate'&&(path===''||path==='index.html')){event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(new URL('./index.html',base)))||fetch(event.request)));return}
 if(FILES.map(file=>new URL(file,base).pathname).includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(event.request,{ignoreSearch:true}))||fetch(event.request)));
});
