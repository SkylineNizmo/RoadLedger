/* Existing Leaflet GPS map and planner, with shared location state and LOCAL simulated routing only. */
(function(){
'use strict';
const C=RoadLedgerNavigationCore,$=id=>document.getElementById(id),tab=$('routeweatherTab');
if(!tab)return;
const gpsPanel=document.createElement('section');gpsPanel.className='card';gpsPanel.id='roadledgerGpsPlanner';
gpsPanel.innerHTML=`
    <h2>🗺️ RoadLedger GPS Route Planner</h2>

    <p class="muted">
      LOCAL SIMULATION — NOT SAFE FOR REAL NAVIGATION
    </p>

    <div class="stats">

      <div class="stat">
        📍 Current Location
        <strong id="gpsCurrentLocation">
          Not detected
        </strong>
      </div>

      <div class="stat">
        🚛 Routing Mode
        <strong>
          SIMULATION ONLY
        </strong>
      </div>

      <div class="stat">
        🛣️ Route Distance
        <strong id="gpsDistance">
          Not calculated
        </strong>
      </div>

      <div class="stat">
        ⏱️ Estimated Travel Time
        <strong id="gpsTravelTime">
          Not calculated
        </strong>
      </div>

    </div>

    <h3>📍 Starting Location</h3>

    <button type="button" id="gpsDetectLocation">
      Use My Current GPS Location
    </button>

    <p id="gpsLocationStatus" class="muted">
      Waiting for GPS.
    </p>

    <div class="actions"><button id="gpsStartTracking" type="button">Start Tracking</button><button id="gpsStopTracking" type="button" class="secondary">Stop Tracking</button></div><p class="muted">Navigation fixes stay in memory; map providers receive the viewed area. Background/locked-screen tracking is not guaranteed. A fresh fix within 30 seconds and accuracy of 100 m or better is required for this local demo.</p><h3>🏁 Destination</h3>

    <input
      type="text"
      id="gpsDestination"
      placeholder="Enter delivery address or city"
      autocomplete="street-address"
    >

    <h3>📍 Additional Stops</h3>

    <input
      type="text"
      id="gpsStopInput"
      placeholder="Enter pickup, fuel stop, or delivery"
    >

    <button type="button" id="gpsAddStop">
      + Add Stop
    </button>

    <div id="gpsStopsList"></div>

    <h3>🚛 Truck Specifications</h3><p id="gpsEquipmentStatus" class="notice"></p><div id="gpsEquipmentDetails"></div><p class="muted">Editable suggestions from My Equipment. Coupled length and combined loaded weight must be confirmed, never inferred by adding ratings or overlapping measurements. Manual trip edits stay in this tab only.</p>

    <p class="muted">
      Enter the measurements for your current
      truck and trailer combination.
    </p>

    <label for="gpsTruckHeight">
      Overall Height (feet)
    </label>

    <input
      type="number"
      id="gpsTruckHeight"
      placeholder="Example: 13.5"
      min="0"
      step="0.1"
    >

    <label for="gpsTruckWeight">
      Gross Vehicle Weight (lbs)
    </label>

    <input
      type="number"
      id="gpsTruckWeight"
      placeholder="Example: 26000"
      min="0"
      step="1"
    >

    <label for="gpsTruckLength">
      Total Combination Length (feet)
    </label>

    <input
      type="number"
      id="gpsTruckLength"
      placeholder="Example: 55"
      min="0"
      step="0.1"
    >

    <label for="gpsTruckWidth">
      Overall Width (feet)
    </label>

    <input
      type="number"
      id="gpsTruckWidth"
      placeholder="Example: 8.5"
      min="0"
      step="0.1"
    >

    <label for="gpsTruckAxles">
      Total Axles
    </label>

    <input
      type="number"
      id="gpsTruckAxles"
      placeholder="Example: 4"
      min="1"
      step="1"
    >

    <p><label><input id="gpsConfirmCombination" type="checkbox" style="display:inline;width:auto;height:auto"> I reviewed the actual loaded height, width, combination length, gross weight and axle count. This is a simulation only.</label></p><label for="gpsSimulationScenario">Local simulation scenario</label><select id="gpsSimulationScenario"><option value="sample">Sample route (fixed Las Vegas fixture)</option><option value="no-route">No route found</option><option value="error">Provider error</option><option value="malformed">Invalid route response</option><option value="slow">Delayed sample response</option></select>

    <button type="button" id="gpsPlanRoute">
      🛣️ Prepare Truck Route — SIMULATION
    </button>

    <p id="gpsRouteStatus" class="muted">
      Enter your destination to begin planning.
    </p>

    <div id="gpsRouteSummary"></div>

    <p class="notice"><strong>SIMULATED ROUTE — NOT SAFE FOR REAL NAVIGATION.</strong><br>Sample geometry and maneuvers ignore the entered destination, stops and GPS origin.<br>
      ⚠️ Commercial routing service not yet connected.
      No route clearance, road restriction,
      or bridge clearance has been verified.
    </p>
  `;
tab.append(gpsPanel);
const mapSection=document.createElement('section');mapSection.innerHTML=`<h3>🗺️ Live GPS Map</h3><p class="notice"><strong>Any orange dashed route is SIMULATED — NOT SAFE FOR REAL NAVIGATION.</strong> The blue/gray marker is your last GPS fix; the sample route is unrelated to it. Basemap tiles require internet; blank offline tiles do not affect saved records.</p><div id="roadledgerLiveMap" style="width:100%;height:420px;border-radius:12px;overflow:hidden;background:#202b38" role="region" aria-label="Interactive GPS map"></div><div class="actions"><button type="button" id="roadledgerFollowGps">📍 Follow My Location</button><button type="button" id="gpsShowSampleRoute" class="secondary">View sample route area</button></div><p id="roadledgerMapStatus" role="status" class="muted">Loading interactive map…</p>`;gpsPanel.prepend(mapSection);
for(const id of ['gpsLocationStatus','gpsRouteStatus','gpsEquipmentStatus']){$(id).setAttribute('role','status');$(id).setAttribute('aria-live','polite')}
const fieldIds={height:'gpsTruckHeight',width:'gpsTruckWidth',weight:'gpsTruckWeight',length:'gpsTruckLength',axles:'gpsTruckAxles'};
let map=null,mapIssue='Loading local map…',marker=null,accuracyCircle=null,routeLayer=null,lastRoute=null,following=false,mapReady=null,plannedStops=[],generation=0,controller=null,equipmentSignature=null,equipmentReadable=true,externalChange=false,ticker=null,lastGPSState='',dirty=new Set();
const adapter=C.createMockAdapter();
function status(id,message){if($(id).textContent!==message)$(id).textContent=message}
function clearRoute(){if(routeLayer&&map)map.removeLayer(routeLayer);routeLayer=null;lastRoute=null;$('gpsRouteSummary').replaceChildren();$('gpsDistance').textContent='Not calculated';$('gpsTravelTime').textContent='Not calculated'}
function invalidate(message){generation++;controller?.abort();controller=null;clearRoute();if(message)status('gpsRouteStatus',message)}
function stop(reason='stopped'){following=false;session.stop(reason);invalidate('Tracking stopped or suspended. Get a fresh fix before preparing another sample route.')}
function gpsMessage(s){
 const messages={idle:'Tap Start Tracking or Use My Current GPS Location.',requesting:'Requesting GPS location…',stopped:'Tracking stopped. Last fix is not a current route origin.',suspended:'Tracking paused because this page was hidden. Tap Start Tracking to resume.',denied:'Location permission denied. Allow location in browser settings, then retry.',timeout:'GPS timed out. Tracking stopped; retry when a signal is available.',unavailable:'GPS unavailable. Tracking stopped; retry when ready.',unsupported:'GPS is not supported by this browser.',invalid:'GPS returned invalid coordinates or a future timestamp. Route preparation is blocked.',stale:'Last GPS fix is stale. Get a new fix before preparing a route.','poor-accuracy':'GPS accuracy is worse than 100 m. Waiting for a better fix; route preparation is blocked.'};
 return messages[s.status]||(s.tracking?'GPS tracking active':'GPS fix received');
}
function renderGPS(s){
 $('gpsStartTracking').disabled=s.tracking;$('gpsStopTracking').disabled=!s.tracking&&s.status!=='requesting';
 const p=s.position,detail=p?' • last fix '+new Date(p.timestamp).toLocaleTimeString()+' • accuracy ±'+Math.round(p.accuracy)+' m':'';
 status('gpsLocationStatus',gpsMessage(s)+detail);
 status('gpsCurrentLocation',p?p.latitude.toFixed(5)+', '+p.longitude.toFixed(5)+(s.usable?'':' (last known)'):'Not detected');
 if(map&&p){const point=[p.latitude,p.longitude],style={radius:8,color:'#fff',weight:3,fillColor:s.usable?'#126bd1':'#6b7280',fillOpacity:1};if(!marker)marker=L.circleMarker(point,style).addTo(map).bindTooltip('Last GPS fix');else marker.setLatLng(point).setStyle(style);if(accuracyCircle)map.removeLayer(accuracyCircle);accuracyCircle=L.circle(point,{radius:Math.min(p.accuracy,100000),color:style.fillColor,weight:1,fillOpacity:0.08}).addTo(map);if(following&&s.usable)map.setView(point,15)}
 status('roadledgerMapStatus',(map?'':mapIssue+' ')+gpsMessage(s)+(following?' • Follow mode':' • Browse mode')+detail);
 const state=s.status+':'+s.usable;if(state!==lastGPSState&&!s.usable){invalidate('GPS is not fresh and accurate enough. Sample route cleared; get a new fix.');lastGPSState=state}else lastGPSState=state;
}
const session=C.createGPS({geolocation:navigator.geolocation,onChange:renderGPS});
$('gpsDetectLocation').onclick=()=>session.locate();
$('gpsStartTracking').onclick=()=>{following=true;session.start();renderGPS(session.snapshot())};
$('gpsStopTracking').onclick=()=>stop();
$('roadledgerFollowGps').onclick=()=>{following=true;session.start();renderGPS(session.snapshot())};
function loadLeaflet(){
 if(mapReady)return mapReady;
 mapReady=new Promise((resolve,reject)=>{const css=document.createElement('link'),script=document.createElement('script');css.rel='stylesheet';css.href='./vendor/leaflet-1.9.4/leaflet.css';css.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';css.crossOrigin='anonymous';script.src='./vendor/leaflet-1.9.4/leaflet.js';script.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';script.crossOrigin='anonymous';let styled=false,loaded=false,done=false;
 const timer=setTimeout(fail,15000);function fail(){if(done)return;done=true;clearTimeout(timer);css.remove();script.remove();mapReady=null;reject(Error('Local map library unavailable. Reload when the application shell is available.'))}function ready(){if(!done&&styled&&loaded){done=true;clearTimeout(timer);resolve()}}css.onload=()=>{styled=true;ready()};css.onerror=fail;script.onload=()=>{if(!window.L)return fail();loaded=true;ready()};script.onerror=fail;document.head.append(css,script)});return mapReady;
}
function browse(){following=false;renderGPS(session.snapshot())}
async function initializeMap(){try{await loadLeaflet();map=L.map('roadledgerLiveMap').setView([39.5,-98.35],4);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);map.on('dragstart',browse);const el=$('roadledgerLiveMap');el.addEventListener('pointerdown',browse);el.addEventListener('wheel',browse,{passive:true});el.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','+','-'].includes(e.key))browse()});new ResizeObserver(()=>map.invalidateSize()).observe(el);renderGPS(session.snapshot());drawRoute()}catch{mapIssue='Local map unavailable. GPS still works; the sample maneuver list does not require map tiles.';renderGPS(session.snapshot())}}
function drawRoute(){if(!map||!lastRoute)return;if(routeLayer)map.removeLayer(routeLayer);routeLayer=L.polyline(lastRoute.points,{color:'#a64600',weight:6,dashArray:'10 10'}).addTo(map).bindTooltip('SIMULATION ONLY — NOT SAFE FOR REAL NAVIGATION')}
$('gpsShowSampleRoute').onclick=()=>{if(!map||!lastRoute){status('gpsRouteStatus','Load a sample route first. No HERE routing is connected.');return}following=false;map.fitBounds(L.latLngBounds(lastRoute.points),{padding:[25,25]});renderGPS(session.snapshot())};
function prefill(){
 try{const p=C.prefill(data,extra);if(p.signature===equipmentSignature)return;const first=equipmentSignature===null;equipmentSignature=p.signature;equipmentReadable=p.available;
  for(const [name,id]of Object.entries(fieldIds))if(!dirty.has(name))$(id).value=p.values[name];
  $('gpsConfirmCombination').checked=false;invalidate(first?null:'Equipment changed. Manual trip overrides were kept; review and confirm the new combination.');
  status('gpsEquipmentStatus',p.notes.join(' '));const details=$('gpsEquipmentDetails');details.replaceChildren();
  for(const r of p.selected){const line=document.createElement('p');line.textContent=r.name+' · '+r.type+' · ID '+r.id+' · height '+(r.heightFt||'unknown')+' ft · width '+(r.widthFt||'unknown')+' ft · length '+(r.lengthFt||'unknown')+' ft · loaded weight '+(r.loadedWeightLb||'unknown')+' lb · rated GVWR '+(r.gvwrLb||'unknown')+' lb · axles '+(r.axleCount||'unknown');details.append(line)}
 }catch{status('gpsEquipmentStatus','Equipment could not be read safely. Export a backup and review My Equipment.');$('gpsConfirmCombination').checked=false;invalidate('Equipment requires review before a new sample route.');externalChange=true}
}
for(const [name,id]of Object.entries(fieldIds))$(id).addEventListener('input',()=>{dirty.add(name);$('gpsConfirmCombination').checked=false;invalidate('Measurements changed. Confirm the loaded combination again.')});
for(const id of ['gpsDestination','gpsConfirmCombination','gpsSimulationScenario'])$(id).addEventListener(id==='gpsDestination'?'input':'change',()=>invalidate('Route inputs changed. Prepare another simulated route.'));
function renderStops(){const list=$('gpsStopsList');list.replaceChildren();plannedStops.forEach((stop,i)=>{const row=document.createElement('p'),remove=document.createElement('button');row.append(document.createTextNode((i+1)+'. '+stop+' '));remove.type='button';remove.className='secondary';remove.textContent='Remove';remove.onclick=()=>{plannedStops.splice(i,1);invalidate('Stops changed. Prepare another sample.');renderStops()};row.append(remove);list.append(row)})}
$('gpsAddStop').onclick=()=>{const value=$('gpsStopInput').value.trim();if(!value)return;if(value.length>500||plannedStops.length>=20){status('gpsRouteStatus','Use at most 20 stops, each no longer than 500 characters.');return}plannedStops.push(value);$('gpsStopInput').value='';invalidate('Stops changed. Prepare another sample.');renderStops()};
function inputs(){const s=session.snapshot();if(!equipmentReadable)throw Error('Selected equipment is unavailable. Review My Equipment before planning.');if(externalChange)throw Error('Equipment/records changed in another tab. Reload before planning; nothing has been overwritten.');if(!s.usable)throw Error('Get a fresh GPS fix with accuracy of 100 m or better.');return C.validateInput({origin:s.position,destination:$('gpsDestination').value,stops:[...plannedStops],measurements:Object.fromEntries(Object.entries(fieldIds).map(([k,id])=>[k,$(id).value])),confirmed:$('gpsConfirmCombination').checked})}
$('gpsPlanRoute').onclick=async()=>{
 invalidate();const token=generation;
 try{const request=inputs();controller=new AbortController();const signal=controller.signal;status('gpsRouteStatus','Calculating LOCAL SIMULATION… No HERE request is made.');const raw=await adapter.calculate(request,{signal,scenario:$('gpsSimulationScenario').value});if(token!==generation||signal.aborted)return;inputs();const route=C.parseResponse(raw);if(token!==generation)return;lastRoute=route;drawRoute();$('gpsDistance').textContent=(route.length/1000).toFixed(1)+' km (SAMPLE)';$('gpsTravelTime').textContent=Math.round(route.duration/60)+' min (SAMPLE)';const list=$('gpsRouteSummary'),heading=document.createElement('h3');heading.textContent='SIMULATED ROUTE — NOT SAFE FOR REAL NAVIGATION';list.append(heading);for(const warning of route.warnings){const p=document.createElement('p');p.className='notice';p.textContent=warning;list.append(p)}const maneuvers=document.createElement('ol');for(const maneuver of route.maneuvers){const li=document.createElement('li');li.textContent=maneuver.instruction;maneuvers.append(li)}list.append(maneuvers);status('gpsRouteStatus','LOCAL SAMPLE ONLY. Use View sample route area to inspect the fixture; it is not a route to your destination.');
 }catch(error){if(token!==generation||error.name==='AbortError')return;clearRoute();status('gpsRouteStatus',error.message||'Local simulation failed. Existing records are unchanged.')}finally{if(token===generation)controller=null}
};
window.addEventListener('roadledger:saved',()=>queueMicrotask(prefill));
window.addEventListener('storage',e=>{if(e.key===null||[key,extraKey].includes(e.key)){externalChange=true;$('gpsConfirmCombination').checked=false;invalidate('Records changed in another tab. Reload before planning.');status('gpsEquipmentStatus','Another tab changed equipment or records. Manual trip drafts are retained in this tab.')}});
function startTicker(){clearInterval(ticker);ticker=setInterval(()=>{if(!document.hidden)renderGPS(session.snapshot())},1000)}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('suspended');else renderGPS(session.snapshot())});
window.addEventListener('pagehide',()=>{stop('suspended');clearInterval(ticker)});window.addEventListener('pageshow',()=>{startTicker();renderGPS(session.snapshot())});
window.RoadLedgerGPS=Object.freeze({snapshot:session.snapshot});
prefill();renderGPS(session.snapshot());startTicker();initializeMap();
})();
