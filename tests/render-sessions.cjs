/* Actual production launcher and persistent encrypted store; fictional provider only. */
const assert=require('node:assert/strict'),http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {start}=require('../backend/production-server.cjs');
(async()=>{
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'roadledger-render-'));let server,calls=0;
const env={ROADLEDGER_ORIGIN:'https://ledger.example',PORT:'0',ROADLEDGER_PROXY_MODE:'render',RENDER:'true',RENDER_SERVICE_ID:'local-fixture',ROADLEDGER_CLIENT_IP_MODE:'trusted-chain',ROADLEDGER_TRUSTED_PROXY_IPS:'127.0.0.1',ROADLEDGER_CLOUD_SYNC:'enabled',SUPABASE_URL:'https://unused.example',SUPABASE_PUBLISHABLE_KEY:'unused-fixture',ROADLEDGER_SESSION_DIRECTORY:directory,ROADLEDGER_SESSION_KEY:crypto.randomBytes(32).toString('base64')};
const provider={async login(){calls++;return {access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600}},async verify(){return {id:'fixture-user',email_confirmed_at:'2026-10-19'}},async refresh(){throw Error('Not expected')},async logout(){calls++},async push(){throw Error('Not expected')},async pull(){return {changes:[],cursor:0,hasMore:false}}};
async function launch(){server=start(env,{provider});await new Promise(r=>server.once('listening',r))}
async function stop(){if(server){await new Promise(r=>server.close(r));server=null}}
function request(method='GET',cookie,csrf,body,clientIP='198.51.100.1'){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:'/api/sync/session',method,headers:{Host:'ledger.example','X-Forwarded-Proto':'https','X-Forwarded-For':clientIP,Origin:env.ROADLEDGER_ORIGIN,'X-RoadLedger-Client':'1','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})}},res=>{let text='';res.on('data',x=>text+=x);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(text)}))});req.on('error',reject);req.end(body?JSON.stringify(body):undefined)})}
try{
await launch();assert.equal((await request()).status,401);const login=await request('POST',null,null,{email:'fixture@example.test',password:'fixture-password'});assert.equal(login.status,200);const cookie=login.headers['set-cookie'][0].split(';')[0],csrf=login.body.csrf;assert.equal(calls,1);
for(const attribute of ['Secure','HttpOnly','SameSite=Strict'])assert.ok(login.headers['set-cookie'][0].includes(attribute));
assert.equal((await request('GET',cookie)).status,200);assert.equal((await request('DELETE',cookie,'wrong')).status,403);
await stop();assert.equal(fs.existsSync(path.join(directory,'.single-process')),false);await launch();assert.equal((await request('GET',cookie)).status,200);assert.equal(calls,1);
const disk=fs.readdirSync(directory).filter(x=>x.endsWith('.session')).map(x=>fs.readFileSync(path.join(directory,x)).toString()).join('');assert.equal(disk.includes('fixture-access'),false);assert.equal(disk.includes('fixture-refresh'),false);
assert.equal((await request('DELETE',cookie,csrf)).status,200);assert.equal((await request('GET',cookie)).status,401);
for(let i=2;i<=31;i++)assert.equal((await request('POST',null,null,{email:'driver-'+i+'@example.test',password:'fixture-password'},'198.51.100.'+i)).status,200);
console.log('PASS: actual Render production launcher, secure session cookie/CSRF, encrypted disk, graceful lease release, restart session persistence, logout, and independent driver limits through production proxy configuration. No live provider requests.');
}finally{await stop();fs.rmSync(directory,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
