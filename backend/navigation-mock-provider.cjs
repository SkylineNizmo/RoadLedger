/* No HTTP client: fixture results only. Scenarios are test-constructor options, never request fields. */
'use strict';
const Core=require('../roadledger-navigation-core.js'),providers=new WeakSet();
function createMockProvider({scenario='sample',delayMs=10,ignoreAbort=false,onCall=()=>{}}={}){
 if(!['sample','error','no-route','malformed-route','malformed-geocode'].includes(scenario)||!Number.isSafeInteger(delayMs)||delayMs<0||delayMs>10000)throw Error('Invalid local fixture provider');
 async function run(operation,input,{signal}){
  onCall(operation,input);
  await new Promise((resolve,reject)=>{let timer;function abort(){clearTimeout(timer);signal.removeEventListener('abort',abort);reject(Object.assign(Error('Fixture cancelled'),{code:'CANCELLED'}))}timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve()},delayMs);if(!ignoreAbort){if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true})}});
  if(scenario==='error')throw Error('Fictional private provider diagnostics must never be returned');
  if(operation==='geocode')return scenario==='malformed-geocode'?{simulation:true,items:[{id:'bad',title:'bad',position:{latitude:999,longitude:0}}]}:{simulation:true,items:[{id:'mock-place-1',title:'SAMPLE fixed Las Vegas location — not the searched address',position:{latitude:36.175,longitude:-115.132}}]};
  const result=Core.fixture();if(scenario==='no-route')result.routes=[];if(scenario==='malformed-route')result.routes[0].sections[0].polyline='invalid!';return result;
 }
 const p=Object.freeze({kind:'local-mock-provider',execute:run});providers.add(p);return p;
}
module.exports={createMockProvider,isMockProvider:value=>providers.has(value)};
