/* Navigation-only local skeleton. Disabled by default. No HERE transport or durable storage. */
'use strict';
const crypto=require('node:crypto'),Contract=require('./navigation-contract.cjs');
const {isMockAuth}=require('./navigation-mock-auth.cjs'),{isMockProvider}=require('./navigation-mock-provider.cjs');
const message={DISABLED:'Live navigation is disabled.',UNAUTHORIZED:'Navigation sign-in required.',FORBIDDEN:'Navigation access denied.',NOT_FOUND:'Navigation endpoint not found.',METHOD:'Use JSON POST.',INVALID_REQUEST:'Invalid navigation request.',RATE_LIMIT:'Navigation request rate exceeded.',QUOTA_EXHAUSTED:'Local navigation quota exhausted.',BUSY:'Navigation capacity unavailable.',REQUEST_CONFLICT:'Request ID already used for different input.',UPSTREAM_TIMEOUT:'Local provider timed out.',UPSTREAM_INVALID:'Invalid local provider response.',PROVIDER_FAILURE:'Local provider unavailable.',NO_ROUTE:'Simulation: no route found.',REQUEST_CANCELLED:'Local request cancelled.'};
const fault=(code,status)=>Object.assign(Error(message[code]),{code,status});
const loopback=ip=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip);
function createNavigationService({mode='disabled',origin,auth,provider,clock=Date.now,limits:overrides={}}={}){
 if(!['disabled','local-mock'].includes(mode))throw Error('Unsupported navigation mode');
 const defaults={bodyBytes:16384,responseBytes:262144,bodyTimeoutMs:2000,providerTimeoutMs:2000,windowMs:60000,ingressRate:120,userRate:10,globalRate:40,userDaily:25,globalDaily:100,geocodeDaily:100,routeDaily:50,userConcurrent:2,globalConcurrent:4,receiptMs:30000,maxReceipts:64,maxPrincipals:8,maxReaders:16};
 if(Object.keys(overrides).some(k=>!Object.hasOwn(defaults,k)))throw Error('Unsupported navigation limit');
 const limits={...defaults,...overrides};if(Object.values(limits).some(n=>!Number.isSafeInteger(n)||n<1||n>1000000))throw Error('Invalid navigation limit');
 const rawClock=clock;let latest=0;clock=()=>{const n=rawClock();if(Number.isSafeInteger(n)&&n>=0)latest=Math.max(latest,n);return latest};
 let base;
 if(mode==='local-mock'){base=new URL(origin);if(base.origin!==origin||base.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(base.hostname)||!isMockAuth(auth)||!isMockProvider(provider))throw Error('Local mock requires loopback HTTP and fixture-only dependencies')}
 const jobs=new Map(),principals=new Map();let globalActive=0,readers=0,closed=false;
 let rate={bucket:-1,count:0},ingress={bucket:-1,count:0},daily={bucket:-1,geocode:0,route:0,total:0};
 const metrics={admitted:0,replayed:0,providerCalls:0,success:0,denied:0,cancelled:0,timeouts:0};
 function record(user){let s=principals.get(user);if(!s){if(principals.size>=limits.maxPrincipals)throw fault('BUSY',503);s={rate:{bucket:-1,count:0},daily:{bucket:-1,geocode:0,route:0,total:0},active:0};principals.set(user,s)}return s}
 function arrival(s){const bucket=Math.floor(clock()/limits.windowMs);for(const r of [rate,s.rate])if(r.bucket!==bucket){r.bucket=bucket;r.count=0}if(rate.count>=limits.globalRate||s.rate.count>=limits.userRate)throw fault('RATE_LIMIT',429);rate.count++;s.rate.count++}
 function reserve(s,operation){
  const bucket=Math.floor(clock()/86400000);for(const r of [daily,s.daily])if(r.bucket!==bucket){r.bucket=bucket;r.geocode=0;r.route=0;r.total=0}
  if(daily.total>=limits.globalDaily||s.daily.total>=limits.userDaily||daily[operation]>=limits[operation+'Daily'])throw fault('QUOTA_EXHAUSTED',429);
  if(globalActive>=limits.globalConcurrent||s.active>=limits.userConcurrent)throw fault('BUSY',429);
  // One synchronous admission/reservation; no await between check and increment.
  daily[operation]++;s.daily[operation]++;daily.total++;s.daily.total++;globalActive++;s.active++;metrics.admitted++;
 }
 function prune(){for(const [key,j]of jobs)if(j.upstreamDone&&j.doneAt!==null&&clock()-j.doneAt>=limits.receiptMs)jobs.delete(key)}
 function jobFor(user,operation,input){
  prune();const key=JSON.stringify([user,operation,input.requestId]),fingerprint=crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
  if(jobs.has(key)){const j=jobs.get(key);if(j.fingerprint!==fingerprint)throw fault('REQUEST_CONFLICT',409);metrics.replayed++;return j}
  if(jobs.size>=limits.maxReceipts)throw fault('BUSY',503);const s=record(user);reserve(s,operation);
  const j={fingerprint,controller:new AbortController(),consumers:new Set(),upstreamDone:false,doneAt:null,result:null,timer:null};
  j.promise=new Promise(resolve=>{j.finish=(result)=>{if(j.result)return;j.result=result;j.doneAt=clock();clearTimeout(j.timer);resolve(result)}});
  jobs.set(key,j);
  j.cancel=()=>{if(j.result)return;metrics.cancelled++;j.finish({status:499,code:'REQUEST_CANCELLED'});j.controller.abort()};
  j.timer=setTimeout(()=>{if(j.result)return;metrics.timeouts++;j.finish({status:504,code:'UPSTREAM_TIMEOUT'});j.controller.abort()},limits.providerTimeoutMs);
  Promise.resolve().then(()=>{if(j.controller.signal.aborted)throw Error('Cancelled before dispatch');metrics.providerCalls++;return provider.execute(operation,input,{signal:j.controller.signal})}).then(value=>{
   if(j.result)return;
   try{
    if(Buffer.byteLength(JSON.stringify(value))>limits.responseBytes)throw Error('Provider response too large');
    if(operation==='route'&&value?.simulation===true&&Array.isArray(value.routes)&&value.routes.length===0){j.finish({status:422,code:'NO_ROUTE'});return}
    const data=Contract.response(operation,value);if(Buffer.byteLength(JSON.stringify(data))>limits.responseBytes)throw Error('Provider response too large');metrics.success++;j.finish({status:200,data});
   }catch{j.finish({status:502,code:'UPSTREAM_INVALID'})}
  },()=>j.finish({status:502,code:'PROVIDER_FAILURE'})).finally(()=>{j.upstreamDone=true;globalActive--;s.active--});
  // Slots remain reserved after timeout/cancel until the actual provider settles.
  return j;
 }
 function body(req){
  if(req.headers['content-encoding']||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type']||''))return Promise.reject(fault('INVALID_REQUEST',415));
  if(req.headers['content-length']&&(!/^\d+$/.test(req.headers['content-length'])||Number(req.headers['content-length'])>limits.bodyBytes))return Promise.reject(fault('INVALID_REQUEST',413));
  return new Promise((resolve,reject)=>{const chunks=[];let size=0,finished=false;const timer=setTimeout(()=>finish(fault('INVALID_REQUEST',408)),limits.bodyTimeoutMs);
   function finish(error,value){if(finished)return;finished=true;clearTimeout(timer);req.removeListener('data',data);req.removeListener('end',end);req.removeListener('aborted',abort);req.removeListener('error',abort);if(error){req.resume();reject(error)}else resolve(value)}
   function data(chunk){size+=chunk.length;if(size>limits.bodyBytes)finish(fault('INVALID_REQUEST',413));else chunks.push(chunk)}
   function end(){try{const v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));finish(null,v)}catch{finish(fault('INVALID_REQUEST',422))}}
   function abort(){finish(fault('REQUEST_CANCELLED',499))}
   req.on('data',data);req.once('end',end);req.once('aborted',abort);req.once('error',abort);
  });
 }
 async function handler(req,res){
  // Aborted request streams can emit error after aborted; never log raw parser/socket data.
  req.on('error',()=>{});
  res.setHeader('Cache-Control','no-store');res.setHeader('Pragma','no-cache');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");res.setHeader('Vary','Origin, Cookie');
  function send(status,value){if(res.destroyed||res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...(status===429?{'Retry-After':String(Math.ceil(limits.windowMs/1000))}:{}),...(status===405?{Allow:'POST'}:{})});res.end(JSON.stringify({simulation:true,safeForNavigation:false,mode:mode==='local-mock'&&!closed?'local-fixture':'disabled',...value}))}
  let readSlot=false;
  try{
   if(mode==='disabled'||closed)throw fault('DISABLED',503);
   const ingressBucket=Math.floor(clock()/limits.windowMs);if(ingress.bucket!==ingressBucket){ingress.bucket=ingressBucket;ingress.count=0}if(ingress.count>=limits.ingressRate)throw fault('RATE_LIMIT',429);ingress.count++;
   if(!loopback(req.socket.remoteAddress)||req.headers.host!==base.host||req.headers.origin!==base.origin||req.headers['sec-fetch-site']==='cross-site'||req.headers['x-roadledger-navigation']!=='1')throw fault('FORBIDDEN',403);
   const paths={'/api/navigation/geocode':'geocode','/api/navigation/route':'route'},operation=Object.hasOwn(paths,req.url)?paths[req.url]:null;if(!operation)throw fault('NOT_FOUND',404);if(req.method!=='POST')throw fault('METHOD',405);
   const identity=auth.authorize(req,operation),s=record(identity.user);arrival(s);
   if(readers>=limits.maxReaders)throw fault('BUSY',503);readers++;readSlot=true;
   const raw=await body(req);readers--;readSlot=false;
   if(req.aborted||res.destroyed)throw fault('REQUEST_CANCELLED',499);
   const input=Contract.validate(operation,raw,clock());auth.authorize(req,operation);
   const job=jobFor(identity.user,operation,input),consumer={};job.consumers.add(consumer);
   const disconnected=()=>{if(res.writableEnded)return;job.consumers.delete(consumer);if(!job.consumers.size)job.cancel()};
   res.once('close',disconnected);req.once('aborted',disconnected);
   try{
    const result=await job.promise;if(res.destroyed)return;const current=auth.authorize(req,operation);if(current.user!==identity.user)throw fault('FORBIDDEN',403);
    if(result.code)throw fault(result.code,result.status);send(result.status,{data:result.data});
   }finally{job.consumers.delete(consumer);res.removeListener('close',disconnected);req.removeListener('aborted',disconnected)}
  }catch(error){metrics.denied++;const code=Object.hasOwn(message,error.code)?error.code:'PROVIDER_FAILURE',status=Object.hasOwn(message,error.code)&&Number.isInteger(error.status)?error.status:502;send(status,{error:{code,message:message[code]}})}
  finally{if(readSlot)readers--}
 }
 return Object.freeze({handler,stats:()=>({...metrics,active:globalActive,readers,receipts:jobs.size}),close(){closed=true;for(const j of jobs.values())j.cancel()}});
}
module.exports={createNavigationService};
