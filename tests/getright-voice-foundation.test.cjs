'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const voice=require('../getright-voice-foundation.js');
test('wake phrase normalization and boundaries',()=>{
 assert.equal(voice.detectWake('Hey GetRight, check the weather'),true);
 assert.equal(voice.detectWake('HEY GETRIGHT!'),true);
 assert.equal(voice.detectWake('hey getrightnow'),false);
});
test('trucking and general turns remain separate, context bounded',()=>{
 assert.equal(voice.createTurn({text:'What is IFTA?',mode:'trucking'}).mode,'trucking');
 assert.equal(voice.createTurn({text:'Tell me a story',mode:'general'}).mode,'general');
 assert.throws(()=>voice.createTurn({text:'x',mode:'other'}));
 assert.throws(()=>voice.createTurn({text:'x',context:Array(13).fill({role:'user',text:'a'})}));
});
test('consequential actions never execute without confirmation',()=>{
 const p=voice.requestAction({action:'place-call',parameters:{destination:'shop'}});
 assert.equal(p.status,'confirmation-required');assert.equal(p.executed,false);
 assert.throws(()=>voice.requestAction({action:'delete-everything'}));
});
test('simulated data never receives a live verification label',()=>{
 assert.equal(voice.sourceLabel({source:'simulated',observedAt:'2026-01-01'}).verified,false);
 assert.equal(voice.sourceLabel({source:'unavailable'}).verified,false);
});
test('minute thresholds are deterministic and no billing occurs',()=>{
 assert.equal(voice.minutesStatus({included:100,used:40}).warning,'low');
 assert.equal(voice.minutesStatus({included:100,used:80}).warning,'critical');
 assert.equal(voice.minutesStatus({included:100,used:100}).exhausted,true);
 assert.throws(()=>voice.minutesStatus({included:-1}));
});
test('AI provider remains disabled even if caller requests enablement',async()=>{
 const provider=voice.createProviderBoundary({enabled:true,provider:'openai'});
 assert.equal(provider.enabled,false);
 await assert.rejects(provider.respond('hello'),/VOICE_PROVIDER_DISABLED/);
});
