/* Loopback-only manual/test launcher. No production mode, credentials, login endpoint or outbound transport. */
'use strict';
const http=require('node:http'),{createNavigationService}=require('./navigation-service.cjs');
const {createMockAuth}=require('./navigation-mock-auth.cjs'),{createMockProvider}=require('./navigation-mock-provider.cjs');
async function startLocalNavigation({enableMock=false,limits,providerOptions={},clock=Date.now}={}){
 const auth=createMockAuth({clock}),provider=createMockProvider(providerOptions);let service;
 const server=http.createServer((req,res)=>service.handler(req,res));
 server.requestTimeout=5000;server.headersTimeout=3000;server.maxHeadersCount=30;server.maxConnections=24;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 const origin='http://127.0.0.1:'+server.address().port;
 try{service=createNavigationService({mode:enableMock?'local-mock':'disabled',origin,auth,provider,limits,clock})}catch(error){await new Promise(resolve=>server.close(resolve));throw error}
 server.once('close',service.close);
 return {origin,auth,stats:service.stats,close:async()=>{service.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}};
}
if(require.main===module)startLocalNavigation().then(({origin})=>{process.stdout.write('Loopback navigation skeleton disabled at '+origin+'; no credentials or live provider.\n')}).catch(()=>{process.stderr.write('Local navigation startup failed.\n');process.exitCode=1});
module.exports={startLocalNavigation};
