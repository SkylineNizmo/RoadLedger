'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('let editingLoadId=null;function resetLoad()');
const end=html.indexOf('function render(){const ls=dashboardLoads();',start);
assert.ok(start>0&&end>start,'Edit Load functions are present in the actual application');
const code=html.slice(start,end);
function fixture(){
 const elements=new Map(),alerts=[],data={loads:[{id:'original',pickup:'A',delivery:'B',date:'2026-10-01',pay:1000,miles:100,rate:25,status:'Partially paid',paymentHistory:[{amount:200}],company:'Example',truckId:'unit-1',type:'load',expenses:0,tonu:0,detention:0,layover:0}]};
 function $(id){if(!elements.has(id))elements.set(id,{value:'',textContent:'',open:false,classList:{add(){},remove(){}},scrollIntoView(){}});return elements.get(id)}
 const snapshots=[];const context={data,settings:{rate:25},extra:{},$,num:Number,today:()=> '2026-10-01',RoadLedgerStorage:{validDate:()=>true},equipmentName:()=>'',activeEquipment:()=>null,persist:()=>{snapshots.push(JSON.stringify(data));return true},render(){},renderReport(){},alert:s=>alerts.push(s)};
 vm.createContext(context);vm.runInContext(code,context);
 return {context,data,$,snapshots,alerts};
}
test('edit retains ID, payment history, equipment and record count',()=>{
 const f=fixture(),original=f.data.loads[0];
 f.context.startLoadEdit(original);
 f.$('pay').value='2000';f.$('rate').value='30';f.$('pickup').value='New pickup';
 f.$('loadForm').onsubmit({preventDefault(){}});
 assert.equal(f.data.loads.length,1);assert.equal(f.data.loads[0].id,'original');
 assert.deepEqual(f.data.loads[0].paymentHistory,[{amount:200}]);
 assert.equal(f.data.loads[0].truckId,'unit-1');
 assert.equal(f.data.loads[0].pay,2000);assert.equal(f.data.loads[0].rate,30);
 assert.equal(f.data.loads[0].pickup,'New pickup');assert.equal(f.snapshots.length,1);
});
test('cancel edit leaves existing record unchanged',()=>{
 const f=fixture(),before=JSON.stringify(f.data.loads);
 f.context.startLoadEdit(f.data.loads[0]);f.$('pay').value='99999';
 f.$('cancelLoadEdit').onclick();
 assert.equal(JSON.stringify(f.data.loads),before);
 assert.equal(f.snapshots.length,0);
});
test('invalid driver rate rejects edit without persistence',()=>{
 const f=fixture(),before=JSON.stringify(f.data.loads);
 f.context.startLoadEdit(f.data.loads[0]);f.$('rate').value='110';
 f.$('loadForm').onsubmit({preventDefault(){}});
 assert.equal(JSON.stringify(f.data.loads),before);
 assert.equal(f.snapshots.length,0);
});
