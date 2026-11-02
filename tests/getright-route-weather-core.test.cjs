'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {samples,matchHourly,hazards}=require('../getright-route-weather-core.js');
test('ETA follows cumulative route distance rather than vertex index',()=>{
 const rows=samples({points:[[0,0],[0,1],[0,3]],durationSeconds:3600,departureMs:0,count:3});
 assert.ok(Math.abs(rows[1].longitude-1.5)<0.001);
 assert.equal(rows[1].arrivalTime,'1970-01-01T00:30:00.000Z');
});
test('departure changes ETAs without changing coordinates',()=>{
 const base={points:[[0,0],[0,2]],durationSeconds:3600,count:3};
 const a=samples({...base,departureMs:0}),b=samples({...base,departureMs:7200000});
 assert.equal(Date.parse(b[1].arrivalTime)-Date.parse(a[1].arrivalTime),7200000);
 assert.equal(b[1].longitude,a[1].longitude);
});
test('forecast matching rejects stale and missing observations',()=>{
 const sample={arrivalTime:'2026-11-01T12:00:00.000Z'};
 assert.equal(matchHourly(sample,[{time:'2026-11-01T09:00:00.000Z',values:{temperature:20}}]),null);
 assert.equal(matchHourly(sample,[]),null);
 assert.equal(matchHourly(sample,[{time:'2026-11-01T12:00:00.000Z',values:{temperature:20}}]).values.temperature,20);
});
test('hazard source never claims an official warning',()=>{
 const data={values:{rainIntensity:8,windGust:50,visibility:0.5}};
 assert.deepEqual(hazards(data).map(x=>x.code),['HEAVY_RAIN','WIND_GUST','LOW_VISIBILITY']);
 assert.ok(hazards(data,{simulated:true}).every(x=>x.source==='simulated-test'));
});
test('invalid geometry and unsupported time inputs fail closed',()=>{
 assert.throws(()=>samples({points:[[0,0]],durationSeconds:5,departureMs:0}));
 assert.throws(()=>samples({points:[[0,0],[0,1]],durationSeconds:-1,departureMs:0}));
});
