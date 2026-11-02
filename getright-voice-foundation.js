/* GetRight future AI voice foundation. Inert until explicitly integrated.
 * No microphone, network, browser storage, paid provider or action execution.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.GetRightVoiceFoundation=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const WAKE_PHRASE='hey getright';
 const MODES=Object.freeze(['trucking','general','auto']);
 const DOMAINS=Object.freeze(['navigation','route-weather','loads','earnings','expenses','equipment','maintenance','ifta','eld','trucking-regulations']);
 const ACTIONS=Object.freeze(['place-call','send-message','create-load','edit-load','delete-load','change-equipment','start-navigation','change-settings','purchase']);
 function normalize(text){return typeof text==='string'?text.trim().toLowerCase().replace(/[\s,!.?]+/g,' '):''}
 function detectWake(text){const n=normalize(text);return n===WAKE_PHRASE||n.startsWith(WAKE_PHRASE+' ')}
 function createTurn({text,mode='auto',conversationId=null,context=[]}={}){
  if(typeof text!=='string'||!text.trim()||text.length>4000)throw Error('VOICE_INVALID_TURN');
  if(!MODES.includes(mode))throw Error('VOICE_INVALID_MODE');
  if(!Array.isArray(context)||context.length>12||context.some(x=>!x||!['user','assistant'].includes(x.role)||typeof x.text!=='string'||x.text.length>4000))throw Error('VOICE_INVALID_CONTEXT');
  if(conversationId!==null&&(typeof conversationId!=='string'||conversationId.length>128))throw Error('VOICE_INVALID_SESSION');
  return Object.freeze({text:text.trim(),mode,conversationId,context:context.map(x=>({role:x.role,text:x.text})),wakeDetected:detectWake(text)});
 }
 function classifyAction(action){
  if(typeof action!=='string')throw Error('VOICE_INVALID_ACTION');
  return Object.freeze({action,requiresConfirmation:ACTIONS.includes(action),knownConsequential:ACTIONS.includes(action)});
 }
 function requestAction({action,parameters={},source='unknown'}={}){
  const policy=classifyAction(action);
  if(!policy.knownConsequential)throw Error('VOICE_ACTION_NOT_ALLOWED');
  if(!parameters||typeof parameters!=='object'||Array.isArray(parameters))throw Error('VOICE_INVALID_PARAMETERS');
  // No execution path: UI/backend must display details and request fresh consent.
  return Object.freeze({status:'confirmation-required',action,parameters:{...parameters},source,executed:false});
 }
 function sourceLabel({source,observedAt=null}={}){
  if(!['live','simulated','unavailable'].includes(source))throw Error('VOICE_INVALID_SOURCE');
  return Object.freeze({source,observedAt:source==='live'&&typeof observedAt==='string'?observedAt:null,verified:source==='live'&&!!observedAt});
 }
 function minutesStatus({included=0,used=0,topUp=0}={}){
  if(![included,used,topUp].every(x=>Number.isInteger(x)&&x>=0))throw Error('VOICE_INVALID_MINUTES');
  const remaining=Math.max(0,included+topUp-used);
  return Object.freeze({remaining,exhausted:remaining===0,warning:remaining<=20?'critical':remaining<=60?'low':'none',billingEnabled:false});
 }
 function createProviderBoundary({enabled=false,provider=null}={}){
  return Object.freeze({enabled:false,provider:enabled?null:provider,async respond(){throw Error('VOICE_PROVIDER_DISABLED')}});
 }
 return Object.freeze({WAKE_PHRASE,MODES,DOMAINS,detectWake,createTurn,classifyAction,requestAction,sourceLabel,minutesStatus,createProviderBoundary});
});
