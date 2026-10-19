/* Chromium device emulation through a local simulated HTTPS-terminating ingress. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright-core');const {start}=require('../backend/production-server.cjs');
(async()=>{
let upstream;const proxy=http.createServer((req,res)=>{const out=http.request({hostname:'127.0.0.1',port:upstream.address().port,path:req.url,method:req.method,headers:{...req.headers,'x-forwarded-proto':'https'}},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res)});out.on('error',()=>{res.writeHead(502);res.end()});req.pipe(out)});
await new Promise(r=>proxy.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+proxy.address().port;
upstream=start({ROADLEDGER_ORIGIN:origin.replace('http:','https:'),PORT:'0',ROADLEDGER_PROXY_MODE:'render',RENDER:'true',RENDER_SERVICE_ID:'local-fixture'});await new Promise(r=>upstream.once('listening',r));
let browser;try{
browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
for(const [name,viewport,mobile]of [['Windows',{width:1366,height:768},false],['Android',{width:412,height:915},true],['iPhone',{width:390,height:844},true],['iPad',{width:820,height:1180},true]]){
 const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
 // Prevent third-party calls: these tests exercise only local hosting/storage.
 await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 assert.equal(await page.locator('nav [data-tab]').count(),12,name);
 assert.equal(await page.evaluate(()=>ROADLEDGER_SYNC_CONFIG.mode),'disabled');
 await page.evaluate(()=>localStorage.setItem('render-persistence-fixture','preserved'));
 const api=await page.evaluate(async()=>{const r=await fetch('/api/sync/session');return r.status});assert.equal(api,503);
 await context.setOffline(true);await page.locator('#pickup').fill(name+' offline');await page.locator('#delivery').fill('Local fixture');await page.locator('#pay').fill('650');await page.locator('#loadForm button[type=submit]').click();await page.evaluate(()=>RoadLedgerSyncApp.flush());await page.reload();await page.evaluate(()=>RoadLedgerSyncApp.ready);assert.equal(await page.locator('#count').innerText(),'1');assert.ok(await page.evaluate(async()=>Object.values((await RoadLedgerSyncApp.store.state()).records).some(r=>r.dirty)));const cached=await page.evaluate(async()=>{const entries=[];for(const key of await caches.keys())for(const req of await(await caches.open(key)).keys())entries.push(req.url);return entries});assert.equal(cached.some(url=>url.includes('/api/')),false);assert.equal(await page.evaluate(()=>localStorage.getItem('render-persistence-fixture')),'preserved');
 assert.equal(await page.locator('nav [data-tab]').count(),12);
 for(const button of await page.locator('nav [data-tab]').all())await button.click();
 await context.setOffline(false);await page.reload();assert.equal(await page.evaluate(()=>localStorage.getItem('render-persistence-fixture')),'preserved');
 assert.deepEqual(errors,[],name);await context.close();console.log('PASS: '+name+' viewport/touch emulation, production assets, all tabs, service worker offline reload, load/localStorage/IndexedDB queue persistence, no API caching, reconnect; cloud disabled.');
}
}finally{await browser?.close();await new Promise(r=>proxy.close(r));await new Promise(r=>upstream.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
