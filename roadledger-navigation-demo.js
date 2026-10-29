/* Local, manually advanced fixture guidance. Never uses GPS, storage or networking. */
(function(root){
'use strict';
const WARNING='DEMO / SIMULATION — NOT SAFE FOR REAL NAVIGATION';
// Short fixed Las Vegas fixture only; never observes actual GPS or a live route.
function createFixtureDetector({now=Date.now}={}){
 const route=[[36.1699,-115.1398],[36.1708,-115.1385],[36.172,-115.135],[36.175,-115.132]];
 let misses=0,lastTime=0,offRoute=false;
 return Object.freeze({reset(){misses=0;lastTime=0;offRoute=false},observe(fix){
  if(fix?.simulation!==true||!Number.isFinite(fix.latitude)||!Number.isFinite(fix.longitude)||Math.abs(fix.latitude)>90||Math.abs(fix.longitude)>180||!Number.isFinite(fix.accuracy)||fix.accuracy<0||fix.accuracy>30||!Number.isSafeInteger(fix.timestamp)||now()-fix.timestamp>10000||fix.timestamp>now()+1000){misses=0;return {accepted:false,offRoute:false}}
  if(fix.timestamp<=lastTime)return {accepted:false,offRoute:false};lastTime=fix.timestamp;
  const meters=p=>[(p[1]+115.1398)*111320*Math.cos(36.17*Math.PI/180),(p[0]-36.1699)*111320],q=meters([fix.latitude,fix.longitude]);let distance=Infinity;
  for(let i=1;i<route.length;i++){const a=meters(route[i-1]),b=meters(route[i]),dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(dx*dx+dy*dy)));distance=Math.min(distance,Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy))}
  if(distance>100+fix.accuracy){misses++;if(misses>=3)offRoute=true}else{misses=0;if(distance<50)offRoute=false}
  return {accepted:true,offRoute,distanceMeters:Math.round(distance)};
 }});
}
function createDemo({speech=null,makeUtterance=null,onChange=()=>{},schedule=setTimeout,unschedule=clearTimeout}={}){
 const steps=[{instruction:'Sample departure. Follow the fixture line only.',distance:150,remaining:1200,seconds:180},{instruction:'Sample right turn. No clearance was checked.',distance:300,remaining:1050,seconds:150},{instruction:'Sample arrival. This is not your destination.',distance:0,remaining:0,seconds:0}];
 let state='idle',index=0,muted=true,timer=null,epoch=0,disposed=false,utterance=null,speechFailed=false;
 const supported=()=>!!speech&&typeof speech.speak==='function'&&typeof speech.cancel==='function'&&typeof makeUtterance==='function';
 function snapshot(){return {state,index,muted,speechAvailable:supported()&&!speechFailed,warning:WARNING,step:state==='active'?{...steps[index]}:null}}
 function emit(){onChange(snapshot())}
 function silence(){if(utterance){utterance.onend=null;utterance.onerror=null;utterance=null;try{speech.cancel()}catch{speechFailed=true}}}
 function speak(){silence();if(muted||!supported()||speechFailed||state!=='active')return;try{const u=makeUtterance('Demo only. Not safe for real navigation. '+steps[index].instruction);utterance=u;u.onend=()=>{if(utterance===u)utterance=null};u.onerror=()=>{if(utterance!==u)return;utterance=null;speechFailed=true;emit()};speech.speak(u)}catch{utterance=null;speechFailed=true;emit()}}
 function cancel(){epoch++;if(timer!==null)unschedule(timer);timer=null;silence()}
 return Object.freeze({snapshot,start(){if(disposed)return;cancel();state='active';index=0;muted=true;emit()},stop(){if(disposed)return;cancel();state='stopped';muted=true;emit()},mute(value){if(disposed)return;muted=!!value;if(muted)silence();else speak();emit()},next(){if(disposed||state!=='active')return;silence();if(index===steps.length-1){state='complete';muted=true}else{index++;speak()}emit()},offRoute(){if(disposed||state!=='active')return;cancel();state='rerouting-demo';emit();const token=epoch;timer=schedule(()=>{if(disposed||token!==epoch||state!=='rerouting-demo')return;timer=null;state='no-alternate';emit()},400)},resume(){if(disposed||state!=='no-alternate')return;state='active';muted=true;emit()},dispose(){if(disposed)return;cancel();disposed=true;state='stopped';muted=true;emit()}});
}
function mount(container){
 const panel=document.createElement('section');panel.id='navigationDemoPanel';
 panel.innerHTML='<h3>Demo turn-by-turn guidance</h3><p class="notice"><strong>'+WARNING+'</strong></p><p>Fixed local fixture. Advance manually; GPS does not drive this demo. Distances and times are fixture values, not live estimates.</p><div class="actions"><button type="button" id="demoStart">Start demo</button><button type="button" id="demoStop">Stop demo</button><button type="button" id="demoMute">Unmute demo speech</button><button type="button" id="demoNext">Simulate next maneuver</button><button type="button" id="demoOffRoute">Simulate off-route</button><button type="button" id="demoResume">Resume original fixture</button></div><p id="demoState" role="status" aria-live="polite"></p><p id="demoManeuver"></p><p id="demoDistance"></p><p id="demoSpeech"></p>';
 container.append(panel);const detector=createFixtureDetector();const el=id=>panel.querySelector('#'+id);
 const demo=createDemo({speech:root.speechSynthesis,makeUtterance:typeof root.SpeechSynthesisUtterance==='function'?text=>new root.SpeechSynthesisUtterance(text):null,onChange:s=>{
  el('demoState').textContent=WARNING+' — '+({idle:'Stopped',active:'Active fixture',stopped:'Stopped',complete:'Fixture complete','rerouting-demo':'Simulating rerouting; no provider request','no-alternate':'No alternate route exists. Resume the original fixture or stop.'}[s.state]);
  el('demoManeuver').textContent=s.step?'Upcoming sample maneuver: '+s.step.instruction:'No active guidance.';
  el('demoDistance').textContent=s.step?'Fixture distance to maneuver: '+s.step.distance+' m; remaining: '+s.step.remaining+' m / '+s.step.seconds+' seconds.':'Fixture estimates unavailable while stopped or simulating recovery.';
  el('demoMute').textContent=s.muted?'Unmute demo speech':'Mute demo speech';el('demoMute').setAttribute('aria-pressed',String(!s.muted));
  el('demoSpeech').textContent=s.speechAvailable?'Demo speech is '+(s.muted?'muted.':'unmuted.'):'Speech unavailable. Use the visual fixture instructions.';
  el('demoMute').disabled=!s.speechAvailable||s.state!=='active';el('demoStart').disabled=['active','rerouting-demo','no-alternate'].includes(s.state);el('demoNext').disabled=s.state!=='active';el('demoOffRoute').disabled=s.state!=='active';el('demoResume').disabled=s.state!=='no-alternate';
 }});
 el('demoStart').onclick=()=>{detector.reset();demo.start()};el('demoStop').onclick=()=>demo.stop();el('demoMute').onclick=()=>demo.mute(!demo.snapshot().muted);el('demoNext').onclick=()=>demo.next();el('demoOffRoute').onclick=()=>demo.offRoute();el('demoResume').onclick=()=>{detector.reset();demo.resume()};
 const simulatedFix=document.createElement('button');simulatedFix.type='button';simulatedFix.id='demoOffRouteFixes';simulatedFix.textContent='Simulate three off-route GPS fixes';panel.querySelector('.actions').append(simulatedFix);simulatedFix.onclick=()=>{if(demo.snapshot().state!=='active')return;detector.reset();const time=Date.now();for(let i=0;i<3;i++){const result=detector.observe({simulation:true,latitude:36.19,longitude:-115.16,accuracy:10,timestamp:time-2+i});if(result.offRoute)demo.offRoute()}};
 const hidden=()=>{if(document.hidden)demo.stop()},leave=()=>demo.stop(),tabChange=e=>{const target=e.target.closest?.('nav [data-tab]');if(target&&target.dataset.tab!=='routeweather')demo.stop()};document.addEventListener('visibilitychange',hidden);root.addEventListener('pagehide',leave);document.addEventListener('click',tabChange);demo.stop();
 return {dispose(){demo.dispose();document.removeEventListener('visibilitychange',hidden);root.removeEventListener('pagehide',leave);document.removeEventListener('click',tabChange);panel.remove()}};
}
const api=Object.freeze({createDemo,createFixtureDetector,mount});if(typeof module==='object'&&module.exports)module.exports=api;else root.RoadLedgerNavigationDemo=api;
})(typeof window==='undefined'?globalThis:window);
