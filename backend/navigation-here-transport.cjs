/* Server-only transport foundation. Not wired to the mock service or browser. */
'use strict';
const https=require('node:https');
const Route=require('./navigation-here-route.cjs');
const fail=code=>Object.assign(Error('HERE navigation unavailable.'),{code});
const endpoints=Object.freeze({geocode:'https://geocode.search.hereapi.com/v1/geocode',route:'https://router.hereapi.com/v8/routes'});
function createHereTransport({enabled=false,environment={},request=https.request}={}){
 // Read a key only after explicit enablement. No environment dump, URL or raw error logging.
 const key=enabled?environment.HERE_API_KEY:undefined;
 if(enabled&&(typeof key!=='string'||!key.trim()||key.length>512||/[\s\x00-\x1f\x7f]/.test(key)))throw fail('HERE_CONFIGURATION');
 return Object.freeze({async execute(operation,parameters,{signal}={}){
  if(!enabled)throw fail('HERE_DISABLED');
  if(!Object.hasOwn(endpoints,operation))throw fail('HERE_CONTRACT');
  // Route serialization remains blocked until current HERE weight semantics are verified.
  if(operation==='route')Route.buildTruckRequest(parameters);
  if(!parameters||Object.keys(parameters).sort().join('|')!=='query'||typeof parameters.query!=='string'||!parameters.query.trim()||parameters.query.length>500||/[\x00-\x1f\x7f]/.test(parameters.query))throw fail('HERE_CONTRACT');
  if(signal?.aborted)throw fail('HERE_CANCELLED');
  const url=new URL(endpoints.geocode);url.searchParams.set('q',parameters.query.trim());url.searchParams.set('limit','5');url.searchParams.set('apiKey',key);
  return new Promise((resolve,reject)=>{
   let req,timer,done=false;
   const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(fail(error)):resolve(value)};
   const abort=()=>{finish('HERE_CANCELLED');req?.destroy()};
   timer=setTimeout(()=>{finish('HERE_TIMEOUT');req?.destroy()},5000);
   try{
    req=request(url,{method:'GET',headers:{Accept:'application/json','Accept-Encoding':'identity'},rejectUnauthorized:true},res=>{
     res.on('error',()=>finish('HERE_UNAVAILABLE'));
     if(res.statusCode!==200||!/^application\/json(?:\s*;|$)/i.test(res.headers['content-type']||'')||res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){finish(res.statusCode===429?'HERE_QUOTA':'HERE_UNAVAILABLE');res.destroy();return}
     let size=0;const chunks=[];
     res.on('data',chunk=>{size+=chunk.length;if(size>262144){finish('HERE_RESPONSE_LIMIT');res.destroy()}else chunks.push(chunk)});
     res.on('end',()=>{if(done)return;try{const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));finish(null,filterGeocode(parsed))}catch{finish('HERE_INVALID_RESPONSE')}});
     res.on('aborted',()=>finish('HERE_UNAVAILABLE'));
    });
    req.on('error',()=>finish('HERE_UNAVAILABLE'));signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return}req.end();
   }catch{finish('HERE_UNAVAILABLE');req?.destroy()}
  });
 }});
}
function filterGeocode(value){
 if(!Array.isArray(value?.items)||value.items.length>5)throw fail('HERE_INVALID_RESPONSE');
 return {simulation:false,safeForNavigation:false,items:value.items.map(item=>{
  const p=item?.position;if(typeof item?.title!=='string'||!item.title.trim()||item.title.length>1000||/[\x00-\x1f\x7f]/.test(item.title)||!p||!Number.isFinite(p.lat)||Math.abs(p.lat)>90||!Number.isFinite(p.lng)||Math.abs(p.lng)>180)throw fail('HERE_INVALID_RESPONSE');
  return {title:item.title,position:{latitude:p.lat,longitude:p.lng}};
 })};
}
module.exports={createHereTransport,filterGeocode};
