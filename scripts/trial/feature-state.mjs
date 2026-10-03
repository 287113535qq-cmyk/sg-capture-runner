// Reviewed feature-state primitives. They grant no route or source permission.
const need=(ok,code)=>{if(!ok)throw Error('FEATURE_'+code);};
export function parseFeatureHistory(text,allowed,{maximum=100,allowEmpty=false}={}){
 need(Number.isSafeInteger(maximum)&&maximum>0&&maximum<=1000000&&typeof text==='string'&&text.length<=maximum*17,'HISTORY_LIMIT');
 if(text===''&&allowEmpty)return[];
 need(/^(?:0|[1-9]\d*)(?:\|(?:0|[1-9]\d*))*\|?$/.test(text),'HISTORY_FORMAT');
 const entries=text.replace(/\|$/,'').split('|').map(Number);
 need(entries.length<=maximum&&entries.every(n=>Number.isSafeInteger(n)&&allowed.includes(n)),'HISTORY_SCOPE');
 return entries;
}
export function checkFeatureWallet(start,bet,balance,available,win,{settled,responseBalance}={}){
 const integer=n=>Number.isSafeInteger(n)&&n>=0;
 need(typeof settled==='boolean'&&[start,bet,balance,available,win].every(integer)&&start>=bet,'WALLET_INPUT');
 need(balance===start-bet+win,'WALLET_AMOUNT');
 need(available===balance||!settled&&available===start-bet,'WALLET_CREDIT');
 need(responseBalance===undefined||integer(responseBalance)&&responseBalance===available,'WALLET_RESPONSE');
 return{uncreditedWin:balance-available};
}
