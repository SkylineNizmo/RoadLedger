/* Suggested vehicle weight presets only. Never substitute these for verified vehicle ratings. */
'use strict';
const PRESETS=Object.freeze({
  semi:Object.freeze({label:'Semi-truck (typical US interstate reference)',suggestedCombinationGrossWeightLb:80000}),
  hotshot:Object.freeze({label:'Hotshot / non-semi (user planning reference)',suggestedCombinationGrossWeightLb:26000})
});
function weightSelection(profile,confirmedGrossWeightLb){
  if(!Object.hasOwn(PRESETS,profile))throw Object.assign(Error('Unknown vehicle profile'),{code:'INVALID_PROFILE'});
  if(!Number.isSafeInteger(confirmedGrossWeightLb)||confirmedGrossWeightLb<=0)
    throw Object.assign(Error('Enter and confirm the actual permitted combination gross weight'),{code:'GROSS_WEIGHT_REQUIRED'});
  return Object.freeze({profile,confirmedCombinationGrossWeightLb:confirmedGrossWeightLb});
}
module.exports={PRESETS,weightSelection};
