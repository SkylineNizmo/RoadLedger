/* Pure route-weather ETA matcher. No network calls, credentials or stored records. */
(function(root){
'use strict';
const validPoint=p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Math.abs(p[0])<=90&&Number.isFinite(p[1])&&Math.abs(p[1])<=180;
function samples({points,durationSeconds,departureMs,count=6}){
 if(!Array.isArray(points)||points.length<2||points.length>4096||!points.every(validPoint))throw Error('Invalid route geometry');
 if(!Number.isFinite(durationSeconds)||durationSeconds<0||durationSeconds>2592000||!Number.isFinite(departureMs)||!Number.isInteger(count)||count<2||count>24)throw Error('Invalid route timeline');
 // Cumulative haversine distance, not vertex count: uneven route vertices must not bias ETA.
 const distances=[0];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],r=Math.PI/180,dlat=(b[0]-a[0])*r,dlon=(b[1]-a[1])*r;const h=Math.sin(dlat/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dlon/2)**2;distances.push(distances[i-1]+12742*Math.asin(Math.min(1,Math.sqrt(h))))}
 const total=distances.at(-1);
 return Array.from({length:count},(_,i)=>{const fraction=i/(count-1),target=total*fraction;let j=1;while(j<distances.length-1&&distances[j]<target)j++;const segment=distances[j]-distances[j-1],t=segment?(target-distances[j-1])/segment:0;const point=points[j-1].map((v,k)=>v+(points[j][k]-v)*t);return {fraction,latitude:point[0],longitude:point[1],arrivalTime:new Date(departureMs+durationSeconds*1000*fraction).toISOString()}})
}
function matchHourly(sample,intervals,{maxGapMinutes=90}={}){
 if(!Array.isArray(intervals)||!Number.isFinite(maxGapMinutes)||maxGapMinutes<0)return null;
 const target=Date.parse(sample?.arrivalTime);if(!Number.isFinite(target))return null;
 let best=null,delta=Infinity;
 for(const item of intervals){const t=Date.parse(item?.time),values=item?.values;if(!Number.isFinite(t)||!values||typeof values!=='object'||Array.isArray(values))continue;const gap=Math.abs(t-target);if(gap<delta){best=item;delta=gap}}
 if(!best||delta>maxGapMinutes*60000)return null;
 const safe={};for(const key of ['temperature','precipitationProbability','rainIntensity','snowIntensity','windSpeed','windGust','visibility','weatherCode','freezingRainIntensity']){const v=best.values[key];if(typeof v==='number'&&Number.isFinite(v))safe[key]=v}
 return {forecastTime:best.time,values:safe,source:'forecast',gapMinutes:delta/60000}
}
function hazards(match,{simulated=false}={}){
 if(!match||!match.values)return [];const v=match.values,out=[];
 const add=(code,label)=>out.push({code,label,source:simulated?'simulated-test':'forecast-risk'});
 if(v.rainIntensity>=7.6)add('HEAVY_RAIN','Heavy rain forecast');
 if(v.snowIntensity>=1)add('SNOW','Snow forecast');
 if(v.windGust>=45)add('WIND_GUST','Strong wind gust forecast');
 if(v.visibility>=0&&v.visibility<1)add('LOW_VISIBILITY','Low visibility forecast');
 if(v.freezingRainIntensity>0)add('FREEZING_RAIN','Freezing rain forecast');
 return out;
}
const api=Object.freeze({samples,matchHourly,hazards});
if(typeof module==='object'&&module.exports)module.exports=api;else root.GetRightRouteWeather=api;
})(typeof window==='undefined'?globalThis:window);
