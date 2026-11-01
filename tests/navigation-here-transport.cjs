'use strict';
const assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createHereTransport,filterGeocode}=require('../backend/navigation-here-transport.cjs');
(async()=>{
 let calls=0;const disabled=createHereTransport({environment:{get HERE_API_KEY(){throw Error('must not read')}}});
 await assert.rejects(disabled.execute('geocode',{query:'test'}),{code:'HERE_DISABLED'});
 assert.throws(()=>createHereTransport({enabled:true}),{code:'HERE_CONFIGURATION'});
 const transport=createHereTransport({enabled:true,environment:{HERE_API_KEY:'fictional-test-only'},request:(url,options,callback)=>{
  calls++;assert.equal(url.origin,'https://geocode.search.hereapi.com');assert.equal(url.pathname,'/v1/geocode');assert.equal(options.rejectUnauthorized,true);assert.equal(url.searchParams.get('limit'),'5');
  const req=new EventEmitter();req.destroy=()=>{};req.end=()=>queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=200;res.headers={'content-type':'application/json'};res.destroy=()=>{};callback(res);res.emit('data',Buffer.from(JSON.stringify({items:[{title:'Fictional address',position:{lat:1,lng:2},private:'discard'}]})));res.emit('end')});return req;
 }});
 assert.deepEqual(await transport.execute('geocode',{query:'Fictional'}),{simulation:false,safeForNavigation:false,items:[{title:'Fictional address',position:{latitude:1,longitude:2}}]});
 await assert.rejects(transport.execute('route',{}),{code:'INVALID_REQUEST'});
 await assert.rejects(transport.execute('geocode',{query:'test',url:'https://other.invalid'}),{code:'HERE_CONTRACT'});
 const controller=new AbortController();controller.abort();await assert.rejects(transport.execute('geocode',{query:'test'},{signal:controller.signal}),{code:'HERE_CANCELLED'});assert.equal(calls,1);
 assert.throws(()=>filterGeocode({items:[{title:'bad',position:{lat:91,lng:0}}]}));
 for(const scenario of ['redirect','quota','large','invalid','error']){
  const t=createHereTransport({enabled:true,environment:{HERE_API_KEY:'fictional-test-only'},request:(_url,_opts,cb)=>{const req=new EventEmitter();req.destroy=()=>{};req.end=()=>queueMicrotask(()=>{if(scenario==='error'){req.emit('error',Error('private URL'));return}const res=new EventEmitter();res.statusCode=scenario==='redirect'?302:scenario==='quota'?429:200;res.headers={'content-type':'application/json'};res.destroy=()=>{};cb(res);res.emit('data',Buffer.from(scenario==='large'?'x'.repeat(262145):'invalid'));res.emit('end')});return req}});
  await assert.rejects(t.execute('geocode',{query:'test'}),e=>e.message==='HERE navigation unavailable.'&&!e.message.includes('private'));
 }
 let destroyed=0;
 const hanging=createHereTransport({enabled:true,environment:{HERE_API_KEY:'fictional-test-only'},request:()=>{const req=new EventEmitter();req.end=()=>{};req.destroy=()=>{destroyed++};return req}});
 const aborter=new AbortController(),pending=hanging.execute('geocode',{query:'Fictional'},{signal:aborter.signal});aborter.abort();await assert.rejects(pending,{code:'HERE_CANCELLED'});assert.equal(destroyed,1);
 await assert.rejects(hanging.execute('geocode',{query:'Fictional'}),{code:'HERE_TIMEOUT'});assert.equal(destroyed,2);
 console.log('HERE transport isolated tests passed, including in-flight abort and deadline; no provider requests.');
})().catch(()=>{console.error('HERE transport test failed');process.exitCode=1});
