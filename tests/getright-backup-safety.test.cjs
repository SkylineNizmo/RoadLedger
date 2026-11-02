'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../roadledger-storage.js'),'utf8');
function isolated(){
 const records=new Map(),localStorage={
  getItem:k=>records.has(k)?records.get(k):null,
  setItem:(k,v)=>records.set(k,String(v)),
  removeItem:k=>records.delete(k)
 };
 const window={dispatchEvent(){}},document={addEventListener(){}};
 const context={localStorage,window,document,alert(){},CustomEvent:class{},structuredClone, RoadLedgerEquipment:{validate(){}}};
 vm.runInNewContext(code,context);
 return {store:window.RoadLedgerStorage,localStorage,records};
}
test('legacy backup validation is non-destructive',()=>{
 const {store,records}=isolated();
 const result=store.validate({version:1,roadledger:{loads:[{pickup:'A',delivery:'B'}]}});
 assert.equal(result.roadledger.loads.length,1);
 assert.equal(records.size,0);
});
test('fictional backup restore preserves all saved fields',()=>{
 const {store}=isolated();
 store.restore({version:4,roadledger:{loads:[{id:'a',pickup:'A',delivery:'B',pay:100}]},settings:{rate:25}});
 assert.equal(store.read('roadledger-v1').loads[0].pay,100);
 assert.equal(store.read('roadledger-settings-v2').rate,25);
});
test('invalid backup does not overwrite previous records',()=>{
 const {store}=isolated();
 store.restore({roadledger:{loads:[{id:'a',pay:100}]}});
 const before=JSON.stringify(store.snapshot());
 assert.throws(()=>store.restore({roadledger:{loads:[{id:'a',pay:-1}]}}),/Invalid backup/);
 assert.equal(JSON.stringify(store.snapshot()),before);
});
test('duplicate load IDs rejected before storage mutation',()=>{
 const {store,records}=isolated();
 assert.throws(()=>store.restore({roadledger:{loads:[{id:'same',pay:1},{id:'same',pay:2}]}}),/duplicate/i);
 assert.equal(records.size,0);
});
