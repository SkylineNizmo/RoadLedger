const assert=require('node:assert/strict');const {canonicalIP,clientIdentity,isHTTPS}=require('../backend/transport.cjs');const {createSessionService}=require('../backend/session-service.cjs');
(async()=>{
 const config={trustRenderProxy:true,clientIPMode:'trusted-chain',trustedProxyIPs:['10.0.0.1'],trustedProxyCIDRs:['192.0.2.0/24']};
 const req=(chain,peer='10.0.0.1')=>({socket:{remoteAddress:peer},headers:{'x-forwarded-for':chain,'x-forwarded-proto':'https'}});
 assert.equal(clientIdentity(req('1.2.3.4, 198.51.100.9, 192.0.2.5'),config),'198.51.100.9');
 assert.equal(clientIdentity(req('198.51.100.8'),{trustRenderProxy:true}),null);
 assert.equal(isHTTPS(req('198.51.100.8','10.0.0.2'),config),false);assert.equal(isHTTPS(req('198.51.100.8'),config),true);
 assert.equal(clientIdentity(req('1.2.3.4','198.51.100.9')),'198.51.100.9');
 assert.equal(isHTTPS(req('1.2.3.4','198.51.100.9')),false);
 assert.equal(canonicalIP('::ffff:198.51.100.9'),'198.51.100.9');assert.equal(canonicalIP('2001:0db8:0:0:0:0:0:1'),'2001:db8::1');
 for(const chain of [undefined,'','unknown','198.51.100.9:123','198.51.100.9,,192.0.2.5','fe80::1%eth0','192.0.2.5',Array(34).fill('192.0.2.5').join(',')])assert.throws(()=>clientIdentity(req(chain),config));
 assert.throws(()=>clientIdentity(req('198.51.100.9','10.0.0.2'),config),/Unverified proxy/);
 let now=100000,logins=0;const records=new Map();const store={get:id=>records.get(id),set:(id,r)=>records.set(id,r),delete:id=>records.delete(id),lock:async(id,fn)=>fn()};
 const provider={async login(){logins++;throw Object.assign(Error('Invalid fixture credentials'),{status:401})},async refresh(){},async verify(){},async logout(){},async push(){},async pull(){}};
 const handler=options=>createSessionService({provider,store,origin:'https://ledger.example',clock:()=>now,...options});
 async function login(h,email,chain,peer='10.0.0.1',extra={}){let status;const r=req(chain,peer);Object.assign(r,{method:'POST',url:'/api/sync/session'});Object.assign(r.headers,{origin:'https://ledger.example','x-roadledger-client':'1','content-type':'application/json',...extra});r[Symbol.asyncIterator]=async function*(){yield Buffer.from(JSON.stringify({email,password:'fixture'}))};await h(r,{setHeader(){},writeHead(s){status=s},end(){}});return status}
 const h=handler(config);
 // Distinct drivers through exactly the same ingress must not hit a shared 20-request bucket.
 for(let i=1;i<=30;i++)assert.equal(await login(h,'driver-'+i+'@example.test','198.51.100.'+i+', 192.0.2.5'),401);
 // Spoofing leftmost prefixes or alternate headers cannot evade the real-client bucket.
 for(let i=0;i<20;i++)assert.equal(await login(h,'attack-'+i+'@example.test','203.0.113.'+i+', 198.51.100.100, 192.0.2.5'),401);
 assert.equal(await login(h,'attack-next@example.test','1.1.1.1, 198.51.100.100, 192.0.2.5','10.0.0.1',{'cf-connecting-ip':'8.8.8.8','x-real-ip':'8.8.4.4',forwarded:'for=9.9.9.9'}),429);
 // Account throttling spans clients and normalizes account case/whitespace.
 for(let i=1;i<=5;i++)assert.equal(await login(h,'target@example.test','203.0.113.'+i+', 192.0.2.5'),401);
 assert.equal(await login(h,' TARGET@EXAMPLE.TEST ','203.0.113.6, 192.0.2.5'),429);
 const before=logins;assert.equal(await login(h,'untrusted@example.test','198.51.100.9','10.0.0.2'),400);assert.equal(await login(h,'bad@example.test','not-an-ip'),400);assert.equal(logins,before);
 now+=60000;assert.equal(await login(h,'target@example.test','203.0.113.6, 192.0.2.5'),401);
 // Unverified Render chains get account-only protection, never an ingress IP bucket.
 const fallback=handler({trustRenderProxy:true});for(let i=0;i<30;i++)assert.equal(await login(fallback,'fallback-'+i+'@example.test','client-spoof'),401);
 for(let i=0;i<5;i++)assert.equal(await login(fallback,'protected@example.test','client-spoof'),401);assert.equal(await login(fallback,'protected@example.test','changed-spoof'),429);
 // Direct clients cannot rotate their bucket with forwarding headers either.
 const direct=handler({});for(let i=0;i<20;i++)assert.equal(await login(direct,'direct-'+i+'@example.test','198.51.100.'+i,'203.0.113.50'),400);
 const tlsDirect=handler({allowInsecureLoopbackForTests:true});for(let i=0;i<20;i++)assert.equal(await login(tlsDirect,'direct-'+i+'@example.test','198.51.100.'+i,'203.0.113.50'),401);assert.equal(await login(tlsDirect,'direct-next@example.test','9.9.9.9','203.0.113.50'),429);
 console.log('PASS: trusted right-to-left proxy chain, 30 independent drivers, spoof resistance, malformed/unverified chain rejection, IP normalization, per-client/account limits, window reset and safe Render account-only fallback. No SQL/cloud.');
})().catch(e=>{console.error(e);process.exitCode=1});
