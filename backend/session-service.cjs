/* Same-origin production BFF handler. Provider tokens never leave encrypted server storage. */
const {isHTTPS,clientIdentity,proxyPolicy}=require('./transport.cjs');const crypto=require('node:crypto');const {isDeepStrictEqual}=require('node:util');const protocol=require('../sync/protocol.js');
const COOKIE='__Host-roadledger_session';const token=()=>crypto.randomBytes(32).toString('base64url');
const failure=(message,status)=>Object.assign(Error(message),{status});
function createSessionService({provider,store,origin,clock=Date.now,allowInsecureLoopbackForTests=false,trustedProxyIPs=[],trustedProxyCIDRs=[],trustRenderProxy=false,clientIPMode='auto'}){
 const rawProvider=provider;provider=Object.fromEntries(['login','refresh','verify','logout','push','pull'].map(name=>{if(typeof rawProvider[name]!=='function')throw Error('Incomplete authentication provider');return [name,async(...args)=>{try{return await rawProvider[name].apply(rawProvider,args)}catch(error){throw failure('Cloud authentication or synchronization request failed',Number.isInteger(error.status)?error.status:502)}}]}));
 const base=new URL(origin);if(base.origin!==origin)throw Error('Configure an exact origin without a path');
 if(base.protocol!=='https:'&&!(allowInsecureLoopbackForTests&&base.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(base.hostname)))throw Error('Production authentication requires HTTPS');
 proxyPolicy({trustedProxyIPs,trustedProxyCIDRs});if(!['auto','trusted-chain'].includes(clientIPMode))throw Error('Invalid client IP mode');
 const loginAttempts=new Map();
 const cookie=(id,age=604800)=>`${COOKIE}=${id}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
 function sessionId(req){const found=(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+'='));if(found.length!==1)return null;const id=found[0].slice(COOKIE.length+1);return /^[A-Za-z0-9_-]{43}$/.test(id)?id:null}
 async function body(req){if(Number(req.headers['content-length'])>protocol.LIMITS.requestBytes)throw failure('Request too large',413);if(!(req.headers['content-type']||'').startsWith('application/json'))throw failure('JSON content type required',415);const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>protocol.LIMITS.requestBytes)throw failure('Request too large',413);chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}')}catch{throw failure('Invalid JSON',400)}}
 function throttle(req,email){
  const now=clock();for(const [k,v]of loginAttempts)if(v.start<=now-60000)loginAttempts.delete(k);
  const ip=clientIdentity(req,{trustedProxyIPs,trustedProxyCIDRs,trustRenderProxy,clientIPMode});
  const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
  const candidates=[['account:'+hash(email.trim().toLowerCase()),5],...(ip?[['ip:'+hash(ip),20]]:[])];
  // Check all limits before incrementing so a blocked account cannot exhaust another bucket.
  for(const [key,limit]of candidates){if(loginAttempts.size>=10000&&!loginAttempts.has(key))throw failure('Try signing in later',429);if((loginAttempts.get(key)?.count||0)>=limit)throw failure('Too many sign-in attempts',429)}
  for(const [key]of candidates){const value=loginAttempts.get(key)||{start:now,count:0};value.count++;loginAttempts.set(key,value)}
 }
 function confirmed(user){if(!user||typeof user.id!=='string'||!user.id||user.is_anonymous===true||!(user.email_confirmed_at||user.phone_confirmed_at||user.confirmed_at))throw failure('A verified permanent account is required',403);return user.id}
 async function verifyRecord(id,record){if(!record||record.revoked||record.expires<=clock())throw failure('Session expired; sign in again',401);
  let next=record;
  if(record.accessExpires<=clock()+60000){let refreshed;try{refreshed=await provider.refresh(record.refreshToken)}catch(error){if(error.status===400||error.status===401)throw failure('Session expired; sign in again',401);throw error}if(!refreshed.access_token||!refreshed.refresh_token||!Number.isFinite(Number(refreshed.expires_in))||Number(refreshed.expires_in)<=0)throw failure('Invalid provider session',502);next={...record,accessToken:refreshed.access_token,refreshToken:refreshed.refresh_token,accessExpires:clock()+Number(refreshed.expires_in)*1000};
   // The session lock is held. Atomically persist rotated credentials before any next request.
   store.set(id,next);
  }
  const user=await provider.verify(next.accessToken);if(confirmed(user)!==record.userId)throw failure('Session identity mismatch',401);return next;
 }
 async function revoke(id,record){store.set(id,{...record,revoked:true});try{await provider.logout(record.accessToken);store.delete(id)}catch{/* Encrypted, locally revoked credentials remain for a safe later revocation retry. */}}
 const handler=async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Cookie'});res.end(JSON.stringify(value))};
  try{
   const secure=isHTTPS(req,{trustedProxyIPs,trustedProxyCIDRs,trustRenderProxy,clientIPMode});if(!secure&&!allowInsecureLoopbackForTests)throw failure('HTTPS required',400);
   const requestOrigin=req.headers.origin;if(requestOrigin&&requestOrigin!==origin||req.headers['sec-fetch-site']==='cross-site')throw failure('Origin rejected',403);
   if(req.method!=='GET'&&(requestOrigin!==origin||req.headers['x-roadledger-client']!=='1'))throw failure('Same-origin client required',403);
   const url=new URL(req.url,origin);const route=url.pathname;
   if(!['/api/sync/session','/api/sync/push','/api/sync/pull'].includes(route))return send(404,{error:'Not found'});
   if(route==='/api/sync/session'&&req.method==='POST'){
    const input=await body(req);if(typeof input.email!=='string'||input.email.length>320||typeof input.password!=='string'||!input.password||input.password.length>1024)throw failure('Invalid sign-in request',400);throttle(req,input.email);
    const login=await provider.login(input.email,input.password);if(!login.access_token||!login.refresh_token||!Number.isFinite(Number(login.expires_in))||Number(login.expires_in)<=0)throw failure('Invalid provider session',502);
    let userId;try{userId=confirmed(await provider.verify(login.access_token))}catch(error){try{await provider.logout(login.access_token)}catch{}throw error}const id=token(),csrf=token();const record={userId,csrf,accessToken:login.access_token,refreshToken:login.refresh_token,accessExpires:clock()+Number(login.expires_in)*1000,expires:clock()+604800000};
    try{store.set(id,record)}catch(error){try{await provider.logout(login.access_token)}catch{}throw error}
    const previous=sessionId(req);if(previous&&previous!==id)await store.lock(previous,async()=>{const old=store.get(previous);if(old)await revoke(previous,old)});
    res.setHeader('Set-Cookie',cookie(id));return send(200,{userId,csrf});
   }
   const id=sessionId(req);if(!id)throw failure('Sign in required',401);
   await store.lock(id,async()=>{
    const stored=store.get(id);if(!stored||stored.revoked||stored.expires<=clock())throw failure('Session expired; sign in again',401);
    if(req.headers['x-workspace-user']&&req.headers['x-workspace-user']!==stored.userId)throw failure('Workspace identity mismatch',403);
    if(req.method!=='GET'){const csrf=req.headers['x-csrf-token'];if(typeof csrf!=='string'||Buffer.byteLength(csrf)!==Buffer.byteLength(stored.csrf)||!crypto.timingSafeEqual(Buffer.from(csrf),Buffer.from(stored.csrf)))throw failure('CSRF check failed',403)}
    if(route==='/api/sync/session'&&req.method==='DELETE'){await revoke(id,stored);res.setHeader('Set-Cookie',cookie('',0));return send(200,{ok:true})}
    const record=await verifyRecord(id,stored);
    if(route==='/api/sync/session'&&req.method==='GET')return send(200,{userId:record.userId,csrf:record.csrf});
    if(route==='/api/sync/push'&&req.method==='POST'){const operation=protocol.validateOperation(await body(req));const reply=await provider.push(record.accessToken,operation);if(!reply||typeof reply.conflict!=='boolean'||!Number.isSafeInteger(reply.record?.version)||reply.record.version<0||!reply.conflict&&(reply.record.version!==operation.baseVersion+1||!isDeepStrictEqual(reply.record.value,operation.value)))throw failure('Invalid provider acknowledgement',502);protocol.validateRecord(operation.key,reply.record.value);return send(200,reply)}
    if(route==='/api/sync/pull'&&req.method==='GET'){const cursor=Number(url.searchParams.get('cursor'));if(!Number.isSafeInteger(cursor)||cursor<0)throw failure('Invalid cursor',400);const reply=await provider.pull(record.accessToken,cursor);protocol.validatePage(reply,cursor);return send(200,reply)}
    return send(405,{error:'Method not allowed'});
   });
  }catch(error){const status=Number.isInteger(error.status)&&error.status>=400&&error.status<500?error.status:502;if(status===401)res.setHeader('Set-Cookie',cookie('',0));send(status,{error:status===502?'Authentication or synchronization service unavailable':error.message})}
 };
 handler.retryRevocations=async()=>{for(const {hash,record}of store.revoked())try{let revoked=record;if(record.accessExpires<=clock()){let renewed;try{renewed=await provider.refresh(record.refreshToken)}catch(error){if([400,401].includes(error.status)){store.deleteHash(hash);continue}throw error}if(!renewed.access_token||!renewed.refresh_token)continue;revoked={...record,accessToken:renewed.access_token,refreshToken:renewed.refresh_token,accessExpires:clock()+Number(renewed.expires_in)*1000};store.setHash(hash,revoked)}await provider.logout(revoked.accessToken);store.deleteHash(hash)}catch{}};
 return handler;
}
module.exports={createSessionService,COOKIE};
