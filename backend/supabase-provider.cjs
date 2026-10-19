/* Server-side adapter only. Needs a same-origin session host; never send tokens to app JS. */
const protocol=require('../sync/protocol.js');
function createSupabaseProvider({url,key,fetchImpl=fetch}){
 const base=new URL(url);if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw Error('Supabase requires a clean HTTPS project URL');
 if(!key||key.startsWith('sb_secret_'))throw Error('Use the publishable/anon key, never a service-role key');
 if(key.split('.').length===3){try{if(JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='service_role')throw Error('Service-role keys are forbidden')}catch(e){if(e.message==='Service-role keys are forbidden')throw e}}
 async function request(route,{token,body,method='POST'}={}){
  const response=await fetchImpl(new URL(route,base),{method,headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  const result=response.status===204?null:await protocol.readResponse(response);if(!response.ok)throw Object.assign(Error('Cloud provider request failed'),{status:response.status});return result;
 }
 return {
  login:(email,password)=>request('/auth/v1/token?grant_type=password',{body:{email,password}}),
  refresh:refreshToken=>request('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:refreshToken}}),
  verify:accessToken=>request('/auth/v1/user',{token:accessToken,method:'GET'}),
  logout:accessToken=>request('/auth/v1/logout?scope=local',{token:accessToken}),
  push:(accessToken,operation)=>{protocol.validateOperation(operation);return request('/rest/v1/rpc/roadledger_push',{token:accessToken,body:{p_key:operation.key,p_value:{data:operation.value},p_base_version:operation.baseVersion,p_operation_id:operation.opId}})},
  pull:(accessToken,cursor)=>request('/rest/v1/rpc/roadledger_pull',{token:accessToken,body:{p_since:cursor}})
 };
}
module.exports={createSupabaseProvider};
