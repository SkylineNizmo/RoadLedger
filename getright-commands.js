/* Explicit local UI commands. No provider, financial or load-entry writes. */
(function(){'use strict';
function handle(spoken){
 const phrase=String(spoken).toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 const openWeather=()=>showTab('routeweather');
 if(/^(show|open)( my)? equipment$/.test(phrase)){showTab('equipment');return 'Opened My Equipment.'}
 if(/^(add|create)( a| new)? truck$/.test(phrase)){showTab('equipment');document.getElementById('addEquipmentTruck').click();return 'New truck form opened. Review and save the profile.'}
 if(/^(add|create)( a| new)? trailer$/.test(phrase)){showTab('equipment');document.getElementById('addEquipmentTrailer').click();return 'New trailer form opened. Review and save the profile.'}
 if(/^switch to power only$/.test(phrase)){showTab('equipment');const el=document.getElementById('activeTrailer');el.value=RoadLedgerEquipment.POWER_ONLY;el.dispatchEvent(new Event('change'));return document.getElementById('equipmentStatus').textContent}
 const match=phrase.match(/^switch to (truck|trailer)(?: number| unit)? (.+)$/);
 if(match){showTab('equipment');const rows=equipmentProfiles(true).filter(r=>String(r.type).toLowerCase()===match[1]&&[r.unitNumber,r.name].some(v=>String(v||'').toLowerCase()===match[2]));if(rows.length!==1)return 'No unique equipment match. Select the profile manually.';const el=document.getElementById(match[1]==='truck'?'activeTruck':'activeTrailer');el.value=String(rows[0].id);el.dispatchEvent(new Event('change'));return document.getElementById('equipmentStatus').textContent}
 if(/^(open|show) navigation$/.test(phrase)){openWeather();return 'Opened navigation preview. Not verified for commercial truck routing.'}
 if(/^show my location$/.test(phrase)){openWeather();document.getElementById('gpsDetectLocation').click();return 'Requested GPS location. Browser permission is required.'}
 if(/^(show|open) weather radar$/.test(phrase)){openWeather();document.getElementById('roadledgerRadar').scrollIntoView({block:'start'});return 'Opened radar. Tap Load / refresh to request observations.'}
 if(/^refresh weather$/.test(phrase)){openWeather();document.getElementById('routeLocation').click();return 'Requested current weather. Check the status for availability.'}
 if(/^show severe weather alerts$/.test(phrase)){openWeather();document.getElementById('weatherCoverage').scrollIntoView({block:'center'});return 'An official severe-weather alert feed is not connected. No all-clear is implied; check the official warnings link.'}
 return null;
}
window.GetRightCommands=Object.freeze({handle});
})();
