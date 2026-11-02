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
for(const id of ['radarToggle','roadledgerFollowGps','gpsStartTracking','gpsStopTracking'])$('getrightMapTools').append($(id));
for(const id of ['roadledgerMapStatus','radarStatus','radarFrameTime'])$('getrightMapStatus').append($(id));
const destination=$('gpsDestination');destination.placeholder='Where are you headed?';$('getrightDestinationRow').prepend(destination);
$('getrightTripContents').append(planner,$('gpsShowSampleRoute'),$('routeSavedSettings'));
mapSection.remove();
planner.querySelector('h2').textContent='Trip setup';
for(const heading of planner.querySelectorAll('h3'))if(/Destination|Additional Stops/.test(heading.textContent))heading.remove();
$('getrightWeatherContents').append($('roadledgerRadar'),$('roadledgerWeatherDashboard'));
document.querySelector('nav [data-tab="routeweather"]').textContent='🗺️ Map & Navigation';
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
