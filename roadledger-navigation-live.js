/* Deliberately disabled boundary. No settings, credentials or HTTP transport can enable it. */
(function(root){
'use strict';
function createDisabledLiveAdapter(){
 const unavailable=async()=>{throw Object.assign(Error('Real HERE routing is disabled. Only the local simulation is available.'),{code:'LIVE_ROUTING_DISABLED'})};
 return Object.freeze({mode:'disabled',available:false,calculate:unavailable,geocode:unavailable});
}
// Pure view model preparation only: never fetches, writes records or starts guidance.
function prepareRouteDisplay(value){
 const invalid=()=>{throw Error('Invalid real route display response.')};
 if(!value||value.protocol!==1||value.provider!=='here'||value.simulation!==false||value.safeForNavigation!==false||!Array.isArray(value.routes)||!value.routes.length||value.routes.length>3)invalid();
 const point=p=>{if(!Array.isArray(p)||p.length!==2||!Number.isFinite(p[0])||Math.abs(p[0])>90||!Number.isFinite(p[1])||Math.abs(p[1])>180)invalid();return [...p]};
 const text=t=>{if(typeof t!=='string'||!t.trim()||t.length>5000||/[\x00-\x1f\x7f]/.test(t))invalid();return t};
 return {simulation:false,safeForNavigation:false,guidanceEnabled:false,warning:'Preview only. Clearance is not guaranteed. Live navigation disabled.',routes:value.routes.map(r=>{
  if(!r||!Array.isArray(r.points)||r.points.length<2||r.points.length>4096||!Array.isArray(r.maneuvers)||r.maneuvers.length>5000||!Array.isArray(r.warnings)||r.warnings.length>500||!Number.isFinite(r.length)||r.length<0||r.length>1e9||!Number.isFinite(r.duration)||r.duration<0||r.duration>1e9)invalid();
  const points=r.points.map(point);
  return {points,length:r.length,duration:r.duration,maneuvers:r.maneuvers.map(m=>{if(!m||!Number.isInteger(m.offset)||m.offset<0||m.offset>=points.length)invalid();const p=point(m.position);if(p[0]!==points[m.offset][0]||p[1]!==points[m.offset][1])invalid();return {instruction:text(m.instruction),position:p,offset:m.offset}}),warnings:r.warnings.map(w=>({code:text(w.code),title:text(w.title),severity:text(w.severity)}))};
 })};
}
const api=Object.freeze({createDisabledLiveAdapter,prepareRouteDisplay});
if(typeof module==='object'&&module.exports)module.exports=api;else root.RoadLedgerNavigationLive=api;
})(typeof window==='undefined'?globalThis:window);
