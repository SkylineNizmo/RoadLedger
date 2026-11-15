/* Vehicle categories have no assumed weight. Each equipment combination requires its own verified rating. */
'use strict';
const PRESETS=Object.freeze({
  semi:Object.freeze({label:'Semi-truck',suggestedCombinationGrossWeightLb:null}),
  hotshot:Object.freeze({label:'Hotshot',suggestedCombinationGrossWeightLb:null})
});
function weightSelection(profile,confirmedGrossWeightLb){
  if(!Object.hasOwn(PRESETS,profile))throw Object.assign(Error('Unknown vehicle profile'),{code:'INVALID_PROFILE'});
  if(!Number.isSafeInteger(confirmedGrossWeightLb)||confirmedGrossWeightLb<=0)
    throw Object.assign(Error('Enter and confirm the permitted gross weight for this specific truck and trailer combination'),{code:'GROSS_WEIGHT_REQUIRED'});
  return Object.freeze({profile,confirmedCombinationGrossWeightLb:confirmedGrossWeightLb});
}
module.exports={PRESETS,weightSelection};
