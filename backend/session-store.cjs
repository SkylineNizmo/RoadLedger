/* Server-only encrypted sessions. One process per directory; no financial data is stored here. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
class EncryptedSessionStore{
 constructor({directory,key}){
  if(!Buffer.isBuffer(key)||key.length!==32)throw Error('A server-managed 32-byte encryption key is required');
  this.directory=path.resolve(directory);this.key=Buffer.from(key);fs.mkdirSync(this.directory,{recursive:true,mode:0o700});fs.chmodSync(this.directory,0o700);
  this.lease=path.join(this.directory,'.single-process');
  try{this.leaseFd=fs.openSync(this.lease,'wx',0o600);fs.writeFileSync(this.leaseFd,String(process.pid))}catch{throw Error('Session directory is already leased. Use one server process; inspect a stale lease after a crash.')}
  this.locks=new Map();
 }
 idHash(id){if(typeof id!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(id))throw Object.assign(Error('Invalid session'),{status:401});return crypto.createHash('sha256').update(id).digest('hex')}
 file(hash){if(!/^[a-f0-9]{64}$/.test(hash))throw Error('Invalid session key');return path.join(this.directory,hash+'.session')}
 async lock(id,fn){const key=this.idHash(id),previous=this.locks.get(key)||Promise.resolve();let release;const current=new Promise(r=>release=r);this.locks.set(key,current);await previous;try{return await fn()}finally{release();if(this.locks.get(key)===current)this.locks.delete(key)}}
 get(id){return this.getHash(this.idHash(id))}
 getHash(hash){let raw;try{raw=fs.readFileSync(this.file(hash))}catch(e){if(e.code==='ENOENT')return null;throw e}try{if(raw[0]!==1)throw Error('version');const decipher=crypto.createDecipheriv('aes-256-gcm',this.key,raw.subarray(1,13));decipher.setAAD(Buffer.from(hash));decipher.setAuthTag(raw.subarray(13,29));return JSON.parse(Buffer.concat([decipher.update(raw.subarray(29)),decipher.final()]).toString())}catch{throw Object.assign(Error('Session cannot be decrypted; sign in again'),{status:401})}}
 set(id,record){this.setHash(this.idHash(id),record)}
 setHash(hash,record){const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',this.key,nonce);cipher.setAAD(Buffer.from(hash));const encrypted=Buffer.concat([cipher.update(JSON.stringify(record)),cipher.final()]);const raw=Buffer.concat([Buffer.from([1]),nonce,cipher.getAuthTag(),encrypted]);const file=this.file(hash),temporary=file+'.'+crypto.randomUUID()+'.tmp';let fd;try{fd=fs.openSync(temporary,'wx',0o600);fs.writeFileSync(fd,raw);fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temporary,file);const dir=fs.openSync(this.directory,'r');try{fs.fsyncSync(dir)}finally{fs.closeSync(dir)}}finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(temporary))fs.unlinkSync(temporary)}}
 delete(id){this.deleteHash(this.idHash(id))}
 deleteHash(hash){try{fs.unlinkSync(this.file(hash))}catch(e){if(e.code!=='ENOENT')throw e}}
 revoked(){return fs.readdirSync(this.directory).filter(name=>/^[a-f0-9]{64}\.session$/.test(name)).flatMap(name=>{const hash=name.slice(0,-8);try{const record=this.getHash(hash);return record?.revoked?[{hash,record}]:[]}catch{return []}})}
 close(){fs.closeSync(this.leaseFd);fs.unlinkSync(this.lease);this.key.fill(0)}
}
module.exports={EncryptedSessionStore};
