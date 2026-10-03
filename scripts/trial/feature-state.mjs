// Reviewed feature-state primitives. They grant no route or source permission.
const need=(ok,code)=>{if(!ok)throw Error('FEATURE_'+code);};
export function parseFeatureValues(text,{size,separator='|',decimalPlaces=6,maximumValue=1000000,negativeSentinels=[]}={}){
 need(Number.isSafeInteger(size)&&size>0&&size<=1000&&Number.isSafeInteger(decimalPlaces)&&decimalPlaces>=0&&decimalPlaces<=6
  &&Number.isSafeInteger(maximumValue)&&maximumValue>=0&&maximumValue<=1000000&&[',','|'].includes(separator)
  &&typeof text==='string'&&text.length<=size*32&&Array.isArray(negativeSentinels)
  &&negativeSentinels.every(n=>Number.isSafeInteger(n)&&n<0&&n>=-1000000),'VALUES_LIMIT');
 const entries=text.split(separator);need(entries.length===size,'VALUES_SIZE');
 for(const entry of entries){
  need(entry.trim()===entry&&/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(entry),'VALUES_FORMAT');
  const [whole,fraction='']=entry.replace(/^-/,'').split('.');need(fraction.length<=decimalPlaces,'VALUES_PRECISION');
  const scale=10n**BigInt(fraction.length),coefficient=BigInt(whole)*scale+BigInt(fraction||'0');
  need(entry.startsWith('-')?negativeSentinels.some(n=>-coefficient===BigInt(n)*scale):coefficient<=BigInt(maximumValue)*scale,'VALUES_SCOPE');
 }
 return entries;
}
export function reviewFeatureValues(text,{displaySentinels=[],continuationSentinels=[],...options}={}){
 const roles=[displaySentinels,continuationSentinels];
 need(roles.every(role=>Array.isArray(role)&&role.every(n=>Number.isSafeInteger(n)&&n<0&&n>=-1000000)
  &&new Set(role).size===role.length)&&!displaySentinels.some(n=>continuationSentinels.includes(n))
  &&!Object.hasOwn(options,'negativeSentinels'),'VALUES_ROLES');
 const values=parseFeatureValues(text,{...options,negativeSentinels:[...displaySentinels,...continuationSentinels]});
 // Parsing proves any negative value exactly equals an explicitly scoped integer code.
 const requiresFeatureContinuation=values.some(value=>value.startsWith('-')&&continuationSentinels.includes(Number(value.split('.')[0])));
 return{values,requiresFeatureContinuation};
}
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
