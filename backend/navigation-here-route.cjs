/* HERE route boundary: no invented dimension/weight parameters. */
'use strict';
const Contract=require('./navigation-contract.cjs');
const Core=require('../roadledger-navigation-core.js');
const error=code=>Object.assign(Error('HERE route contract unavailable or invalid.'),{code});
const unresolvedVehicle=Object.freeze([
 'heightFt: provider bounds and exact full-combination measurement definition (height uses centimetres)',
 'widthFt: vehicle parameter name, unit, bound and mirror/projection definition',
 'lengthFt: vehicle parameter name, unit, bound and coupled-combination definition',
 'actualLoadedWeightLb: currentWeight versus grossWeight, actual versus permissible mass, combination scope and bounds',
 'axleCount: tractor versus total-combination count, accepted range and trailer axle handling',
 'trailerCount: provider range and additional trailer specifications (1 represents one trailer)',
 'axle loading: supported aggregate/per-axle/axle-group fields, units and bounds (not collected)',
 'restrictions: hazardous goods, tunnel category and other truck restrictions (not collected)'
]);
const verification=Object.freeze({
 source:'https://github.com/heremaps/maps-api-for-javascript-examples/blob/master/truck-routing-road-restrictions/demo.js',
 reference:'https://docs.here.com/routing/reference/routing-api-v8-calculateroutes',
 index:'https://docs.here.com/routing/llms.txt',
 vehicleGuide:'https://docs.here.com/routing/docs/routing-v8-vehicle-properties',
 truckGuide:'https://docs.here.com/routing/docs/routing-v8-network-restricted-truck',
 verified:Object.freeze(['transportMode=truck','vehicle[axleCount] name/example 4','vehicle[trailerCount] name/example 1','vehicle[hazardousGoods] name/example flammable','return=polyline']),
 userReported:Object.freeze(['GET /v8/routes','truck object deprecated; use vehicle','return=polyline,actions,instructions,summary','actions require polyline; instructions require actions','turnByTurnActions requires polyline','vehicle[height]=270 means 2.7 metres; centimetres','vehicle[trailerCount]=1 means one trailer','most towing dimensions/weights describe the combination','truck example: height 420, width 250, length 2000, currentWeight 50000, grossWeight 50000, axleCount 8, trailerAxleCount 4, trailerCount 1']),
 unverified:unresolvedVehicle,complete:false
});
function inspectTruckRequest(raw,{now=Date.now()}={}){
 const input=Contract.validate('route',raw,now);
 // The supplied guide establishes height centimetres and trailer-count meaning.
 // Preview only: neither bounds nor the remaining mandatory mappings are verified.
 // Never serialize this partial preview into a request or infer units from examples.
 const documentedVehiclePreview=Object.freeze({'vehicle[height]':input.vehicle.heightCm,'vehicle[trailerCount]':input.vehicle.trailerCount});
 return Object.freeze({ready:false,requestParameters:null,documentedVehiclePreview,normalizedVehicle:Object.freeze({...input.vehicle}),unresolved:unresolvedVehicle});
}
function buildTruckRequest(raw,options={}){
 inspectTruckRequest(raw,options);
 // No partial request: omitting an unmapped measurement could yield an unsafe route.
 // No caller boolean, environment flag or editable metadata overrides this gate.
 throw error('HERE_PARAMETER_REVIEW_REQUIRED');
}
function text(v,max){if(typeof v!=='string'||!v.trim()||v.length>max||/[\x00-\x1f\x7f]/.test(v))throw error('HERE_INVALID_RESPONSE');return v}
function count(v,max){if(!Number.isFinite(v)||v<0||v>max)throw error('HERE_INVALID_RESPONSE');return v}
function parseRoutes(value){
 if(!value||value.simulation!==undefined||!Array.isArray(value.routes)||value.routes.length>3)throw error('HERE_INVALID_RESPONSE');
 if(!value.routes.length)throw error('HERE_NO_ROUTE');
 const routes=value.routes.map(route=>{
  if(!route||!Array.isArray(route.sections)||!route.sections.length||route.sections.length>10)throw error('HERE_INVALID_RESPONSE');
  const points=[],maneuvers=[],warnings=[];let length=0,duration=0;
  for(const section of route.sections){
   // Reject non-truck/ferry/unsupported section types rather than hiding restrictions.
   if(section.type!=='vehicle'||section.transport?.mode!=='truck')throw error('HERE_UNSUPPORTED_SECTION');
   const geometry=Core.decodePolyline(section.polyline),base=points.length;
   length+=count(section.summary?.length,1e8);duration+=count(section.summary?.duration,1e8);
   if(points.length+geometry.length>4096||!Array.isArray(section.actions)||section.actions.length>500)throw error('HERE_INVALID_RESPONSE');
   points.push(...geometry);
   for(const a of section.actions){
    if(!a||!Number.isInteger(a.offset)||a.offset<0||a.offset>=geometry.length)throw error('HERE_INVALID_RESPONSE');
    maneuvers.push({offset:base+a.offset,instruction:text(a.instruction,5000),position:[...geometry[a.offset]]});
   }
   if(section.notices!==undefined&&!Array.isArray(section.notices)||section.notices?.length>50)throw error('HERE_INVALID_RESPONSE');
   for(const n of section.notices||[]){if(!n)throw error('HERE_INVALID_RESPONSE');warnings.push({code:text(n.code,160),title:n.title===undefined?'Provider route warning: '+text(n.code,160):text(n.title,5000),severity:n.severity===undefined?'unknown':text(n.severity,160)})}
  }
  return {points,maneuvers,warnings,length,duration};
 });
 return {protocol:1,provider:'here',simulation:false,safeForNavigation:false,routes,warning:'Route restrictions and clearance are not guaranteed. Live navigation has not been enabled.'};
}
module.exports={buildTruckRequest,inspectTruckRequest,parseRoutes,verification};
