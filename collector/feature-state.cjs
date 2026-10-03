// Independent collector feature-state review; no request authorization.
const assert=require('node:assert/strict');
function parseFeatureValues(text,{size,separator='|',decimalPlaces=6,maximumValue=1000000,negativeSentinels=[]}={}){
 assert(Number.isSafeInteger(size)&&size>0&&size<=1000&&Number.isSafeInteger(decimalPlaces)&&decimalPlaces>=0&&decimalPlaces<=6);
 assert(Number.isSafeInteger(maximumValue)&&maximumValue>=0&&maximumValue<=1000000&&[',','|'].includes(separator));
 assert(typeof text==='string'&&text.length<=size*32&&Array.isArray(negativeSentinels)&&negativeSentinels.every(n=>Number.isSafeInteger(n)&&n<0&&n>=-1000000));
 const entries=text.split(separator);assert.equal(entries.length,size);
 for(const entry of entries){
  assert(entry.trim()===entry&&/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(entry));const [whole,fraction='']=entry.replace(/^-/,'').split('.');
  assert(fraction.length<=decimalPlaces);const scale=10n**BigInt(fraction.length),coefficient=BigInt(whole)*scale+BigInt(fraction||'0');
  assert(entry.startsWith('-')?negativeSentinels.some(n=>-coefficient===BigInt(n)*scale):coefficient<=BigInt(maximumValue)*scale);
 }
 return entries;
}
function reviewFeatureValues(text,{displaySentinels=[],continuationSentinels=[],...options}={}){
 assert([displaySentinels,continuationSentinels].every(role=>Array.isArray(role)
  &&role.every(n=>Number.isSafeInteger(n)&&n<0&&n>=-1000000)&&new Set(role).size===role.length));
 assert(!displaySentinels.some(n=>continuationSentinels.includes(n))&&!Object.hasOwn(options,'negativeSentinels'));
 const values=parseFeatureValues(text,{...options,negativeSentinels:displaySentinels.concat(continuationSentinels)});
 const requiresFeatureContinuation=values.some(value=>value.startsWith('-')&&continuationSentinels.some(n=>BigInt(value.split('.')[0])===BigInt(n)));
 return{values,requiresFeatureContinuation};
}
function parseFeatureHistory(text,allowed,{maximum=100,allowEmpty=false}={}){
 assert(Number.isSafeInteger(maximum)&&maximum>0&&maximum<=1000000&&typeof text==='string'&&text.length<=maximum*17);
 if(text===''&&allowEmpty)return[];
 assert(/^(?:0|[1-9]\d*)(?:\|(?:0|[1-9]\d*))*\|?$/.test(text));
 const entries=text.replace(/\|$/,'').split('|').map(Number);
 assert(entries.length<=maximum&&entries.every(n=>Number.isSafeInteger(n)&&allowed.includes(n)));
 return entries;
}
function checkFeatureWallet(start,bet,balance,available,win,{settled,responseBalance}={}){
 const integer=n=>Number.isSafeInteger(n)&&n>=0;
 assert(typeof settled==='boolean'&&[start,bet,balance,available,win].every(integer)&&start>=bet);
 assert.equal(balance,start-bet+win);
 assert(available===balance||!settled&&available===start-bet);
 if(responseBalance!==undefined)assert(integer(responseBalance)&&responseBalance===available);
 return{uncreditedWin:balance-available};
}
module.exports={parseFeatureValues,reviewFeatureValues,parseFeatureHistory,checkFeatureWallet};
