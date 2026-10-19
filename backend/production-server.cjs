/* Importing this module never starts a listener or contacts a cloud service. */
const http=require('node:http'),https=require('node:https'),fs=require('node:fs'),path=require('node:path');
const {EncryptedSessionStore}=require('./session-store.cjs');
const {createSessionService}=require('./session-service.cjs');
const {createSupabaseProvider}=require('./supabase-provider.cjs');
const {isHTTPS,proxyPolicy}=require('./transport.cjs');
const ROOT=path.resolve(__dirname,'..');
// Explicit public files: never expose source, SQL, tests, credentials, or session files.
const PUBLIC=['index.html','icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png','manifest.webmanifest','sw.js','roadledger-storage.js','roadledger-accounting.js','roadledger-navigation.js','roadledger-ai.js','roadledger-gps.js','roadledger-weather.js','sync/config.js','sync/protocol.js','sync/core.js','sync/http.js','sync/app.js'];
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
function start(env=process.env,{provider:injectedProvider}={}){
 const origin=new URL(env.ROADLEDGER_ORIGIN||'');
 if(origin.protocol!=='https:'||origin.origin!==env.ROADLEDGER_ORIGIN)throw Error('ROADLEDGER_ORIGIN must be an exact HTTPS origin');
 const port=Number(env.PORT||8080);if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid PORT');
 const trustRenderProxy=env.ROADLEDGER_PROXY_MODE==='render';
 if(trustRenderProxy&&(env.RENDER!=='true'||!env.RENDER_SERVICE_ID))throw Error('Render proxy mode requires the Render service environment');
 if(env.ROADLEDGER_PROXY_MODE&&!['render','ips'].includes(env.ROADLEDGER_PROXY_MODE))throw Error('Invalid proxy mode');
 const trustedProxyIPs=(env.ROADLEDGER_TRUSTED_PROXY_IPS||'').split(',').map(s=>s.trim()).filter(Boolean);
 const trustedProxyCIDRs=(env.ROADLEDGER_TRUSTED_PROXY_CIDRS||'').split(',').map(s=>s.trim()).filter(Boolean);
 const clientIPMode=env.ROADLEDGER_CLIENT_IP_MODE||'auto';
 proxyPolicy({trustedProxyIPs,trustedProxyCIDRs});
 if(!['auto','trusted-chain'].includes(clientIPMode))throw Error('Invalid client IP mode');
 if(clientIPMode==='trusted-chain'&&!trustedProxyIPs.length&&!trustedProxyCIDRs.length)throw Error('Trusted client chain requires verified proxy addresses');
 const directTLS=!!(env.ROADLEDGER_TLS_KEY&&env.ROADLEDGER_TLS_CERT);
 if(!directTLS&&!trustRenderProxy&&!trustedProxyIPs.length)throw Error('TLS or an explicitly trusted HTTPS reverse proxy is required');
 // Fail closed: frontend configuration AND this server gate require deliberate enablement.
 const enabled=env.ROADLEDGER_CLOUD_SYNC==='enabled';
 if(enabled&&trustRenderProxy&&clientIPMode!=='trusted-chain')throw Error('Render cloud authentication requires a verified trusted client chain');
 if(env.ROADLEDGER_CLOUD_SYNC&&!['disabled','enabled'].includes(env.ROADLEDGER_CLOUD_SYNC))throw Error('Invalid cloud synchronization mode');
 let store,api;
 try{
 if(enabled){
  for(const name of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','ROADLEDGER_SESSION_KEY','ROADLEDGER_SESSION_DIRECTORY'])if(!env[name])throw Error('Missing server configuration: '+name);
  const key=Buffer.from(env.ROADLEDGER_SESSION_KEY,'base64');
  try{store=new EncryptedSessionStore({directory:env.ROADLEDGER_SESSION_DIRECTORY,key})}finally{key.fill(0)}
  api=createSessionService({provider:injectedProvider||createSupabaseProvider({url:env.SUPABASE_URL,key:env.SUPABASE_PUBLISHABLE_KEY}),store,origin:origin.origin,trustedProxyIPs,trustedProxyCIDRs,trustRenderProxy,clientIPMode});
 }
 const handler=(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:JSON.stringify(body))};
  // Health probes are non-sensitive, do not need authentication, and never query Supabase.
  if(req.url==='/healthz'&&['GET','HEAD'].includes(req.method))return send(200,{status:'ok',cloudSync:enabled?'enabled':'disabled'});
  if(req.headers.host!==origin.host)return send(421,{error:'Host rejected'});
  if(!isHTTPS(req,{trustedProxyIPs,trustedProxyCIDRs,trustRenderProxy,clientIPMode}))return send(400,{error:'HTTPS required'});
  res.setHeader('Strict-Transport-Security','max-age=31536000');
  let url;try{url=new URL(req.url,origin);if(!req.url.startsWith('/')||req.url.startsWith('//')||url.origin!==origin.origin)throw Error()}catch{return send(400,{error:'Invalid URL'})}
  if(url.pathname.startsWith('/api/'))return enabled?api(req,res):send(503,{error:'Cloud synchronization is disabled'});
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return send(405,{error:'Method not allowed'})}
  const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!PUBLIC.includes(file))return send(404,{error:'Not found'});
  // Read before sending headers so missing installation assets return a controlled failure.
  fs.readFile(path.join(ROOT,file),(error,data)=>{
   if(error)return send(503,{error:'Application asset unavailable'});
   res.writeHead(200,{'Content-Type':TYPES[path.extname(file)],'Cache-Control':'no-cache',...(file==='sw.js'?{'Service-Worker-Allowed':'/'}:{})});res.end(req.method==='HEAD'?undefined:data);
  });
 };
 const server=directTLS?https.createServer({key:fs.readFileSync(env.ROADLEDGER_TLS_KEY),cert:fs.readFileSync(env.ROADLEDGER_TLS_CERT)},handler):http.createServer(handler);
 server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=40;
 const interval=api?setInterval(()=>api.retryRevocations().catch(()=>{}),60000):null;interval?.unref();
 const cleanup=()=>{if(interval)clearInterval(interval);if(store){store.close();store=null}};
 server.once('close',cleanup);server.once('error',cleanup);
 server.listen(port,'0.0.0.0');return server;
 }catch(error){store?.close();throw error}
}
if(require.main===module){const server=start();const shutdown=()=>{server.close(()=>process.exit(0));server.closeIdleConnections();const deadline=setTimeout(()=>process.exit(1),20000);deadline.unref()};process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown)}
module.exports={start,PUBLIC};
