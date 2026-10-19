/* No header is an identity unless every proxy to its right is explicitly trusted. */
const net=require('node:net');
function canonicalIP(value){
 if(typeof value!=='string'||value.includes('%')||!net.isIP(value))return null;
 if(net.isIP(value)===4)return value;
 const ip=new URL('http://['+value+']/').hostname.slice(1,-1);
 // A mapped IPv4 socket address and its IPv4 spelling share one bucket.
 const mapped=/^::ffff:([a-f0-9]+):([a-f0-9]+)$/.exec(ip);
 if(mapped){const n=parseInt(mapped[1],16)*65536+parseInt(mapped[2],16);return [n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join('.')}
 return ip;
}
function proxyPolicy({trustedProxyIPs=[],trustedProxyCIDRs=[]}={}){
 const exact=new Set(trustedProxyIPs.map(ip=>{const value=canonicalIP(ip);if(!value)throw Error('Invalid trusted proxy IP');return value}));
 const ranges=new net.BlockList();
 for(const cidr of trustedProxyCIDRs){const parts=cidr.split('/'),ip=canonicalIP(parts[0]),bits=Number(parts[1]);
  if(parts.length!==2||!ip||!/^\d+$/.test(parts[1])||bits<1||bits>(net.isIP(ip)===4?32:128))throw Error('Invalid trusted proxy CIDR');
  ranges.addSubnet(ip,bits,net.isIP(ip)===4?'ipv4':'ipv6');
 }
 return ip=>{const value=canonicalIP(ip);return !!value&&(exact.has(value)||ranges.check(value,net.isIP(value)===4?'ipv4':'ipv6'))};
}
function isHTTPS(req,{trustedProxyIPs=[],trustedProxyCIDRs=[],trustRenderProxy=false,clientIPMode='auto'}={}){
 const peer=canonicalIP(req.socket.remoteAddress);
 const renderIngress=trustRenderProxy&&(clientIPMode!=='trusted-chain'||proxyPolicy({trustedProxyIPs,trustedProxyCIDRs})(peer));
 return req.socket.encrypted===true||((renderIngress||!!peer&&trustedProxyIPs.some(ip=>canonicalIP(ip)===peer))&&req.headers['x-forwarded-proto']==='https');
}
function clientIdentity(req,{trustRenderProxy=false,trustedProxyIPs=[],trustedProxyCIDRs=[],clientIPMode='auto'}={}){
 if(!['auto','trusted-chain'].includes(clientIPMode))throw Error('Invalid client IP mode');
 const trusted=proxyPolicy({trustedProxyIPs,trustedProxyCIDRs}),peer=canonicalIP(req.socket.remoteAddress);
 if(clientIPMode!=='trusted-chain'){
  // Render/private proxy addresses identify ingress, not drivers. Do not bucket them together.
  return trustRenderProxy||trusted(peer)?null:peer;
 }
 if(!trusted(peer))throw Object.assign(Error('Unverified proxy peer; sign-in unavailable'),{status:503});
 const raw=req.headers['x-forwarded-for'];
 if(typeof raw!=='string'||raw.length>4096)throw Object.assign(Error('Invalid proxy client chain'),{status:400});
 const chain=raw.split(',').map(value=>canonicalIP(value.trim()));
 if(!chain.length||chain.length>32||chain.some(ip=>!ip))throw Object.assign(Error('Invalid proxy client chain'),{status:400});
 // Stop at the nearest untrusted peer. Never consume the client-controlled prefix.
 let current=peer;
 for(let i=chain.length-1;i>=0;i--){if(!trusted(current))return current;current=chain[i]}
 if(trusted(current))throw Object.assign(Error('Proxy chain has no verified client boundary'),{status:400});
 return current;
}
module.exports={isHTTPS,canonicalIP,proxyPolicy,clientIdentity};
