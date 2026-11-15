'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PRESETS,weightSelection}=require('./navigation-vehicle-presets.cjs');
test('reference presets do not automatically become a confirmed rating',()=>{
 assert.equal(PRESETS.semi.suggestedCombinationGrossWeightLb,80000);
 assert.equal(PRESETS.hotshot.suggestedCombinationGrossWeightLb,26000);
 assert.throws(()=>weightSelection('semi'),{code:'GROSS_WEIGHT_REQUIRED'});
 assert.throws(()=>weightSelection('hotshot',0),{code:'GROSS_WEIGHT_REQUIRED'});
});
test('confirmed combination gross weight is explicitly supplied',()=>{
 assert.deepEqual(weightSelection('semi',76000),{profile:'semi',confirmedCombinationGrossWeightLb:76000});
 assert.throws(()=>weightSelection('unknown',80000),{code:'INVALID_PROFILE'});
});
