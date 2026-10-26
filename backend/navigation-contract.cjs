/* Local planning contract only. These are not serialized HERE parameters. */
'use strict';
const {parseResponse}=require('../roadledger-navigation-core.js');
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function invalid(){throw Object.assign(Error('Invalid navigation request'),{code:'INVALID_REQUEST',status:422})}
function fields(v,keys){if(!object(v)||Object.keys(v).sort().join('|')!==[...keys].sort().join('|'))invalid()}
function number(v,min,max,integer=false){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||integer&&!Number.isInteger(v))invalid();return v}
function text(v,max){if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u001f\u007f]/.test(v))invalid();return v.trim()}
function point(v){fields(v,['latitude','longitude']);return {latitude:number(v.latitude,-90,90),longitude:number(v.longitude,-180,180)}}
function requestId(v){if(typeof v!=='string'||!/^[-_A-Za-z0-9]{8,80}$/.test(v))invalid();return v}
// Exact rational conversion + conservative upward rounding. Never use GVWR as actual mass.
function ceilRatio(v,scale,numerator,denominator){number(v,0.001,1000000);const s=String(v);if(!/^\d+(?:\.\d{1,3})?$/.test(s))invalid();const [whole,part='']=s.split('.'),scaled=BigInt(whole)*BigInt(scale)+BigInt(part.padEnd(3,'0')),divisor=BigInt(scale)*BigInt(denominator),product=scaled*BigInt(numerator),n=(product+divisor-1n)/divisor;if(n>BigInt(Number.MAX_SAFE_INTEGER))invalid();return Number(n)}
function vehicle(v){
 fields(v,['heightFt','widthFt','lengthFt','actualLoadedWeightLb','axleCount','trailerCount']);
 for(const k of ['heightFt','widthFt','lengthFt'])number(v[k],0.001,1000);number(v.actualLoadedWeightLb,0.001,1000000);number(v.axleCount,1,30,true);number(v.trailerCount,0,1,true);
 return {heightCm:ceilRatio(v.heightFt,1000,3048,100),widthCm:ceilRatio(v.widthFt,1000,3048,100),lengthCm:ceilRatio(v.lengthFt,1000,3048,100),actualLoadedMassKg:ceilRatio(v.actualLoadedWeightLb,1000,45359237,100000000),axleCount:v.axleCount,trailerCount:v.trailerCount};
}
function validate(operation,v,now=Date.now()){
 if(operation==='geocode'){fields(v,['requestId','query']);return {requestId:requestId(v.requestId),query:text(v.query,500)}}
 if(operation!=='route')invalid();fields(v,['requestId','origin','destination','stops','vehicle','confirmed']);if(v.confirmed!==true)invalid();
 fields(v.origin,['latitude','longitude','accuracy','timestamp']);const origin=point({latitude:v.origin.latitude,longitude:v.origin.longitude});number(v.origin.accuracy,0,100);number(v.origin.timestamp,1,Number.MAX_SAFE_INTEGER,true);if(now-v.origin.timestamp>30000||v.origin.timestamp-now>5000)invalid();
 if(!Array.isArray(v.stops)||v.stops.length>5)invalid();
 return {requestId:requestId(v.requestId),origin:{...origin,accuracy:v.origin.accuracy,timestamp:v.origin.timestamp},destination:point(v.destination),stops:v.stops.map(point),vehicle:vehicle(v.vehicle),confirmed:true};
}
function response(operation,value){
 if(!object(value)||value.simulation!==true)throw Error('Invalid simulated provider response');
 if(operation==='route'){parseResponse(value);for(const route of value.routes)parseResponse({simulation:true,routes:[route]});return {simulation:true,routes:value.routes.map(route=>({id:'local-sample-only',sections:route.sections.map(s=>({polyline:s.polyline,summary:{length:s.summary.length,duration:s.summary.duration},actions:s.actions.map(a=>({offset:a.offset,instruction:a.instruction})),notices:s.notices.map(n=>({title:n.title}))}))}))}}
 if(!Array.isArray(value.items)||value.items.length>5)throw Error('Invalid simulated geocode response');
 return {simulation:true,items:value.items.map(item=>{if(!object(item)||typeof item.id!=='string'||!/^mock-place-\d+$/.test(item.id))throw Error('Invalid simulated geocode response');return {id:item.id,title:text(item.title,160),position:point(item.position)}})};
}
module.exports={validate,vehicle,response};
