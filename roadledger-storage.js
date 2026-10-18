/* Complete, validated backups and recoverable multi-key local restores. */
(function () {
  'use strict';
  const keys = ['roadledger-v1','roadledger-settings-v2','roadledger-mileage-v1','roadledger-extras-v1','roadledger-tires-v1','roadledger-route-specs-v1','roadledger-route-stops-v1'];
  const journalKey = 'roadledger-restore-journal-v1';
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  function recover() {
    const raw = localStorage.getItem(journalKey);
    if (!raw) return;
    const previous = JSON.parse(raw);
    for (const key of keys) {
      if (previous[key] === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previous[key]);
    }
    localStorage.removeItem(journalKey);
  }
  let recoveryBlocked = false;
  try { recover(); } catch (error) {
    recoveryBlocked = true;
    // Do not run the app against a partly restored dataset.
    document.addEventListener('DOMContentLoaded', () => alert('An interrupted restore could not be recovered. Free browser storage and reload before editing records.'));

  }
  function read(key,fallback=null,strict=false) {
    try {
      const pending=localStorage.getItem(journalKey);
      const raw=pending ? JSON.parse(pending)[key] : localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (error) { if (strict) throw error; return fallback; }
  }
  const observed = new Map(keys.map(key=>{try{return [key,localStorage.getItem(key)]}catch{return [key,null]}}));
  function write(key,value) {
    if (recoveryBlocked || localStorage.getItem(journalKey)) throw new Error('Restore recovery must finish before saving. Reload RoadLedger.');
    if (localStorage.getItem(key) !== observed.get(key)) {
      alert('Records changed in another RoadLedger tab. Reload this tab before saving to avoid overwriting newer records.');
      return false;
    }
    const raw=JSON.stringify(value);
    localStorage.setItem(key,raw);
    observed.set(key,raw);
    return true;
  }
  function validate(backup) {
    const fail = message => { throw new Error('Invalid backup: ' + message); };
    if (!object(backup) || !object(backup.roadledger) || !Array.isArray(backup.roadledger.loads)) fail('missing load records');
    if (backup.version !== undefined && ![1,2,3,4].includes(backup.version)) fail('unsupported version');
    const result = structuredClone(backup);
    function records(rows, label, numbers = [], percentages = []) {
      if (!Array.isArray(rows)) fail(label + ' must be a list');
      for (const [index,row] of rows.entries()) {
        if (!object(row)) fail(label + ' contains an invalid record');
        if (label !== 'settings') row.id = String(row.id ?? label+'-'+index);
        if (Object.values(row).some(v=>v !== null && !['string','number','boolean'].includes(typeof v))) fail(label + ' contains invalid field values');
        for (const field of [...numbers,...percentages]) {
          if (row[field] === undefined || row[field] === '' || row[field] === null) continue;
          if (!['string','number'].includes(typeof row[field])) fail(label + ': invalid ' + field);
          const n = Number(row[field]);
          if (!Number.isFinite(n) || n < 0 || (percentages.includes(field) && n > 100)) fail(label + ': invalid ' + field);
          row[field] = n;
        }
        for (const field of ['date','due','expiry']) if (row[field] && !validDate(row[field])) fail(label + ': invalid date');
      }
      if (label !== 'settings' && new Set(rows.map(row=>row.id)).size !== rows.length) fail(label + ': duplicate IDs');
    }
    records(result.roadledger.loads,'loads',['pay','miles','tonu','detention','layover','expenses'],['rate','tonuRate','detentionRate','layoverRate']);
    for (const [i,load] of result.roadledger.loads.entries()) {
      load.id ??= 'legacy-'+i;
      for (const field of ['pay','miles','tonu','detention','layover','expenses']) load[field] ??= 0;
    }
    const ids=result.roadledger.loads.map(l=>String(l.id));
    if (new Set(ids).size !== ids.length) fail('duplicate load IDs');
    result.settings ??= {};
    if (!object(result.settings)) fail('settings must be an object');
    records([result.settings],'settings',['fuelLow','fuelHigh','fuelEmpty'],['rate','tonuRate','detentionRate','layoverRate','taxRate']);
    result.mileageTrips ??= [];
    records(result.mileageTrips,'mileage',['start','end','total','loaded']);
    for (const trip of result.mileageTrips) {
      if (!validDate(trip.date) || !Number.isFinite(trip.start) || !Number.isFinite(trip.end) || trip.end < trip.start) fail('invalid odometer trip');
      trip.total = Math.round((trip.end-trip.start)*10)/10;
      trip.loaded ??= null;
      if (trip.loaded !== null && trip.loaded > trip.total) fail('loaded miles exceed trip miles');
    }
    result.extras ??= {};
    if (!object(result.extras)) fail('extras must be an object');
    for (const bucket of ['expenses','maintenance','fleet','documents','ifta']) {
      result.extras[bucket] ??= [];
      records(result.extras[bucket],bucket,['amount','gallons','miles','cost','odo','dueOdo']);
    }
    for (const row of result.extras.expenses) if (!Number.isFinite(row.amount) || row.amount <= 0) fail('invalid expense amount');
    for (const row of result.extras.fleet) if (typeof row.name !== 'string' || !row.name.trim() || !['truck','trailer'].includes(String(row.type).toLowerCase())) fail('invalid fleet equipment');
    for (const row of result.extras.ifta) if (!/^[A-Z]{2}$/.test(row.state) || !Number.isFinite(row.miles)) fail('invalid jurisdiction record');
    for (const row of result.extras.expenses) { row.gallons ??= 0; row.payer ??= 'business'; if (!['business','driver','reimbursed'].includes(row.payer)) fail('invalid expense payer'); }
    for (const row of result.extras.ifta) row.gallons ??= 0;
    result.tires ??= {}; result.routeSpecs ??= {}; result.routeStops ??= [];
    if (!object(result.tires) || !object(result.routeSpecs)) fail('invalid equipment defaults');
    for (const tire of Object.values(result.tires)) if (!object(tire) || typeof tire.size !== 'string' || !Number.isInteger(tire.count) || tire.count < 1 || tire.count > 100) fail('invalid tire record');
    for (const spec of Object.values(result.routeSpecs)) {
      if (!object(spec)) fail('invalid route measurements');
      for (const field of ['routeHeight','routeWidth','routeWeight','routeAxles']) if (spec[field] !== undefined && spec[field] !== '' && (!Number.isFinite(Number(spec[field])) || Number(spec[field]) <= 0 || (field === 'routeAxles' && (!Number.isInteger(Number(spec[field])) || Number(spec[field]) > 30)))) fail('invalid route measurements');
    }
    if (!Array.isArray(result.routeStops) || result.routeStops.length > 20 || result.routeStops.some(v=>typeof v !== 'string' || !v.trim())) fail('invalid route stops');
    return result;
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value+'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
  }
  function restore(backup) {
    if (recoveryBlocked || localStorage.getItem(journalKey)) throw new Error('An earlier restore needs recovery. Reload before restoring another backup.');
    const b = validate(backup);
    b.settings={company:'',type:'company',rate:25,tonuRate:100,detentionRate:100,layoverRate:100,taxRate:25,...b.settings};
    const values = [b.roadledger,b.settings,b.mileageTrips,b.extras,b.tires,b.routeSpecs,b.routeStops].map(JSON.stringify);
    const previous = Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]));
    // Persist rollback information before touching any existing record.
    localStorage.setItem(journalKey,JSON.stringify(previous));
    try {
      keys.forEach((key,i)=>localStorage.setItem(key,values[i]));
      localStorage.removeItem(journalKey);
    } catch (error) {
      try { recover(); } catch { throw new Error('Restore failed; recovery is pending. Free browser storage and reload before editing.'); }
      throw new Error('Restore failed; original records were preserved. ' + error.message);
    }
    keys.forEach(key=>observed.set(key,localStorage.getItem(key)));
    return b;
  }
  window.RoadLedgerStorage = {validate,restore,validDate,write,read};
})();
