(function(root){
'use strict';
class HttpTransport{
 constructor(base='./api/sync/'){this.base=new URL(base,location.href);if(this.base.origin!==location.origin)throw Error('Sync API must share this secure origin');if(location.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(location.hostname))throw Error('Cloud sync requires HTTPS');this.csrf=null;this.userId=null}
 async request(path,method='GET',body){const response=await fetch(new URL(path,this.base),{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-RoadLedger-Client':'1',...(this.csrf?{'X-CSRF-Token':this.csrf}:{}),...(this.userId?{'X-Workspace-User':this.userId}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'Sync request failed'),{status:response.status});return data}
 async login(email,password){this.userId=null;this.csrf=null;const session=await this.request('session','POST',{email,password});this.csrf=session.csrf;this.userId=session.userId;return session}
 async session(){const session=await this.request('session');if(this.userId&&this.userId!==session.userId)throw Object.assign(Error('Session account changed'),{status:401});this.csrf=session.csrf;this.userId=session.userId;return session}
 async logout(){try{await this.request('session','DELETE')}finally{this.csrf=null;this.userId=null}}
 push(operation){return this.request('push','POST',operation)}
 pull(cursor){return this.request('pull?cursor='+encodeURIComponent(cursor))}
}
root.RoadLedgerSync.HttpTransport=HttpTransport;
})(window);
