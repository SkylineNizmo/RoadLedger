/* Deliberately disabled boundary. No settings, credentials or HTTP transport can enable it. */
(function(root){
'use strict';
function createDisabledLiveAdapter(){
 const unavailable=async()=>{throw Object.assign(Error('Real HERE routing is disabled. Only the local simulation is available.'),{code:'LIVE_ROUTING_DISABLED'})};
 return Object.freeze({mode:'disabled',available:false,calculate:unavailable,geocode:unavailable});
}
const api=Object.freeze({createDisabledLiveAdapter});
if(typeof module==='object'&&module.exports)module.exports=api;else root.RoadLedgerNavigationLive=api;
})(typeof window==='undefined'?globalThis:window);
