/* One profile store: extras.fleet. Legacy records are adapted without startup writes. */
(function(root){
'use strict';
const clone=v=>structuredClone(v);
const NUMBER_FIELDS=['year','lengthFt','widthFt','heightFt','emptyWeightLb','gvwrLb','loadedWeightLb','odometer','maintenanceDueOdometer','axleCount','wheelCount'];
const DATE_FIELDS=['registrationExpiry','inspectionExpiry','insuranceExpiry','permitExpiry','maintenanceDueDate'];
const TEXT_FIELDS=['name','unitNumber','vin','plate','registrationState','make','model','notes','maintenanceNotes'];
const present=v=>v!==undefined&&v!==null&&v!=='';
const numeric=v=>['string','number'].includes(typeof v)&&(typeof v!=='string'||/^[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(v.trim()))&&Number.isFinite(Number(v));
function validDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||v.startsWith('0000-'))return false;const d=new Date(v+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v}
function validate(row){
 if(!row||typeof row!=='object'||Array.isArray(row)||!['string','number'].includes(typeof row.id)||!String(row.id)||typeof row.name!=='string'||!row.name.trim()||!['truck','trailer'].includes(String(row.type).toLowerCase()))throw Error('Enter an equipment name and type.');
 if(row.equipmentVersion!==undefined&&row.equipmentVersion!==1)throw Error('Unsupported equipment profile version.');
 for(const field of TEXT_FIELDS)if(present(row[field])&&typeof row[field]!=='string')throw Error('Invalid '+field);
 for(const field of NUMBER_FIELDS){if(!present(row[field]))continue;const n=Number(row[field]);if(!numeric(row[field])||n<0||n>Number.MAX_SAFE_INTEGER)throw Error('Invalid '+field);if(field==='axleCount'&&(!Number.isInteger(n)||n<1||n>30))throw Error('Axle count must be from 1 to 30.');if(field==='wheelCount'&&(!Number.isInteger(n)||n<1||n>100))throw Error('Wheel count must be from 1 to 100.');if(field==='year'&&(!Number.isInteger(n)||n<1900||n>2200))throw Error('Enter a year from 1900 to 2200.');}
 for(const field of DATE_FIELDS)if(present(row[field])&&!validDate(row[field]))throw Error('Invalid '+field);
 for(let i=1;i<=30;i++){const psi=row['axle'+i+'PSI'],size=row['axle'+i+'TireSize'];if(present(psi)&&(!numeric(psi)||Number(psi)<0||Number(psi)>300))throw Error('Cold PSI must be from 0 to 300.');if(present(size)&&typeof size!=='string')throw Error('Invalid tire size.');}
 if(row.equipmentLegacySource!==undefined&&row.equipmentLegacySource!==String(row.type).toLowerCase())throw Error('Invalid legacy equipment link.');
 // Flat scalars keep the existing fleet backup and RPC contract intact.
 if(Object.values(row).some(v=>v!==null&&(!['string','number','boolean'].includes(typeof v)||typeof v==='number'&&(!Number.isFinite(v)||Math.abs(v)>Number.MAX_SAFE_INTEGER))))throw Error('Equipment fields must be scalar values.');
 return row;
}
function legacy(main,type){
 const prefix=type==='truck'?'truck':'trailer';
 const map={name:prefix,unitNumber:prefix+'Unit',vin:prefix+'VIN',plate:prefix+'Plate',registrationState:prefix+'RegState',registrationExpiry:prefix+'RegExpiry'};
 if(type==='trailer')map.lengthFt='trailerLength';
 const row={id:'legacy-settings-'+type,type,equipmentLegacySource:type};
 for(const [to,from]of Object.entries(map))if(present(main[from]))row[to]=main[from];
 const tire=main[prefix+'TireSize'];if(present(tire))row.axle1TireSize=tire;
 if(type==='truck'){if(present(main.truckFrontPSI))row.axle1PSI=main.truckFrontPSI;if(present(main.truckRearPSI)){row.axle2PSI=main.truckRearPSI;if(tire)row.axle2TireSize=tire;}}
 else if(present(main.trailerPSI))row.axle1PSI=main.trailerPSI;
 if(!row.name&&!Object.keys(map).some(k=>k!=='name'&&present(row[k]))&&!present(tire)&&!present(row.axle1PSI)&&!present(row.axle2PSI))return null;
 row.name||=type==='truck'?'Original truck':'Original trailer';return row;
}
function profiles(main,extras){
 const rows=(extras.fleet||[]).map((row,index)=>({...clone(row),id:row.id??'legacy-'+index}));
 const ids=rows.map(r=>String(r.id));if(new Set(ids).size!==ids.length)throw Error('Duplicate equipment IDs. Export a backup before repairing these records.');
 for(const type of ['truck','trailer']){
  const links=rows.filter(r=>r.equipmentLegacySource===type);if(links.length>1)throw Error('Duplicate original equipment links. Export recovery before editing.');
  if(links.length)continue;const row=legacy(main,type);if(!row)continue;
  while(rows.some(r=>String(r.id)===row.id))row.id+='-original';rows.push(row);
 }
 return rows;
}
function active(main,extras,type){const rows=profiles(main,extras);const id=extras[type==='truck'?'activeTruckId':'activeTrailerId'];if(id==='')return null;if(present(id))return rows.find(r=>(String(r.id)===String(id)||r.equipmentLegacyId===String(id))&&String(r.type).toLowerCase()===type)||null;return rows.find(r=>r.equipmentLegacySource===type)||null}
function save(main,extras,input){
 const rows=profiles(main,extras),old=rows.find(r=>String(r.id)===String(input.id));
 const row={...old,...clone(input),equipmentVersion:1};if(old&&!old.equipmentVersion)row.equipmentLegacyName=old.name;validate(row);
 const vin=String(row.vin||'').trim().toUpperCase();
 if(vin&&(!old||String(old.vin||'').trim().toUpperCase()!==vin)&&rows.some(r=>String(r.id)!==String(row.id)&&String(r.vin||'').trim().toUpperCase()===vin))throw Error('This VIN already belongs to an equipment profile. Edit or link that profile instead.');
 if(old&&String(old.type).toLowerCase()!==String(row.type).toLowerCase())throw Error('Equipment type cannot change. Create a separate profile.');
 const next=clone(extras);next.fleet=(next.fleet||[]).map((r,i)=>({...r,id:r.id??'legacy-'+i}));
 const i=next.fleet.findIndex(r=>String(r.id)===String(row.id));if(i<0)next.fleet.push(row);else next.fleet[i]=row;
 // Validate IDs and source links before making a single durable write.
 profiles(main,next);return next;
}
function select(main,extras,type,id){if(!['truck','trailer'].includes(type))throw Error('Invalid equipment type');if(id&&!profiles(main,extras).some(r=>String(r.id)===String(id)&&String(r.type).toLowerCase()===type))throw Error('Select a current '+type);return {...clone(extras),[type==='truck'?'activeTruckId':'activeTrailerId']:id}}
function link(main,extras,id,type){const target=profiles(main,extras).find(r=>String(r.id)===String(id));if(!target||String(target.type).toLowerCase()!==type)throw Error('Select matching equipment.');if(target.equipmentLegacySource&&target.equipmentLegacySource!==type)throw Error('Already linked.');const original=legacy(main,type);if(!original)throw Error('No original equipment settings.');if((extras.fleet||[]).some(r=>r.equipmentLegacySource===type&&String(r.id)!==String(id)))throw Error('Original settings already linked.');const alias=profiles(main,extras).find(r=>r.equipmentLegacySource===type);const merged={...target,equipmentLegacySource:type,...(alias&&String(alias.id)!==String(target.id)?{equipmentLegacyId:String(alias.id)}:{})};for(const [k,v]of Object.entries(original))if(k!=='id'&&k!=='type'&&!present(merged[k]))merged[k]=v;return save(main,extras,merged)}
const api={NUMBER_FIELDS,DATE_FIELDS,TEXT_FIELDS,validDate,validate,legacy,profiles,active,save,select,link};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RoadLedgerEquipment=api;
})(typeof window==='undefined'?globalThis:window);
