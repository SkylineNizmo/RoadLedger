const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs');
const {start,PUBLIC}=require('../backend/production-server.cjs');
const {isHTTPS}=require('../backend/transport.cjs');
(async()=>{
const env={ROADLEDGER_ORIGIN:'https://ledger.example',PORT:'0',ROADLEDGER_PROXY_MODE:'render',RENDER:'true',RENDER_SERVICE_ID:'local-fixture'};
assert.throws(()=>start({...env,RENDER:'false'}),/Render/);
assert.throws(()=>start({...env,PORT:'bad'}),/PORT/);
assert.throws(()=>start({...env,ROADLEDGER_CLOUD_SYNC:'enabled'}),/verified trusted client chain/);
assert.throws(()=>start({...env,ROADLEDGER_CLIENT_IP_MODE:'leftmost'}),/client IP mode/);
assert.throws(()=>start({...env,ROADLEDGER_CLIENT_IP_MODE:'trusted-chain'}),/verified proxy/);
assert.throws(()=>start({...env,ROADLEDGER_TRUSTED_PROXY_IPS:'not-an-IP'}),/proxy IP/);
assert.throws(()=>start({...env,ROADLEDGER_TRUSTED_PROXY_CIDRS:'0.0.0.0/0'}),/proxy CIDR/);
assert.throws(()=>start({...env,ROADLEDGER_ORIGIN:'http://ledger.example'}),/HTTPS/);
assert.throws(()=>start({...env,ROADLEDGER_CLOUD_SYNC:'typo'}),/mode/);
assert.equal(isHTTPS({socket:{remoteAddress:'attacker'},headers:{'x-forwarded-proto':'https'}}),false);
assert.equal(isHTTPS({socket:{remoteAddress:'192.0.2.1'},headers:{'x-forwarded-proto':'https,http'}},{trustedProxyIPs:['192.0.2.1']}),false);
assert.equal(isHTTPS({socket:{remoteAddress:'192.0.2.1'},headers:{'x-forwarded-proto':'https'}},{trustedProxyIPs:['192.0.2.1']}),true);
const server=start(env);await new Promise(r=>server.once('listening',r));assert.equal(server.address().address,'0.0.0.0');
const request=(url,headers={},method='GET')=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:url,method,headers:{Host:'ledger.example','X-Forwarded-Proto':'https',...headers}},res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}))});req.on('error',reject);req.end()});
try{
assert.equal((await request('/healthz',{'X-Forwarded-Proto':'http'})).status,200);
assert.equal(JSON.parse((await request('/healthz')).body).cloudSync,'disabled');
for(const file of PUBLIC){const res=await request('/'+file);assert.equal(res.status,200,file);assert.ok(res.headers['content-type']);assert.equal(res.headers['cache-control'],'no-cache')}
for(const file of ['/backend/supabase.sql','/.git/config','/.env','/package.json','/tests/sessions.cjs','/../backend/session-store.cjs','/%2e%2e/backend/supabase.sql','//evil.example/index.html'])assert.ok([400,404].includes((await request(file)).status),file);
assert.equal((await request('/',{Host:'attacker.example'})).status,421);
assert.equal((await request('/',{'X-Forwarded-Proto':'http'})).status,400);
assert.equal((await request('/',{'X-Forwarded-Proto':'https,http'})).status,400);
assert.equal((await request('/api/sync/session')).status,503);
assert.equal((await request('/api/sync/session',{},'POST')).status,503);
assert.equal((await request('/',{},'HEAD')).body.length,0);
assert.equal((await request('/',{},'POST')).status,405);
assert.equal((await request('/sw.js')).headers['service-worker-allowed'],'/');
assert.match((await request('/sync/config.js')).body.toString(),/mode:'disabled'/);
assert.equal((await request('/')).headers['strict-transport-security'],'max-age=31536000');
for(const n of [192,512]){const png=fs.readFileSync('icon-'+n+'.png');assert.equal(png.readUInt32BE(16),n);assert.equal(png.readUInt32BE(20),n)}
console.log('PASS: Render port/binding, fail-closed proxy/host checks, health probe, public asset allowlist, disabled cloud API, HTTP methods, service worker headers, and PWA PNG icons.');
}finally{await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
