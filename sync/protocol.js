/* Shared browser/server wire contract. Invalid/oversized local data stays local, never truncated. */
(function(root){
'use strict';
const LIMITS=Object.freeze({recordBytes:65536,requestBytes:98304,pageBytes:524288,pageRecords:100,responseBytes:786432,maxRevision:Number.MAX_SAFE_INTEGER});
const COLLECTIONS=['loads','equipment','settings','mileage','expenses','maintenance','fleet','documents','ifta','extraMetadata','tires','routeSpecs','routeStops'];
const SINGLETONS=['equipment','settings','extraMetadata','routeStops'];
const ROWS=['loads','mileage','expenses','maintenance','fleet','documents','ifta'];
const bytes=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).length;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function invalid(message,status=422){throw Object.assign(Error(message),{status,permanent:true})}
function safeJSON(value,depth=0){
 if(depth>20)invalid('Record nesting exceeds the supported limit');
 if(value===null||typeof value==='boolean')return;
 if(typeof value==='number'){if(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)invalid('Unsafe numeric value');return}
 if(typeof value==='string'){for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);if(c===0)invalid('NUL characters cannot synchronize');if(c>=0xd800&&c<=0xdbff){const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))invalid('Invalid Unicode')}else if(c>=0xdc00&&c<=0xdfff)invalid('Invalid Unicode')}return}
 if(Array.isArray(value)){for(const item of value)safeJSON(item,depth+1);return}
 if(object(value)){for(const [key,item]of Object.entries(value)){safeJSON(key,depth+1);safeJSON(item,depth+1)}return}
 invalid('Record is not JSON data');
}
function keyParts(key){let pair;try{pair=JSON.parse(key)}catch{invalid('Invalid record key')}
 if(typeof key!=='string'||bytes(key)>4096||!Array.isArray(pair)||pair.length!==2||!COLLECTIONS.includes(pair[0])||typeof pair[1]!=='string'||!pair[1]||JSON.stringify(pair)!==key)invalid('Invalid record key');safeJSON(pair);
 if(SINGLETONS.includes(pair[0])&&pair[1]!=='default')invalid('Singleton record ID must be default');return pair;
}
function numeric(value,field,{min=0,max=Number.MAX_SAFE_INTEGER,integer=false,required=false}={}){
 if(value===undefined||value===null||value===''){if(required)invalid('Missing '+field);return}
 if(!['string','number'].includes(typeof value)||typeof value==='string'&&!/^[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(value.trim()))invalid('Invalid '+field);
 const n=Number(value);if(!Number.isFinite(n)||n<min||n>max||integer&&!Number.isInteger(n))invalid('Invalid '+field);
}
function date(value,field,required=false){if(value===undefined||value===null||value===''){if(required)invalid('Missing '+field);return}if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000-'))invalid('Invalid '+field);const parsed=new Date(value+'T12:00:00Z');if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)invalid('Invalid '+field)}
function validateRecord(key,value){const [collection,id]=keyParts(key);safeJSON(value);if(bytes(value)>LIMITS.recordBytes)invalid('Record exceeds 64 KiB; preserved locally',413);if(value===null)return;
 if(collection==='routeStops'){if(!Array.isArray(value)||value.length>20||value.some(stop=>typeof stop!=='string'||!stop.trim()))invalid('Invalid route stops');return}
 if(!object(value))invalid('Record must be an object');
 if(ROWS.includes(collection)&&(!['string','number'].includes(typeof value.id)||String(value.id)!==id))invalid('Record ID does not match its key');
 for(const field of ['date','due','expiry'])date(value[field],field,collection==='mileage'&&field==='date');
 for(const field of ['pay','miles','tonu','detention','layover','expenses','amount','gallons','cost','odo','dueOdo','start','end','total','loaded'])numeric(value[field],field);
 for(const field of ['rate','tonuRate','detentionRate','layoverRate','taxRate'])numeric(value[field],field,{max:100});
 for(const field of ['fuelLow','fuelHigh','fuelEmpty'])numeric(value[field],field,{min:0.000001,max:100});
 if(value.fuelLow!=null&&value.fuelLow!==''&&value.fuelHigh!=null&&value.fuelHigh!==''&&Number(value.fuelLow)>Number(value.fuelHigh))invalid('Invalid MPG range');
 if(ROWS.includes(collection)||collection==='settings')if(Object.values(value).some(item=>item!==null&&typeof item==='object'))invalid('Nested fields are not supported in this record');
 if(collection==='expenses'){numeric(value.amount,'amount',{min:0.000001,required:true});if(value.payer!==undefined&&!['business','driver','reimbursed'].includes(value.payer))invalid('Invalid expense payer');if(value.loadExpenseId!=null&&typeof value.loadExpenseId!=='string')invalid('Invalid expense load reference')}
 if(collection==='mileage'){numeric(value.start,'start',{required:true});numeric(value.end,'end',{required:true});if(Number(value.end)<Number(value.start)||value.loaded!=null&&value.loaded!==''&&Number(value.loaded)>Math.round((Number(value.end)-Number(value.start))*10)/10)invalid('Invalid odometer or loaded miles')}
 if(collection==='fleet'&&(typeof value.name!=='string'||!value.name.trim()||!['truck','trailer'].includes(String(value.type).toLowerCase())))invalid('Invalid fleet record');
 if(collection==='ifta'){if(!/^[A-Z]{2}$/.test(value.state))invalid('Invalid jurisdiction');numeric(value.miles,'miles',{required:true})}
 if(collection==='tires'){if(typeof value.size!=='string'||!value.size.trim())invalid('Invalid tire size');numeric(value.count,'count',{min:1,max:100,integer:true,required:true})}
 if(collection==='routeSpecs')for(const field of ['routeHeight','routeWidth','routeWeight','routeAxles'])numeric(value[field],field,{min:0.000001,...(field==='routeAxles'?{min:1,max:30,integer:true}:{})});
}
function validateOperation(operation){if(!object(operation)||!Number.isSafeInteger(operation.baseVersion)||operation.baseVersion<0||operation.baseVersion>=LIMITS.maxRevision||typeof operation.opId!=='string'||!operation.opId||operation.opId.length>100||!Object.hasOwn(operation,'value'))invalid('Invalid synchronization operation');validateRecord(operation.key,operation.value);if(bytes(operation)>LIMITS.requestBytes)invalid('Request exceeds the synchronization limit',413);return operation}
function page(changes,since,highWater){if(!Number.isSafeInteger(since)||since<0||since>highWater)invalid('Invalid cursor or cloud reset',409);const selected=[];let used=128,cursor=since;for(const change of changes){if(change.cursor<=since||change.cursor>highWater)continue;if(change.cursor!==cursor+1)invalid('Change history has a gap; recovery required',409);const size=bytes(change)+2;if(selected.length>=LIMITS.pageRecords||used+size>LIMITS.pageBytes){if(!selected.length)invalid('Existing cloud record exceeds the page budget; recovery required',413);break}selected.push(change);used+=size;cursor=change.cursor}return {changes:selected,cursor,hasMore:cursor<highWater}}
function validatePage(response,since){if(!object(response)||!Array.isArray(response.changes)||response.changes.length>LIMITS.pageRecords||!Number.isSafeInteger(response.cursor)||response.cursor<since||typeof response.hasMore!=='boolean'||bytes(response)>LIMITS.pageBytes)invalid('Invalid or oversized change page');let cursor=since;for(const change of response.changes){if(!object(change)||!Number.isSafeInteger(change.cursor)||change.cursor!==cursor+1||change.cursor>response.cursor||!Number.isSafeInteger(change.version)||change.version<1||!Object.hasOwn(change,'value'))invalid('Invalid change cursor/revision');validateRecord(change.key,change.value);cursor=change.cursor}if(response.cursor!==cursor||response.hasMore&&cursor===since)invalid('Change page did not advance safely');return response}
async function readResponse(response,limit=LIMITS.responseBytes){const length=Number(response.headers?.get?.('content-length'));if(length>limit){await response.body?.cancel?.();invalid('Response exceeds the safe byte budget',413)}if(response.status===204)return null;if(!response.body?.getReader){const data=await response.json();if(bytes(data)>limit)invalid('Response exceeds the safe byte budget',413);return data}const reader=response.body.getReader();const chunks=[];let count=0;try{while(true){const {value,done}=await reader.read();if(done)break;count+=value.byteLength;if(count>limit){await reader.cancel();invalid('Response exceeds the safe byte budget',413)}chunks.push(value)}}finally{reader.releaseLock()}if(count===0)return null;const buffer=new Uint8Array(count);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length}return JSON.parse(new TextDecoder().decode(buffer))}
const api={LIMITS,COLLECTIONS,SINGLETONS,ROWS,bytes,keyParts,validateRecord,validateOperation,validatePage,page,readResponse};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RoadLedgerProtocol=api;
})(typeof window==='undefined'?globalThis:window);
