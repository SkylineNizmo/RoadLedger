/* Loopback-only development server. Fictional users; never deploy this server. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const args=process.argv.slice(2);const arg=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const port=Number(arg('--port','8000')),dataFile=arg('--data',null);
let cloud=dataFile&&fs.existsSync(dataFile)?JSON.parse(fs.readFileSync(dataFile,'utf8')):{users:{}};
const sessions=new Map();const password='local-demo-only';
const users={'driver@example.test':'demo-driver','other@example.test':'demo-other'};
const persist=()=>{if(dataFile){fs.mkdirSync(path.dirname(path.resolve(dataFile)),{recursive:true});const file=path.resolve(dataFile);fs.writeFileSync(file+'.tmp',JSON.stringify(cloud),{mode:0o600});fs.renameSync(file+'.tmp',file)}};
function validateKey(key){try{const pair=JSON.parse(key);return Array.isArray(pair)&&pair.length===2&&['loads','equipment','settings','mileage','expenses','maintenance','fleet','documents','ifta','extraMetadata','tires','routeSpecs','routeStops'].includes(pair[0])&&typeof pair[1]==='string'&&pair[1].length>0&&key===JSON.stringify(pair)}catch{return false}}
function start(){const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
 const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value))};
 const url=new URL(req.url,'http://'+req.headers.host);
 if(!url.pathname.startsWith('/api/sync/')){
  const pathname=url.pathname==='/'?'/index.html':url.pathname;
  const allowed=/^\/(index\.html|roadledger-[\w-]+\.js|sync\/[\w-]+\.js|sw\.js|manifest\.webmanifest|icon\.svg)$/.test(pathname);
  if(!allowed||req.method!=='GET')return send(404,{error:'Not found'});
  try{const types={'.html':'text/html','.js':'text/javascript','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};res.writeHead(200,{'Content-Type':types[path.extname(pathname)]||'application/octet-stream','Cache-Control':'no-cache'});return res.end(fs.readFileSync(path.join(ROOT,pathname)))}catch{return send(404,{error:'Not found'})}
 }
 try{
  if(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)return send(403,{error:'Origin rejected'});
  if(req.method!=='GET'&&req.headers['x-roadledger-client']!=='1')return send(403,{error:'Client header required'});
  let body={};if(['POST','PUT'].includes(req.method)){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>1024*1024)return send(413,{error:'Request too large'})}body=raw?JSON.parse(raw):{}}
  const route=url.pathname.slice('/api/sync/'.length);
  if(route==='session'&&req.method==='POST'){
   if(!Object.hasOwn(users,body.email)||body.password!==password)return send(401,{error:'Invalid fictional demo credentials'});
   const sid=crypto.randomUUID(),csrf=crypto.randomUUID(),userId=users[body.email];sessions.set(sid,{userId,csrf,expires:Date.now()+60*60*1000});res.setHeader('Set-Cookie',`roadledger_demo=${sid}; HttpOnly; SameSite=Strict; Path=/api/sync/`);return send(200,{userId,csrf,mock:true});
  }
  const sid=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('roadledger_demo='))?.split('=')[1];const session=sessions.get(sid);
  if(!session||session.expires<Date.now())return send(401,{error:'Session expired; sign in again'});
  if(req.headers['x-workspace-user']&&req.headers['x-workspace-user']!==session.userId)return send(403,{error:'Workspace account mismatch'});
  if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)return send(403,{error:'CSRF check failed'});
  if(route==='session'&&req.method==='GET')return send(200,{userId:session.userId,csrf:session.csrf,mock:true});
  if(route==='session'&&req.method==='DELETE'){sessions.delete(sid);res.setHeader('Set-Cookie','roadledger_demo=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/api/sync/');return send(200,{ok:true})}
  const state=cloud.users[session.userId]||{records:{},operations:{},changes:[],cursor:0};
  if(route==='pull'&&req.method==='GET'){const cursor=Number(url.searchParams.get('cursor'));if(!Number.isSafeInteger(cursor)||cursor<0||cursor>state.cursor)return send(409,{error:'Invalid cursor or cloud reset; recovery required'});return send(200,{changes:state.changes.filter(c=>c.cursor>cursor),cursor:state.cursor})}
  if(route==='push'&&req.method==='POST'){
   if(!validateKey(body.key)||!Object.hasOwn(body,'value')||!Number.isSafeInteger(body.baseVersion)||body.baseVersion<0||typeof body.opId!=='string'||!body.opId||body.opId.length>100)return send(400,{error:'Invalid operation'});
   const fingerprint=JSON.stringify([body.key,body.value,body.baseVersion]);const prior=state.operations[body.opId];if(prior){if(prior.fingerprint!==fingerprint)return send(409,{error:'Operation ID reused with different data'});return send(200,prior.reply)}
   const existing=state.records[body.key]||{version:0,value:null};if(existing.version!==body.baseVersion)return send(200,{conflict:true,record:existing});
   const previous=JSON.stringify(cloud);const record={version:existing.version+1,value:body.value};const reply={conflict:false,record};state.records[body.key]=record;state.operations[body.opId]={fingerprint,reply};state.cursor++;state.changes.push({key:body.key,...record,cursor:state.cursor});cloud.users[session.userId]=state;
   try{persist()}catch(error){cloud=JSON.parse(previous);throw error}return send(200,reply);
  }
  return send(404,{error:'Unknown operation'});
 }catch(error){send(error instanceof SyntaxError?400:500,{error:error instanceof SyntaxError?'Invalid JSON':'Mock service error'})}
 });server.listen(port,'127.0.0.1',()=>process.stdout.write(`RoadLedger MOCK only: http://127.0.0.1:${server.address().port}/?sync=mock\n`));return server}
if(require.main===module)start();module.exports={start,validateKey};
