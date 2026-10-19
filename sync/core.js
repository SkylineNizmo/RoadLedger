/* Offline queue and record-level optimistic synchronization; no provider credentials. */
(function(root){
'use strict';
const protocol=typeof module!=='undefined'&&module.exports?require('./protocol.js'):root.RoadLedgerProtocol;
const KEYS=['roadledger-v1','roadledger-settings-v2','roadledger-mileage-v1','roadledger-extras-v1','roadledger-tires-v1','roadledger-route-specs-v1','roadledger-route-stops-v1'];
const clone=v=>structuredClone(v);
const stable=v=>v===undefined?'undefined':JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a,b)=>stable(a)===stable(b);
const uuid=()=>crypto.randomUUID();
const validKey=key=>{try{const pair=JSON.parse(key);return Array.isArray(pair)&&pair.length===2&&['loads','equipment','settings','mileage','expenses','maintenance','fleet','documents','ifta','extraMetadata','tires','routeSpecs','routeStops'].includes(pair[0])&&typeof pair[1]==='string'&&pair[1].length>0&&JSON.stringify(pair)===key}catch{return false}};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function flatten(raw){
 const read=(i,fallback)=>raw[KEYS[i]]===null||raw[KEYS[i]]===undefined?clone(fallback):JSON.parse(raw[KEYS[i]]);
 const result={};
 const add=(collection,id,value)=>{const key=JSON.stringify([collection,String(id)]);if(Object.hasOwn(result,key))throw Error('Duplicate IDs in '+collection+'. Export a backup before repairing these records.');result[key]=clone(value)};
 const rows=(collection,list)=>{if(!Array.isArray(list))throw Error('Invalid local '+collection);list.forEach((row,index)=>{if(!object(row))throw Error('Invalid record in '+collection);add(collection,row.id??'legacy-'+index,{...row,id:row.id??'legacy-'+index})})};
 const main=read(0,{loads:[]});if(!object(main))throw Error('Invalid local load data');rows('loads',main.loads??[]);const equipment={...main};delete equipment.loads;if(Object.keys(equipment).length)add('equipment','default',equipment);
 const settings=read(1,{});if(!object(settings))throw Error('Invalid settings');if(Object.keys(settings).length)add('settings','default',settings);
 rows('mileage',read(2,[]));const extras=read(3,{});if(!object(extras))throw Error('Invalid extra records');
 for(const bucket of ['expenses','maintenance','fleet','documents','ifta'])rows(bucket,extras[bucket]??[]);
 // Preserve future/legacy extra metadata separately, rather than dropping it.
 const metadata={...extras};for(const bucket of ['expenses','maintenance','fleet','documents','ifta'])delete metadata[bucket];if(Object.keys(metadata).length)add('extraMetadata','default',metadata);
 for(const [i,collection] of [[4,'tires'],[5,'routeSpecs']]){const values=read(i,{});if(!object(values))throw Error('Invalid '+collection);for(const [id,value]of Object.entries(values))add(collection,id,value)}
 const stops=read(6,[]);if(!Array.isArray(stops))throw Error('Invalid stops');if(stops.length)add('routeStops','default',stops);
 return result;
}
function materialize(records,previous){
 const live=Object.entries(records).filter(([,record])=>record.value!==null);
 const get=(collection,id,fallback)=>clone(records[JSON.stringify([collection,id])]?.value??fallback);
 const list=collection=>{
  const found=new Map(live.filter(([key])=>JSON.parse(key)[0]===collection).map(([key,record])=>[JSON.parse(key)[1],clone(record.value)]));
  const old=flatten(previous);const ordered=[];
  for(const key of Object.keys(old)){const [name,id]=JSON.parse(key);if(name===collection&&found.has(id)){ordered.push(found.get(id));found.delete(id)}}
  return [...ordered,...[...found.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v)];
 };
 const map=collection=>Object.fromEntries(live.filter(([key])=>JSON.parse(key)[0]===collection).map(([key,r])=>[JSON.parse(key)[1],clone(r.value)]));
 const extras=get('extraMetadata','default',{});for(const name of ['expenses','maintenance','fleet','documents','ifta'])extras[name]=list(name);
 const values=[{...get('equipment','default',{}),loads:list('loads')},get('settings','default',{}),list('mileage'),extras,map('tires'),map('routeSpecs'),get('routeStops','default',[])];
 return Object.fromEntries(KEYS.map((key,index)=>[key,JSON.stringify(values[index])]));
}
class Store{
 constructor(name='roadledger-sync-v1'){this.name=name}
 async open(){if(this.db)return;this.db=await new Promise((resolve,reject)=>{const r=indexedDB.open(this.name,1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Close other RoadLedger tabs to upgrade local storage.'))});this.db.onversionchange=()=>this.db.close()}
 async edit(fn){await this.open();return new Promise((resolve,reject)=>{const tx=this.db.transaction('state','readwrite');const store=tx.objectStore('state');const request=store.get('main');let result;request.onsuccess=()=>{try{const state=request.result||{schema:1,deviceId:uuid(),owner:null,records:{},conflicts:{},projection:{},projectionVersions:{},projectionRaw:null,cursor:0,archives:[]};if(state.schema!==1)throw Error('Unsupported sync database version');result=fn(state);store.put(state,'main')}catch(e){reject(e);tx.abort()}};tx.oncomplete=()=>resolve(clone(result));tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Local transaction aborted'))})}
 async state(){await this.open();const value=await new Promise((resolve,reject)=>{const tx=this.db.transaction('state','readonly');const request=tx.objectStore('state').get('main');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});return value??this.edit(state=>state)}
 close(){this.db?.close();this.db=null}
}
class Engine{
 constructor(store,transport){this.store=store;this.transport=transport;this.session=null;this.epoch=0;this.running=null;this.status='Signed out';this.listeners=new Set();this.stopped=true;this.retry=1000;this.timer=null}
 notify(){for(const listener of this.listeners)listener(this.status)}
 async ingest(raw){const flat=flatten(raw);return this.store.edit(state=>{
  if(state.pendingApply){if(same(raw,state.pendingApply.raw)){state.projection=flatten(raw);state.projectionRaw=clone(raw);state.projectionVersions=state.pendingApply.versions;delete state.pendingApply}else if(same(raw,state.pendingApply.expected))delete state.pendingApply;else throw Error('Interrupted apply has additional edits. Export sync recovery before proceeding.');}
  if(!state.projectionRaw)state.archives.push({kind:'original-localStorage',at:new Date().toISOString(),raw:clone(raw)});
  for(const key of new Set([...Object.keys(state.projection),...Object.keys(flat)])){
   const value=flat[key]??null;if(same(state.projection[key]??null,value))continue;
   const old=state.records[key];const base=old?.dirty?old.baseVersion:(state.projectionVersions[key]??0);
   state.records[key]={value:clone(value),version:old?.version??0,baseVersion:base,dirty:true,opId:uuid()};
   if(state.conflicts[key])state.conflicts[key].local=clone(value);
  }
  state.projection=clone(flat);state.projectionRaw=clone(raw);
  return {records:Object.keys(state.records).length};
 })}
 async authenticate(email,password){this.session=null;this.epoch++;const session=await this.transport.login(email,password);try{await this.acceptSession(session)}catch(error){await this.transport.logout();throw error}return session}
 async resume(){this.session=null;const epoch=++this.epoch;try{const session=await this.transport.session();if(epoch!==this.epoch)return false;if(!(await this.store.state()).owner){this.status='Sign in explicitly to bind this device’s existing records';this.notify();return false}await this.acceptSession(session);return true}catch(e){if(epoch!==this.epoch)return false;if(e.status===401){this.session=null;this.status='Sign in to synchronize';this.notify();return false}throw e}}
 async acceptSession(session){if(!session||typeof session.userId!=='string'||!session.userId)throw Error('Invalid authenticated session');await this.store.edit(state=>{if(state.owner&&state.owner!==session.userId)throw Error('This local workspace belongs to another account. Use a separate browser profile; records have not been moved.');state.owner=session.userId});this.epoch++;this.session=session;this.status='Signed in; local records ready';this.notify()}
 async signOut(){this.epoch++;this.session=null;this.stop();try{await this.transport.logout()}finally{this.status='Signed out; local records retained on this device';this.notify()}}
 async sync(){if(this.running)return this.running;this.running=this.cycle().finally(()=>{this.running=null});return this.running}
 async cycle(){if(!this.session)throw Object.assign(Error('Sign in required'),{status:401});const epoch=this.epoch;const user=this.session.userId;const confirmed=await this.transport.session();if(confirmed.userId!==user)throw Object.assign(Error('Session account changed'),{status:401});
  if(epoch!==this.epoch)return;const initial=await this.store.state();if(initial.owner!==user)throw Error('Workspace account mismatch');
  for(const [key,record]of Object.entries(initial.records)){
   if(epoch!==this.epoch)return;if(!record.dirty||initial.conflicts[key])continue;
   const operation={key,value:record.value,baseVersion:record.baseVersion,opId:record.opId};try{protocol.validateOperation(operation)}catch(error){error.message=key+': '+error.message;throw error}const reply=await this.transport.push(operation);if(epoch!==this.epoch)return;
   if(!reply||!Number.isSafeInteger(reply.record?.version)||reply.record.version<0||!Object.hasOwn(reply.record,'value'))throw Error('Invalid server revision');protocol.validateRecord(key,reply.record.value);
   await this.store.edit(state=>{const current=state.records[key];if(!current)return;
    if(reply.conflict){state.conflicts[key]={local:clone(current.value),remote:clone(reply.record.value),remoteVersion:reply.record.version,baseVersion:current.baseVersion};return}
    if(!same(reply.record.value,record.value))throw Error('Server acknowledgement does not match queued value');
    if(current.opId===record.opId){current.dirty=false;current.version=reply.record.version;current.baseVersion=reply.record.version;if(same(state.projection[key]??null,record.value))state.projectionVersions[key]=reply.record.version}else if(current.baseVersion===record.baseVersion){current.baseVersion=reply.record.version;current.version=reply.record.version}
   });
  }
  const cursor=(await this.store.state()).cursor;const response=await this.transport.pull(cursor);if(epoch!==this.epoch)return;
  protocol.validatePage(response,cursor);
  await this.store.edit(state=>{for(const change of response.changes){if(!validKey(change.key)||!Number.isSafeInteger(change.version)||change.version<1||!Object.hasOwn(change,'value'))throw Error('Invalid remote record');const old=state.records[change.key];
    if(old&&change.version<=old.version)continue;if(state.conflicts[change.key]?.remoteVersion>=change.version)continue;
    if(old?.dirty){if(same(old.value,change.value)){old.dirty=false;old.version=change.version;old.baseVersion=change.version;if(same(state.projection[change.key]??null,change.value))state.projectionVersions[change.key]=change.version;delete state.conflicts[change.key]}else state.conflicts[change.key]={local:clone(old.value),remote:clone(change.value),remoteVersion:change.version,baseVersion:old.baseVersion}}
    else state.records[change.key]={value:clone(change.value),version:change.version,baseVersion:change.version,dirty:false};
   }state.cursor=Math.max(state.cursor,response.cursor);state.moreCloud=!!response.hasMore;return null});
  const state=await this.store.state();this.status=state.moreCloud?'More cloud records downloading':Object.keys(state.conflicts).length?'Conflicts need review; both versions retained':Object.values(state.records).some(r=>r.dirty)?'Local changes queued':'Cloud synchronized; apply downloaded changes when ready';this.notify();return state;
 }
 async resolve(key,choice){if(!['local','remote'].includes(choice))throw Error('Invalid resolution');await this.store.edit(state=>{const c=state.conflicts[key];if(!c)throw Error('Conflict no longer exists');state.archives.push({kind:'conflict-resolution',key,at:new Date().toISOString(),...clone(c),choice});state.records[key]={value:clone(choice==='local'?c.local:c.remote),version:c.remoteVersion,baseVersion:c.remoteVersion,dirty:choice==='local',opId:uuid()};delete state.conflicts[key]});this.status='Resolution saved locally';this.notify()}
 async apply(readRaw,writeRaw){await this.ingest(readRaw());const plan=await this.store.edit(state=>{if(state.moreCloud)throw Error('Wait for the remaining cloud records to download.');if(Object.keys(state.conflicts).length)throw Error('Review conflicts before applying cloud changes.');if(Object.values(state.records).some(r=>r.dirty))throw Error('Synchronize pending local edits before applying cloud changes.');const raw=materialize(state.records,state.projectionRaw);const versions=Object.fromEntries(Object.entries(state.records).map(([k,r])=>[k,r.version]));state.pendingApply={id:uuid(),raw,expected:clone(state.projectionRaw),versions};return state.pendingApply});
  try{writeRaw(plan.raw,plan.expected)}catch(error){await this.store.edit(state=>{if(state.pendingApply?.id===plan.id)delete state.pendingApply});throw error}
  await this.store.edit(state=>{if(state.pendingApply?.id!==plan.id)throw Error('Another tab is applying records');state.projection=flatten(plan.raw);state.projectionRaw=clone(plan.raw);state.projectionVersions=plan.versions;delete state.pendingApply});
 }
 start(){this.stop();this.stopped=false;this.wake=()=>this.schedule(0);root.addEventListener?.('online',this.wake);this.visibility=()=>{if(!root.document?.hidden)this.schedule(0)};root.document?.addEventListener('visibilitychange',this.visibility);this.schedule(0)}
 schedule(delay){if(this.stopped)return;clearTimeout(this.timer);this.timer=setTimeout(async()=>{try{if(root.navigator?.onLine===false)throw Error('Offline');if(!this.session&&!(await this.resume()))return;if(this.stopped)return;await this.sync();this.retry=1000;this.schedule((await this.store.state()).moreCloud?0:15000)}catch(error){if(error.status===401||error.status===403){this.session=null;this.status='Session expired; sign in again. Local work is retained.';this.notify();return}if(error.permanent||[400,409,413,422].includes(error.status)){this.status='Synchronization paused: '+error.message+'. Saved records remain on this device; export recovery before correcting the record.';this.notify();return}this.status=error.status===429?'Sync quota reached; saved changes remain queued':'Offline or service unavailable; changes remain queued';this.notify();this.schedule(this.retry+Math.floor(Math.random()*250));this.retry=Math.min(this.retry*2,60000)}},delay)}
 stop(){this.stopped=true;clearTimeout(this.timer);if(this.wake)root.removeEventListener?.('online',this.wake);if(this.visibility)root.document?.removeEventListener('visibilitychange',this.visibility)}
}
const api={KEYS,validKey,flatten,materialize,Store,Engine,same};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RoadLedgerSync=api;
})(typeof window==='undefined'?globalThis:window);
