/* Real encrypted/atomic session store; strict single-use provider tokens, no network. */
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EncryptedSessionStore}=require('../backend/session-store.cjs');const {createSessionService}=require('../backend/session-service.cjs');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'roadledger-auth-recovery-')),key=crypto.randomBytes(32),id=crypto.randomBytes(32).toString('base64url');
 let store,handler,now=100000,serial=0,refreshCount=0,verifyCount=0,failRefresh=false,failVerify=false,wrongUser=false;
 const live=new Set(['refresh-0']);
 const provider={async login(){throw Error('Not used')},async refresh(refresh){refreshCount++;if(failRefresh){failRefresh=false;throw Object.assign(Error('Temporary fixture outage'),{status:503})}assert.ok(live.delete(refresh),'Consumed refresh token must never be reused');await new Promise(r=>setTimeout(r,5));serial++;live.add('refresh-'+serial);return {access_token:'access-'+serial,refresh_token:'refresh-'+serial,expires_in:3600}},async verify(access){verifyCount++;assert.equal(store.get(id).accessToken,access,'Rotated token must already be durable before identity request');assert.equal(store.get(id).refreshToken,'refresh-'+serial);if(failVerify){failVerify=false;throw Object.assign(Error('Temporary fixture outage'),{status:503})}return {id:wrongUser?'other-user':'fixture-user',email_confirmed_at:'fixture'}},async logout(){},async push(){throw Error('Not used')},async pull(){throw Error('Not used')}};
 function launch(){store=new EncryptedSessionStore({directory,key});handler=createSessionService({provider,store,origin:'https://ledger.example',clock:()=>now})}
 async function request(){let status;const headers={};await handler({socket:{encrypted:true,remoteAddress:'192.0.2.1'},method:'GET',url:'/api/sync/session',headers:{cookie:'__Host-roadledger_session='+id}},{setHeader(k,v){headers[k]=v},writeHead(s){status=s},end(){}});return {status,headers}}
 try{
 launch();store.set(id,{userId:'fixture-user',csrf:'fixture-csrf',accessToken:'access-0',refreshToken:'refresh-0',accessExpires:now,expires:now+604800000});
 failRefresh=true;assert.equal((await request()).status,502);assert.equal(store.get(id).refreshToken,'refresh-0');assert.equal(verifyCount,0);
 failVerify=true;const failure=await request();assert.equal(failure.status,502);assert.equal(failure.headers['Set-Cookie'],undefined);assert.equal(store.get(id).refreshToken,'refresh-1');assert.equal(refreshCount,2);
 // Identity outage, host restart and recovery beyond any provider reuse grace window.
 store.close();launch();now+=120000;assert.equal((await request()).status,200);assert.equal(refreshCount,2);
 // Force another rotation; concurrent readers serialize and reuse the committed credentials.
 now+=3600000;failVerify=true;const results=await Promise.all([request(),request(),request()]);assert.deepEqual(results.map(r=>r.status),[502,200,200]);assert.equal(refreshCount,3);assert.equal(store.get(id).refreshToken,'refresh-2');
 const raw=fs.readFileSync(store.file(store.idHash(id))).toString();assert.equal(raw.includes('refresh-2'),false);assert.equal(raw.includes('access-2'),false);assert.equal(fs.readdirSync(directory).some(f=>f.endsWith('.tmp')),false);
 // Disk failure fails closed: no identity request or authenticated action follows an unpersisted rotation.
 now+=3600000;const set=store.set.bind(store),beforeVerify=verifyCount;store.set=()=>{throw Error('Fixture disk full')};assert.equal((await request()).status,502);assert.equal(verifyCount,beforeVerify);store.set=set;
 // Rotated credentials never waive identity verification.
 store.set(id,{...store.get(id),accessToken:'access-'+serial,refreshToken:'refresh-'+serial,accessExpires:now+3600000});wrongUser=true;assert.equal((await request()).status,401);
 console.log('PASS: transient refresh/identity outages, durable rotation before verification, encrypted restart recovery, strict single-use tokens, concurrent serialization, disk-write fail-closed and identity mismatch rejection. No SQL or cloud requests.');
 }finally{store?.close();key.fill(0);fs.rmSync(directory,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
