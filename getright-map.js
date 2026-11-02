/* Presentation only: reuse existing controls, storage handlers, GPS and Leaflet map. */
(function(){
'use strict';
const $=id=>document.getElementById(id),tab=$('routeweatherTab'),planner=$('roadledgerGpsPlanner');
if(!tab||!planner)return;
const screen=document.createElement('section');screen.id='getrightMapScreen';screen.className='card getright-map-screen';
screen.innerHTML=`<div class="getright-map-heading"><h2>Map &amp; Navigation</h2><span>GPS + weather radar</span></div>
<p class="getright-map-warning"><strong>NAVIGATION PREVIEW — NOT VERIFIED FOR COMMERCIAL TRUCK ROUTING.</strong> Sample routes are SIMULATION ONLY — NOT SAFE FOR REAL NAVIGATION.</p>
<div id="getrightMapStage" class="getright-map-stage"><div class="getright-map-search"><label for="gpsDestination">Destination · planning only</label><div id="getrightDestinationRow"><button id="getrightPlanTrip" type="button">Plan trip</button></div><button id="getrightAddStop" type="button" class="secondary">+ Add stop</button></div><div id="getrightMapTools" class="getright-map-tools" role="group" aria-label="Map controls"></div></div>
<div id="getrightMapStatus" class="getright-map-status"></div>
<details id="getrightTripPanel" class="getright-map-sheet"><summary>Trip planner · <span id="getrightCombinationLabel">Equipment &amp; stops</span></summary><div class="getright-map-sheet-body"><div class="grid"><div><label for="getrightTruck">Active truck</label><select id="getrightTruck"></select></div><div><label for="getrightTrailer">Active trailer / Power Only</label><select id="getrightTrailer"></select></div></div><p class="muted">Changes use My Equipment and apply to new loads. Historical records stay unchanged.</p><div id="getrightTripContents"></div></div></details>
<details id="getrightWeatherPanel" class="getright-map-sheet"><summary>Weather details · radar animation &amp; current conditions</summary><div id="getrightWeatherContents" class="getright-map-sheet-body"></div></details>`;
tab.prepend(screen);
const mapSection=$('roadledgerLiveMap').parentElement;
$('getrightMapStage').prepend($('roadledgerLiveMap'));
for(const id of ['radarToggle','roadledgerFollowGps','getrightCompass','gpsStartTracking','gpsStopTracking'])$('getrightMapTools').append($(id));
for(const id of ['roadledgerMapStatus','radarStatus','radarFrameTime'])$('getrightMapStatus').append($(id));
const destination=$('gpsDestination');destination.placeholder='Where are you headed?';$('getrightDestinationRow').prepend(destination);
$('getrightTripContents').append(planner,$('gpsShowSampleRoute'),$('routeSavedSettings'));
mapSection.remove();
planner.querySelector('h2').textContent='Trip setup';
for(const heading of planner.querySelectorAll('h3'))if(/Destination|Additional Stops/.test(heading.textContent))heading.remove();
$('getrightWeatherContents').append($('roadledgerRadar'),$('roadledgerWeatherDashboard'));
document.querySelector('nav [data-tab="routeweather"]').textContent='🗺️ Map & Navigation';
// Timeline uses only the route's own declared duration. The local fixture is
// explicitly simulated and never generates weather or commercial route claims.
const timeline=document.createElement('section');timeline.id='getrightRouteWeatherTimeline';timeline.className='card';
timeline.innerHTML='<h3>Route weather timeline</h3><p id="getrightTimelineStatus" class="muted">Enter a destination and prepare a route. Live route weather is unavailable until a supported forecast endpoint and real routing are connected.</p><label for="getrightDepartureTime">Departure date and time</label><input id="getrightDepartureTime" type="datetime-local"><div id="getrightTimelineRows"></div>';
$('getrightWeatherContents').prepend(timeline);
const departureInput=$('getrightDepartureTime');
function departure(){const v=departureInput.value;if(!v)return null;const t=new Date(v).getTime();return Number.isFinite(t)?t:null}
let timelineRoute=null;
// Timeline sampling is proportional to the supplied route geometry; the fixed
// fixture remains a simulation and no weather provider is called here.
function sampleRoute(points,fraction){if(!Array.isArray(points)||points.length<2)return null;const at=Math.min(points.length-1,Math.max(0,fraction*(points.length-1)));const i=Math.min(points.length-2,Math.floor(at)),t=at-i;return points[i].map((v,j)=>v+(points[i+1][j]-v)*t)}

function renderTimeline(){const rows=$('getrightTimelineRows'),status=$('getrightTimelineStatus');rows.replaceChildren();if(!timelineRoute){status.textContent='No active route. Forecasts and arrival times are unavailable.';return}
 const start=departure();if(start===null){status.textContent='Select a departure time to display SIMULATED timing. No live forecast has been requested.';return}
 const count=Math.min(6,Math.max(2,Math.ceil(timelineRoute.duration/1800)+1));
 const samples=window.GetRightRouteWeather.samples({points:timelineRoute.points,durationSeconds:timelineRoute.duration,departureMs:start,count});
 status.textContent='SIMULATED route timing only — NOT SAFE FOR NAVIGATION. No forecast data is available for these points.';
 for(let i=0;i<count;i++){const sample=samples[i],when=new Date(sample.arrivalTime);const row=document.createElement('p');row.className='muted';row.textContent=Math.round(sample.fraction*100)+'% of sample route · ETA '+when.toLocaleString()+' · sample location '+sample.latitude.toFixed(4)+', '+sample.longitude.toFixed(4)+' · Weather: unavailable (not forecast)';rows.append(row)}
}
window.addEventListener('roadledger:sample-route',e=>{const d=e.detail;timelineRoute=d?.simulation===true&&Number.isFinite(d.duration)&&d.duration>=0?{duration:d.duration,points:Array.isArray(d.points)?d.points:[]}:null;renderTimeline()});
departureInput.addEventListener('change',renderTimeline);

// Persist only presentation state; never rewrite saved equipment or load records.
const EQUIPMENT_PANEL_KEY='getright-equipment-panel-open';
const tripPanel=$('getrightTripPanel');
try{tripPanel.open=localStorage.getItem(EQUIPMENT_PANEL_KEY)==='true'}catch{}
tripPanel.addEventListener('toggle',()=>{try{localStorage.setItem(EQUIPMENT_PANEL_KEY,String(tripPanel.open))}catch{}});
function openTrip(focus){$('getrightTripPanel').open=true;$(focus).focus();$(focus).scrollIntoView({block:'nearest',behavior:'smooth'})}
$('getrightPlanTrip').onclick=()=>openTrip('gpsConfirmCombination');
$('getrightAddStop').onclick=()=>openTrip('routeStopInput');
destination.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();openTrip('gpsConfirmCombination')}});
// Radar owns its single overlay control. Do not reset its saved preference or
// depend on the removed manual refresh button. GPS runs independently.
function syncEquipment(){
 for(const [target,source] of [['getrightTruck','activeTruck'],['getrightTrailer','activeTrailer']]){
  const from=$(source),to=$(target);to.replaceChildren(...[...from.options].map(option=>option.cloneNode(true)));to.value=from.value;to.disabled=from.disabled;
 }
 $('getrightCombinationLabel').textContent=!$('getrightTruck').value?'Choose equipment':[$('getrightTruck').selectedOptions[0]?.textContent,$('getrightTrailer').selectedOptions[0]?.textContent].filter(Boolean).join(' + ')||'Equipment & stops';
}
for(const [target,source]of [['getrightTruck','activeTruck'],['getrightTrailer','activeTrailer']])$(target).onchange=()=>{const from=$(source);from.value=$(target).value;from.dispatchEvent(new Event('change'));syncEquipment()};
for(const id of ['activeTruck','activeTrailer'])new MutationObserver(syncEquipment).observe($(id),{childList:true,subtree:true});
window.addEventListener('roadledger:saved',()=>queueMicrotask(syncEquipment));
syncEquipment();
// Keep voice available without letting its floating buttons cover the map tools.
const voice=document.createElement('div');voice.className='getright-map-voice';screen.querySelector('.getright-map-heading').append(voice);
const voiceHomes=['floatingMic','floatingMicHide','floatingMicRestore'].map(id=>{const element=$(id),home=document.createComment(id+' home');element.before(home);return {element,home}});
function activate(){const active=!tab.classList.contains('hide');document.body.classList.toggle('getright-map-active',active);for(const {element,home}of voiceHomes){if(active)voice.append(element);else home.after(element)}if(active)screen.scrollIntoView({block:'start'})}
new MutationObserver(activate).observe(tab,{attributes:true,attributeFilter:['class']});activate();
for(const id of ['getrightTripPanel','getrightWeatherPanel'])$(id).addEventListener('toggle',()=>window.RoadLedgerMaps.getMap().then(map=>map.invalidateSize()).catch(()=>{}));
})();
