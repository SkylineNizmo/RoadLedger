const {chromium}=require('playwright-core');const assert=require('node:assert/strict');
const {mockFixture}=require('./mock-fixture.cjs');let BASE;
const mainKey='roadledger-v1',extraKey='roadledger-extras-v1';
const legacy={
 'roadledger-v1':{truck:'Original Truck',trailer:'Original Trailer',loads:[{id:'sync-shared',date:'2026-10-18',pickup:'Dallas',delivery:'Austin',pay:1000,rate:25,expenses:100}]},
 'roadledger-settings-v2':{company:'Offline Company',rate:25,taxRate:25},
 'roadledger-mileage-v1':[{id:'sync-trip',date:'2026-10-18',start:100,end:300,total:200,loaded:150}],
 'roadledger-extras-v1':{expenses:[{id:'sync-expense',date:'2026-10-18',category:'Fuel',amount:100,gallons:25,payer:'business',loadExpenseId:'sync-shared'}],maintenance:[],fleet:[],documents:[],ifta:[]},
 'roadledger-tires-v1':{'Original Truck':{size:'11R22.5',count:6}},
 'roadledger-route-specs-v1':{'Original Truck|Original Trailer':{routeHeight:'13.5',routeWidth:'8.5',routeWeight:'40000',routeAxles:'5'}},
 'roadledger-route-stops-v1':['Dallas','Austin']
};
(async()=>{const fixture=await mockFixture();BASE=fixture.url;const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const contexts=[];const errors=[];
 async function device(seed){const context=await browser.newContext({serviceWorkers:'block'});contexts.push(context);if(seed)await context.addInitScript(seed=>{if(!localStorage.getItem('test-seeded')){for(const[k,v]of Object.entries(seed))localStorage.setItem(k,JSON.stringify(v));localStorage.setItem('test-seeded','yes')}},seed);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(BASE+'?sync=mock');await page.evaluate(()=>RoadLedgerSyncApp.ready);await page.evaluate(()=>RoadLedgerSyncApp.engine.stop());return {page,context}}
 const A=await device(legacy),B=await device();
 const state=d=>d.page.evaluate(()=>RoadLedgerSyncApp.store.state());
 const flush=d=>d.page.evaluate(()=>RoadLedgerSyncApp.flush());
 const signIn=d=>d.page.evaluate(()=>RoadLedgerSyncApp.engine.authenticate('driver@example.test','local-demo-only'));
 const sync=d=>d.page.evaluate(()=>RoadLedgerSyncApp.engine.sync());
 const apply=async d=>{await d.page.evaluate(()=>RoadLedgerSyncApp.engine.apply(()=>RoadLedgerStorage.snapshot(),(raw,expected)=>RoadLedgerStorage.applySync(raw,expected)));await d.page.reload();await d.page.evaluate(()=>RoadLedgerSyncApp.ready);await d.page.evaluate(()=>RoadLedgerSyncApp.engine.stop())};
 const edit=async(d,key,body)=>{await d.page.evaluate(({key,body})=>{const value=JSON.parse(localStorage.getItem(key));new Function('value',body)(value);if(!RoadLedgerStorage.write(key,value))throw Error('save failed')},{key,body});await flush(d)};
 assert.deepEqual((await state(A)).archives[0].raw,Object.fromEntries(Object.entries(legacy).map(([k,v])=>[k,JSON.stringify(v)])));
 for(const[k,v]of Object.entries(legacy))assert.deepEqual(await A.page.evaluate(k=>JSON.parse(localStorage.getItem(k)),k),v);
 const frozen=await state(A);await A.page.evaluate(async()=>{try{await RoadLedgerSyncApp.store.edit(s=>{s.partial='must abort';throw Error('Injected transaction failure')})}catch{}});assert.equal((await state(A)).partial,undefined);assert.deepEqual((await state(A)).projectionRaw,frozen.projectionRaw);
 await signIn(A);
 const unbound=await A.page.evaluate(async()=>{const store=new RoadLedgerSync.Store('unbound-session-test');const e=new RoadLedgerSync.Engine(store,RoadLedgerSyncApp.engine.transport);await e.ingest(RoadLedgerStorage.snapshot());const resumed=await e.resume();const s=await store.state();store.close();return {resumed,owner:s.owner}});assert.deepEqual(unbound,{resumed:false,owner:null});
 await sync(A);assert.equal(Object.values((await state(A)).records).filter(r=>r.dirty).length,0);
 await signIn(B);await sync(B);await apply(B);
 for(const[k,v]of Object.entries(legacy))assert.deepEqual(await B.page.evaluate(k=>JSON.parse(localStorage.getItem(k)),k),v);
 // Offline independent edits merge without dataset-level overwrite.
 await A.context.setOffline(true);await B.context.setOffline(true);
 await edit(A,mainKey,"value.loads.push({id:'independent-load',date:'2026-10-18',pickup:'Reno',delivery:'Vegas',pay:500,rate:25});");
 await edit(B,extraKey,"value.expenses.push({id:'independent-expense',date:'2026-10-18',category:'Tolls',amount:20,payer:'business'});");
 assert.ok(Object.values((await state(A)).records).some(r=>r.dirty));await assert.rejects(sync(A));
 await A.context.setOffline(false);await B.context.setOffline(false);await sync(A);await sync(B);await sync(A);assert.deepEqual((await state(A)).conflicts,{});assert.deepEqual((await state(B)).conflicts,{});await apply(A);await apply(B);
 assert.equal(await B.page.evaluate(()=>data.loads.some(l=>l.id==='independent-load')),true);assert.equal(await A.page.evaluate(()=>extra.expenses.some(e=>e.id==='independent-expense')),true);
 // Two offline edits of the same financial record preserve both versions.
 await edit(A,mainKey,"value.loads.find(l=>l.id==='sync-shared').pay=1200");await edit(B,mainKey,"value.loads.find(l=>l.id==='sync-shared').pay=1300");await sync(A);await sync(B);const key=JSON.stringify(['loads','sync-shared']);let c=(await state(B)).conflicts[key];assert.equal(c.local.pay,1300);assert.equal(c.remote.pay,1200);
 await assert.rejects(B.page.evaluate(()=>RoadLedgerSyncApp.engine.apply(()=>RoadLedgerStorage.snapshot(),(r,e)=>RoadLedgerStorage.applySync(r,e))),/conflicts/);
 await B.page.evaluate(key=>RoadLedgerSyncApp.engine.resolve(key,'local'),key);await sync(B);assert.equal((await state(B)).archives.at(-1).remote.pay,1200);await sync(A);await apply(A);await apply(B);assert.equal(await A.page.evaluate(()=>data.loads.find(l=>l.id==='sync-shared').pay),1300);
 // Deletion vs edit is an explicit conflict, not silent last-write-wins.
 await edit(A,mainKey,"value.loads=value.loads.filter(l=>l.id!=='sync-shared')");await edit(B,mainKey,"value.loads.find(l=>l.id==='sync-shared').pay=1400");await sync(A);await sync(B);c=(await state(B)).conflicts[key];assert.equal(c.remote,null);assert.equal(c.local.pay,1400);await B.page.evaluate(key=>RoadLedgerSyncApp.engine.resolve(key,'local'),key);await sync(B);await sync(A);await apply(A);await apply(B);
 // Subsequent local edits after acknowledgement use the acknowledged revision.
 await edit(A,mainKey,"value.loads.find(l=>l.id==='sync-shared').pay=1450");await sync(A);assert.deepEqual((await state(A)).conflicts,{});
 // Response lost after commit: replay same operation exactly once.
 await edit(A,mainKey,"value.loads.find(l=>l.id==='sync-shared').pay=1500");const previousVersion=(await state(A)).records[key].version;
 await A.page.evaluate(()=>{const t=RoadLedgerSyncApp.engine.transport;window.realPush=t.push.bind(t);let once=true;t.push=async op=>{const reply=await window.realPush(op);if(once){once=false;throw Error('Lost acknowledgement')}return reply}});await assert.rejects(sync(A));assert.equal((await state(A)).records[key].dirty,true);await sync(A);assert.equal((await state(A)).records[key].version,previousVersion+1);await A.page.evaluate(()=>{RoadLedgerSyncApp.engine.transport.push=window.realPush});
 // A save while a request is in flight must remain queued after the older ack.
 await edit(A,mainKey,"value.loads.find(l=>l.id==='sync-shared').pay=1550");await A.page.evaluate(()=>{const t=RoadLedgerSyncApp.engine.transport;window.realPush=t.push.bind(t);let once=true;t.push=async op=>{const reply=await window.realPush(op);if(once){once=false;const value=RoadLedgerStorage.read('roadledger-v1');value.loads.find(l=>l.id==='sync-shared').pay=1600;RoadLedgerStorage.write('roadledger-v1',value);await RoadLedgerSyncApp.flush()}return reply}});await sync(A);assert.equal((await state(A)).records[key].dirty,true);await sync(A);assert.equal((await state(A)).records[key].value.pay,1600);assert.deepEqual((await state(A)).conflicts,{});await A.page.evaluate(()=>{RoadLedgerSyncApp.engine.transport.push=window.realPush});
 // The migration mirror can fail without deleting a successfully saved legacy record.
 await A.page.evaluate(()=>{const store=RoadLedgerSyncApp.store;window.realEdit=store.edit.bind(store);store.edit=async()=>{throw Error('Disk full')}});await A.page.evaluate(()=>{const value=RoadLedgerStorage.read('roadledger-v1');value.loads.find(l=>l.id==='sync-shared').pay=1650;RoadLedgerStorage.write('roadledger-v1',value)});await A.page.evaluate(()=>RoadLedgerSyncApp.flush().catch(()=>{}));assert.equal(await A.page.evaluate(()=>RoadLedgerStorage.read('roadledger-v1').loads.find(l=>l.id==='sync-shared').pay),1650);await A.page.evaluate(()=>{RoadLedgerSyncApp.store.edit=window.realEdit});await A.page.evaluate(()=>RoadLedgerSyncApp.capture());await sync(A);assert.equal((await state(A)).records[key].value.pay,1650);
 // Auth expiration pauses sync; an account change cannot rebind/upload this workspace.
 await A.page.evaluate(()=>RoadLedgerSyncApp.engine.transport.logout());await assert.rejects(sync(A));await assert.rejects(A.page.evaluate(()=>RoadLedgerSyncApp.engine.authenticate('other@example.test','local-demo-only')),/another account/);assert.equal((await state(A)).owner,'demo-driver');assert.equal(await A.page.evaluate(()=>RoadLedgerSyncApp.engine.session),null);await signIn(A);
 const C=await device();await C.page.evaluate(()=>RoadLedgerSyncApp.engine.authenticate('other@example.test','local-demo-only'));await sync(C);assert.equal(Object.keys((await state(C)).records).length,0);
 const csrf=await C.page.evaluate(async()=>{const r=await fetch('/api/sync/push',{method:'POST',headers:{'Content-Type':'application/json','X-RoadLedger-Client':'1'},body:JSON.stringify({})});return r.status});assert.equal(csrf,403);
 const forged=await C.page.evaluate(async()=>{const r=await fetch('/api/sync/pull?cursor=0',{headers:{'X-Workspace-User':'demo-driver'}});return r.status});assert.equal(forged,403);
 await A.page.evaluate(()=>RoadLedgerSyncApp.engine.signOut());assert.equal(await A.page.evaluate(()=>RoadLedgerStorage.read('roadledger-v1').loads.find(l=>l.id==='sync-shared').pay),1650);
 // Bad legacy data is refused without changing any source bytes.
 assert.equal(await A.page.evaluate(()=>{try{RoadLedgerSync.flatten({'roadledger-v1':'{broken'});return false}catch{return true}}),true);
 assert.deepEqual(errors,[]);for(const context of contexts)await context.close();console.log('PASS: lossless legacy migration, atomic IndexedDB rollback, two-device offline merge, financial/edit-delete conflicts, resolution archive, acknowledgement/retry races, failed mirror recovery, auth/tenant/CSRF boundaries, sign-out preservation, and invalid legacy data.');
}finally{await browser.close();await fixture.close()}})().catch(e=>{console.error(e);process.exitCode=1});
