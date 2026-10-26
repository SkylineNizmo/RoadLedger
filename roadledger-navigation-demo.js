/* Local, manually advanced fixture guidance. Never uses GPS, storage or networking. */
(function(root){
'use strict';
const WARNING='DEMO / SIMULATION — NOT SAFE FOR REAL NAVIGATION';
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
 container.append(panel);const el=id=>panel.querySelector('#'+id);
 const demo=createDemo({speech:root.speechSynthesis,makeUtterance:typeof root.SpeechSynthesisUtterance==='function'?text=>new root.SpeechSynthesisUtterance(text):null,onChange:s=>{
  el('demoState').textContent=WARNING+' — '+({idle:'Stopped',active:'Active fixture',stopped:'Stopped',complete:'Fixture complete','rerouting-demo':'Simulating rerouting; no provider request','no-alternate':'No alternate route exists. Resume the original fixture or stop.'}[s.state]);
  el('demoManeuver').textContent=s.step?'Upcoming sample maneuver: '+s.step.instruction:'No active guidance.';
  el('demoDistance').textContent=s.step?'Fixture distance to maneuver: '+s.step.distance+' m; remaining: '+s.step.remaining+' m / '+s.step.seconds+' seconds.':'Fixture estimates unavailable while stopped or simulating recovery.';
  el('demoMute').textContent=s.muted?'Unmute demo speech':'Mute demo speech';el('demoMute').setAttribute('aria-pressed',String(!s.muted));
  el('demoSpeech').textContent=s.speechAvailable?'Demo speech is '+(s.muted?'muted.':'unmuted.'):'Speech unavailable. Use the visual fixture instructions.';
  el('demoMute').disabled=!s.speechAvailable||s.state!=='active';el('demoStart').disabled=['active','rerouting-demo','no-alternate'].includes(s.state);el('demoNext').disabled=s.state!=='active';el('demoOffRoute').disabled=s.state!=='active';el('demoResume').disabled=s.state!=='no-alternate';
 }});
 el('demoStart').onclick=()=>demo.start();el('demoStop').onclick=()=>demo.stop();el('demoMute').onclick=()=>demo.mute(!demo.snapshot().muted);el('demoNext').onclick=()=>demo.next();el('demoOffRoute').onclick=()=>demo.offRoute();el('demoResume').onclick=()=>demo.resume();
 const hidden=()=>{if(document.hidden)demo.stop()},leave=()=>demo.stop(),tabChange=e=>{const target=e.target.closest?.('nav [data-tab]');if(target&&target.dataset.tab!=='routeweather')demo.stop()};document.addEventListener('visibilitychange',hidden);root.addEventListener('pagehide',leave);document.addEventListener('click',tabChange);demo.stop();
 return {dispose(){demo.dispose();document.removeEventListener('visibilitychange',hidden);root.removeEventListener('pagehide',leave);document.removeEventListener('click',tabChange);panel.remove()}};
}
const api=Object.freeze({createDemo,mount});if(typeof module==='object'&&module.exports)module.exports=api;else root.RoadLedgerNavigationDemo=api;
})(typeof window==='undefined'?globalThis:window);
