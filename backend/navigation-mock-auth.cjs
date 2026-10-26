/* Fictional, RAM-only sessions minted by local tests, never by an HTTP login endpoint. */
'use strict';
const crypto=require('node:crypto'),sessions=new WeakMap();
const reject=(status=401)=>{throw Object.assign(Error('Navigation access denied'),{status,code:status===401?'UNAUTHORIZED':'FORBIDDEN'})};
function createMockAuth({clock=Date.now}={}){
 const rows=new Map(),users=new Set();
 const api={kind:'local-mock-auth',issue({user='fictional-owner',scopes=['geocode','route'],ttlMs=600000}={}){
  if(!/^fictional-[a-z0-9-]{1,40}$/.test(user)||!Array.isArray(scopes)||scopes.some(s=>!['route','geocode'].includes(s))||!Number.isSafeInteger(ttlMs)||ttlMs<1||ttlMs>3600000||rows.size>=32||users.size>=8&&!users.has(user))throw Error('Invalid local fixture session');
  const id=crypto.randomBytes(32).toString('base64url'),csrf=crypto.randomBytes(32).toString('base64url');users.add(user);rows.set(id,{user,scopes:[...scopes],csrf,expires:clock()+ttlMs});return {id,csrf,cookie:'roadledger_navigation_mock='+id};
 },revoke(id){rows.delete(id)},authorize(req,operation){
  const found=(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith('roadledger_navigation_mock='));if(found.length!==1)reject();const id=found[0].slice('roadledger_navigation_mock='.length),s=rows.get(id);if(!s)reject();if(s.expires<=clock()){rows.delete(id);reject()}
  if(!s.scopes.includes(operation))reject(403);const csrf=req.headers['x-navigation-csrf'];if(typeof csrf!=='string'||Buffer.byteLength(csrf)!==Buffer.byteLength(s.csrf)||!crypto.timingSafeEqual(Buffer.from(csrf),Buffer.from(s.csrf)))reject(403);return {user:s.user};
 }};sessions.set(api,true);return Object.freeze(api);
}
module.exports={createMockAuth,isMockAuth:value=>sessions.has(value)};
