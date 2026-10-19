const assert=require('node:assert/strict');const p=require('../sync/protocol.js');
(async()=>{
const invalid=[['["loads","a"]',{id:'b'}],['["settings","other"]',{rate:25}],['["loads","a"]',{id:'a',pay:-1}],['["loads","a"]',{id:'a',date:'2026-02-30'}],['["expenses","a"]',{id:'a',amount:0}],['["expenses","a"]',{id:'a',amount:2,payer:'nobody'}],['["mileage","a"]',{id:'a',date:'2026-10-19',start:10,end:20,loaded:11}],['["tires","a"]',{size:'R22',count:1.5}],['["routeSpecs","a"]',{routeAxles:31}],['["loads","a"]',{id:'a',notes:'x'.repeat(65536)}],['["loads","a"]',{id:'a',notes:'\ud800'}]];
for(const [k,v]of invalid)assert.throws(()=>p.validateRecord(k,v));
p.validateRecord('["expenses","a"]',{id:'a',amount:'10.20',payer:'business',loadExpenseId:'missing-load'});p.validateRecord('["loads","a"]',null);
const changes=Array.from({length:30},(_,i)=>({key:JSON.stringify(['loads','large-'+i]),value:{id:'large-'+i,notes:'x'.repeat(60000)},version:1,cursor:i+1}));let cursor=0,count=0,pages=0;while(cursor<30){const page=p.page(changes,cursor,30);p.validatePage(page,cursor);assert.ok(p.bytes(page)<=p.LIMITS.pageBytes);cursor=page.cursor;count+=page.changes.length;pages++}assert.equal(count,30);assert.ok(pages>=4);
for(const page of [{changes:[],cursor:1,hasMore:false},{changes:[],cursor:0,hasMore:true},{changes:[changes[0],changes[0]],cursor:1,hasMore:true}])assert.throws(()=>p.validatePage(page,0));
await assert.rejects(p.readResponse(new Response('x'.repeat(p.LIMITS.responseBytes+1))),/byte budget/);assert.equal(await p.readResponse(new Response(null,{status:204})),null);
console.log('PASS: shared schema/identity/type/date/Unicode/payload validation, dangling-link preservation, bounded pages, strict cursor continuity, and streamed response limits.');
})().catch(e=>{console.error(e);process.exitCode=1});
