/* Local navigation foundations. No networking, credentials, storage or real route computation. */
(function(root){
'use strict';
const equipment=typeof module==='object'&&module.exports?require('./roadledger-equipment.js'):root.RoadLedgerEquipment;
const MAX_AGE=30000,MAX_ACCURACY=100,clone=v=>structuredClone(v);
const present=v=>v!==undefined&&v!==null&&v!=='';
function fail(message){throw Error(message)}
function positive(value,name){if(!present(value)||!['number','string'].includes(typeof value)||typeof value==='string'&&!/^\d+(?:\.\d+)?$/.test(value.trim())||!Number.isFinite(Number(value))||Number(value)<=0)fail('Enter a positive '+name);return Number(value)}
function validPosition(p){return p&&Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=90&&Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180&&Number.isFinite(p.accuracy)&&p.accuracy>=0&&Number.isFinite(p.timestamp)&&p.timestamp>0}
function createGPS({geolocation,now=()=>Date.now(),onChange=()=>{}}){
 let position=null,watchId=null,tracking=false,epoch=0,once=0,status='idle';
 function snapshot(){const age=position?Math.max(0,now()-position.timestamp):null;const current=status==='ready'&&age<=MAX_AGE;return {position:position?clone(position):null,tracking,status:status==='ready'&&!current?'stale':status,ageMs:age,usable:!!(current&&position.accuracy<=MAX_ACCURACY)}}
 function emit(){onChange(snapshot())}
 function stop(reason='stopped'){epoch++;once++;if(watchId!==null){try{geolocation.clearWatch(watchId)}catch{}watchId=null}tracking=false;status=reason;emit()}
 function error(e){stop(e?.code===1?'denied':e?.code===3?'timeout':'unavailable')}
 function accept(raw){
  const p={latitude:raw?.coords?.latitude,longitude:raw?.coords?.longitude,accuracy:raw?.coords?.accuracy,timestamp:raw?.timestamp};
  if(!validPosition(p)||p.timestamp>now()+5000){status='invalid';emit();return false}
  if(position&&p.timestamp<position.timestamp)return false;
  position=p;status=now()-p.timestamp>MAX_AGE?'stale':p.accuracy>MAX_ACCURACY?'poor-accuracy':'ready';emit();return true;
 }
 function locate(){
  if(!geolocation){status='unsupported';emit();return}
  const token=++once,generation=epoch;status='requesting';emit();
  try{geolocation.getCurrentPosition(p=>{if(generation===epoch&&token===once)accept(p)},e=>{if(generation===epoch&&token===once)error(e)},{enableHighAccuracy:true,timeout:12000,maximumAge:0})}catch{error()}
 }
 function start(){
  if(tracking)return;
  if(!geolocation){status='unsupported';emit();return}
  const generation=++epoch;once++;tracking=true;status='requesting';emit();
  try{
   const id=geolocation.watchPosition(p=>{if(generation===epoch)accept(p)},e=>{if(generation===epoch)error(e)},{enableHighAccuracy:true,maximumAge:3000,timeout:15000});
   if(generation===epoch)watchId=id;else try{geolocation.clearWatch(id)}catch{}
  }catch{error()}
 }
 return Object.freeze({snapshot,start,stop,locate});
}
function prefill(main,extras){
 const truck=equipment.active(main,extras,'truck'),trailer=equipment.active(main,extras,'trailer');
 const rows=[truck,trailer].filter(Boolean),missing=[],legacy=main.equipment||main;
 for(const type of ['truck','trailer'])if(extras[type==='truck'?'activeTruckId':'activeTrailerId']&&!({truck,trailer})[type])missing.push('Selected '+type+' is unavailable. Review My Equipment.');
 const fields=['id','name','type','heightFt','widthFt','lengthFt','loadedWeightLb','emptyWeightLb','gvwrLb','axleCount','equipmentLegacySource'];
 const selected=rows.map(r=>Object.fromEntries(fields.map(k=>[k,r[k]??''])));
 const safe=v=>{try{return positive(v,'measurement')}catch{return null}};
 const all=field=>rows.length&&rows.every(r=>safe(r[field])!==null);
 const values={height:'',width:'',length:'',weight:'',axles:''};
 if(!missing.length){
  if(all('heightFt'))values.height=Math.max(...rows.map(r=>Number(r.heightFt)));
  if(all('widthFt'))values.width=Math.max(...rows.map(r=>Number(r.widthFt)));
  if(rows.length===1){if(safe(rows[0].lengthFt))values.length=Number(rows[0].lengthFt);if(safe(rows[0].loadedWeightLb))values.weight=Number(rows[0].loadedWeightLb)}
  if(all('axleCount')){const count=rows.reduce((n,r)=>n+Number(r.axleCount),0);if(Number.isInteger(count)&&count<=30)values.axles=count}
  // Preserve original combined defaults only while the original equipment is selected.
  if(extras.activeTruckId!==''&&extras.activeTrailerId!==''&&((rows.length&&rows.every(r=>r.equipmentLegacySource))||(!rows.length&&extras.activeTruckId===undefined&&extras.activeTrailerId===undefined)))for(const [field,key]of [['height','equipmentHeight'],['width','equipmentWidth'],['axles','equipmentAxles']])if(values[field]===''&&safe(legacy[key]))values[field]=Number(legacy[key]);
 }
 const notes=[...missing,'Profile values are suggestions only. Confirm the actual loaded combination, cargo, overhang and axles.'];
 if(truck&&trailer)notes.push('Coupled length and combined loaded weight are deliberately blank: do not simply add overlapping lengths, ratings or transferred/cargo weights.');
 if(!rows.length)notes.push('No active equipment selected. Enter and confirm all measurements manually.');
 return {values,selected,notes,available:!missing.length,signature:JSON.stringify({selected,missing,legacy:rows.every(r=>r.equipmentLegacySource)?[legacy.equipmentHeight,legacy.equipmentWidth,legacy.equipmentAxles]:null})};
}
function validateInput(input){
 if(input.confirmed!==true)fail('Confirm the actual loaded combination before simulating a route.');
 if(!validPosition(input.origin)||input.origin.timestamp>Date.now()+5000||Date.now()-input.origin.timestamp>MAX_AGE||input.origin.accuracy>MAX_ACCURACY)fail('Get a fresh GPS fix with accuracy of 100 m or better.');
 if(typeof input.destination!=='string'||!input.destination.trim()||input.destination.length>500)fail('Enter a destination (maximum 500 characters).');
 if(!Array.isArray(input.stops)||input.stops.length>20||input.stops.some(s=>typeof s!=='string'||!s.trim()||s.length>500))fail('Use at most 20 nonempty stops (maximum 500 characters each).');
 const measurements={};for(const field of ['height','width','weight','length','axles'])measurements[field]=positive(input.measurements?.[field],field);
 if(!Number.isInteger(measurements.axles)||measurements.axles>30)fail('Axle count must be a whole number from 1 to 30.');
 // Guard numeric overflow before any eventual provider serialization.
 for(const n of Object.values(measurements))if(n>100000000)fail('Measurement is outside the supported planning range.');
 return {...clone(input),destination:input.destination.trim(),measurements};
}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function encodePolyline(points){
 if(!Array.isArray(points)||points.length<2||points.length>4096||points.some(p=>!Array.isArray(p)||p.length!==2||!Number.isFinite(p[0])||Math.abs(p[0])>90||!Number.isFinite(p[1])||Math.abs(p[1])>180))fail('Invalid local polyline coordinates');
 let result='';function write(n){while(n>=32){result+=alphabet[n%32+32];n=Math.floor(n/32)}result+=alphabet[n]}
 write(1);write(5);let lat=0,lng=0;for(const p of points){for(const [n,previous]of [[Math.round(p[0]*1e5),lat],[Math.round(p[1]*1e5),lng]]){const delta=n-previous;write(delta<0?-delta*2-1:delta*2)}lat=Math.round(p[0]*1e5);lng=Math.round(p[1]*1e5)}return result;
}
function decodePolyline(value){
 if(typeof value!=='string'||!value||value.length>65536)fail('Invalid simulated route polyline');
 let offset=0;function read(){let n=0,factor=1,count=0;for(;;){const c=alphabet.indexOf(value[offset++]??'!');if(c<0||++count>10)fail('Invalid simulated route polyline');n+=(c%32)*factor;if(!Number.isSafeInteger(n))fail('Invalid simulated route polyline');if(c<32)return n;factor*=32}}
 if(read()!==1)fail('Unsupported polyline version');const header=read();if(header>15)fail('Only 2D route geometry is supported locally');const scale=10**header;let lat=0,lng=0;const points=[];
 const signed=n=>n%2?-(n+1)/2:n/2;
 while(offset<value.length){lat+=signed(read());lng+=signed(read());if(!Number.isSafeInteger(lat)||!Number.isSafeInteger(lng))fail('Invalid simulated route geometry');const p=[lat/scale,lng/scale];if(Math.abs(p[0])>90||Math.abs(p[1])>180||points.length>=4096)fail('Invalid simulated route geometry');points.push(p)}
 if(points.length<2)fail('Route geometry needs two or more points');return points;
}
const SAMPLE=[[36.1699,-115.1398],[36.1708,-115.1385],[36.172,-115.135],[36.175,-115.132]];
function fixture(){return {simulation:true,routes:[{id:'local-sample-only',sections:[{id:'sample-section',type:'vehicle',transport:{mode:'truck'},departure:{place:{location:{lat:SAMPLE[0][0],lng:SAMPLE[0][1]}}},arrival:{place:{location:{lat:SAMPLE[3][0],lng:SAMPLE[3][1]}}},polyline:encodePolyline(SAMPLE),summary:{length:1200,duration:180},actions:[{action:'depart',offset:0,instruction:'SAMPLE: depart along the orange dashed line.'},{action:'turn',offset:1,instruction:'SAMPLE: turn right. No road or clearance was verified.'},{action:'arrive',offset:3,instruction:'SAMPLE: end of fixture, not your destination.'}],notices:[{code:'SIMULATION_ONLY',title:'Fixed Las Vegas fixture ignores the entered destination, stops and GPS origin. NOT SAFE FOR REAL NAVIGATION.'},{code:'NO_TRUCK_VALIDATION',title:'No bridge, weight, width, height, access restriction or road condition has been checked.'}]}]}]}}
function parseResponse(response){
 if(!response||response.simulation!==true||!Array.isArray(response.routes)||response.routes.length>3)fail('Unsupported simulated routing response');
 if(!response.routes.length)fail('Simulation: no route found. No real routing request was made.');
 const sections=response.routes[0].sections;if(!Array.isArray(sections)||!sections.length||sections.length>10)fail('Invalid route sections');
 const points=[],maneuvers=[],warnings=[];let length=0,duration=0;
 for(const section of sections){const geometry=decodePolyline(section.polyline),summary=section.summary;
  if(!summary||!Number.isFinite(summary.length)||summary.length<0||!Number.isFinite(summary.duration)||summary.duration<0)fail('Invalid simulated route summary');length+=summary.length;duration+=summary.duration;points.push(...geometry);
  if(!Array.isArray(section.actions)||section.actions.length>500||!Array.isArray(section.notices)||section.notices.length>50)fail('Invalid simulated maneuvers / warnings');
  for(const a of section.actions){if(!Number.isInteger(a.offset)||a.offset<0||a.offset>=geometry.length||typeof a.instruction!=='string'||a.instruction.length>5000)fail('Invalid simulated maneuver');maneuvers.push({instruction:a.instruction,position:geometry[a.offset]})}
  for(const n of section.notices){if(typeof n.title!=='string'||n.title.length>5000)fail('Invalid simulated warning');warnings.push(n.title)}
 }
 if(points.length>4096||!Number.isFinite(length)||!Number.isFinite(duration))fail('Simulated route exceeds the local display budget');
 return {simulation:true,points,maneuvers,warnings,length,duration};
}
function createMockAdapter(){return Object.freeze({async calculate(input,{signal,scenario='sample',delay=80}={}){
 validateInput(input);if(!['sample','no-route','error','malformed','slow'].includes(scenario))fail('Unknown local simulation scenario');
 if(!Number.isFinite(delay)||delay<0||delay>60000)fail('Invalid local simulation delay');
 await new Promise((resolve,reject)=>{function abort(){clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new DOMException('Local simulation cancelled','AbortError'))}const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve()},scenario==='slow'?1000:delay);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true})});
 if(scenario==='error')fail('Simulated provider error. No HERE request was made.');if(scenario==='no-route')return {simulation:true,routes:[]};const result=fixture();if(scenario==='malformed')result.routes[0].sections[0].polyline='invalid!';return result;
}})}
const api={MAX_AGE,MAX_ACCURACY,createGPS,prefill,validateInput,encodePolyline,decodePolyline,fixture,parseResponse,createMockAdapter};
if(typeof module==='object'&&module.exports)module.exports=api;else root.RoadLedgerNavigationCore=Object.freeze(api);
})(typeof window==='undefined'?globalThis:window);
