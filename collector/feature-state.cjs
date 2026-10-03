// Independent collector feature-state review; no request authorization.
const assert=require('node:assert/strict');
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
module.exports={parseFeatureHistory,checkFeatureWallet};
