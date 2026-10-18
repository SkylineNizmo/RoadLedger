const {spawn}=require('node:child_process');const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
async function mockFixture(){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'roadledger-mock-test-'));let child;let url;
 async function start(){child=spawn(process.execPath,[path.resolve(__dirname,'../backend/mock-server.cjs'),'--port','0','--data',path.join(directory,'cloud.json')],{stdio:['ignore','pipe','pipe']});url=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Mock server startup timeout')),10000);child.on('error',reject);child.stdout.on('data',data=>{const match=String(data).match(/RoadLedger MOCK only: (\S+)/);if(match){clearTimeout(timeout);resolve(new URL(match[1]).origin+'/')}});child.on('exit',code=>{if(code)reject(Error('Mock server exited '+code))})});return url}
 async function stop(){if(!child||child.exitCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill()})}
 await start();return {get url(){return url},async restart(){await stop();return start()},async close(){await stop();fs.rmSync(directory,{recursive:true,force:true})}};
}
module.exports={mockFixture};
