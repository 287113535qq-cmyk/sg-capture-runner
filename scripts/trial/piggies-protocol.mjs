export const PIGGIES_SOURCE='richlittlepiggiesworldclass96-round-one-base-v1';
export const PIGGIES_SIZE2_EXTENSION=PIGGIES_SOURCE+'-size2-free-v1';
export const hasPiggiesSize2=raw=>raw.sourceKey===PIGGIES_SOURCE&&raw.steps.some(st=>Object.keys(fields(fields(st.responsePayload).GSD??'','#','~')).some(k=>['PGS2','GE2'].includes(k)));
const allowed=new Set('WWW MSR VA MSRNAME CONAMES CO WM FGEW RW RT CW WCP WCS SCP GE WWCTA WWCITE RTR BT RSTA RPI RSAS ITFG WWP WWTI PBG PWG RE WCE0 PWCS0 PRG WWPI WT WWTP BE GT JS JO PJS JW WWCP RSS RSCT PRPI PGS4 GE4 PGG EP4 PGS2 GE2 WWFITE WWFWAE'.split(' '));
const need=(ok,code)=>{if(!ok)throw Error(code);};
function fields(s,separator='&',delimiter='='){
 need(typeof s==='string','INVALID_PARAMETERS');const out=Object.create(null);
 for(const part of s.split(separator).filter(Boolean)){const pos=part.indexOf(delimiter),key=part.slice(0,pos);need(pos>0&&!Object.hasOwn(out,key)&&(delimiter!=='~'||part.lastIndexOf('~')===pos),'AMBIGUOUS_PARAMETERS');out[key]=part.slice(pos+1);}return out;
}
const integer=v=>{need(typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(Number(v)),'INVALID_COUNTER');return Number(v);};
export function piggiesNext(raw){
 need(raw.sourceKey===PIGGIES_SOURCE&&raw.protocol==='nextgen'&&raw.fixtureOnly===false,'PIGGIES_PROFILE_REQUIRED');
 need(Array.isArray(raw.steps)&&raw.steps.length<=100,'INVALID_ROUND_STEPS');if(!raw.steps.length)return{MSGID:'BET'};
 const size2=hasPiggiesSize2(raw);
 let before,session,last;
 raw.steps.forEach((step,i)=>{
  const p=fields(step.responsePayload),q=fields(step.requestPayload),msg=i?'FREE_GAME':'BET';
  need(step.msgId===msg&&p.MSGID===msg&&q.MSGID===msg,'MESSAGE_MISMATCH');
  need(Object.keys(q).length===6&&q.AP==='false'&&q.BPL==='5'&&q.LB==='25'&&q.GN==='richlittlepiggiesworldclass96','REQUEST_MISMATCH');
  need(/^gdmgcm.{1,505}$/.test(q.PID??'')&&(session===undefined||session===q.PID),'SESSION_CHANGED');session=q.PID;
  need(['','0','0|'].includes(p.FID??'')&&(p.GCT??'0')==='0'&&(p.FRBAL??'0')==='0'
   &&!['CFG','ABPM','SB','FRTR','FRTW','BUY_IN'].some(k=>Object.hasOwn(p,k))&&!Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_|FR_)/.test(k)),'PIGGIES_FEATURE_NOT_ADAPTED');
  need(Object.keys(fields(p.GSD??'','#','~')).every(k=>allowed.has(k)),'PIGGIES_FEATURE_NOT_ADAPTED');
  const g=fields(p.GSD??'','#','~');
  if(size2){need(g.GT==='1'&&g.BT==='1'&&g.PGG==='1'&&!['PGS4','GE4','EP4'].some(k=>Object.hasOwn(g,k)),'PIGGIES_SIZE_TWO_COMBINATION');need(i>0||(Object.hasOwn(g,'PGS2')&&Object.hasOwn(g,'GE2')),'PIGGIES_SIZE_TWO_TRIGGER');}
  if(Object.hasOwn(g,'PGS2')||Object.hasOwn(g,'GE2')){
   need(g.GT==='1'&&g.BT==='1'&&g.PGG==='1'&&!['PGS4','GE4','EP4'].some(k=>Object.hasOwn(g,k))&&Object.hasOwn(g,'PGS2')&&Object.hasOwn(g,'GE2'),'PIGGIES_SIZE_TWO_COMBINATION');
   need(/^-?[0-9]+$/.test(g.PGS2)&&Number.isSafeInteger(Number(g.PGS2)),'PIGGIES_SIZE_TWO_COUNTER');integer(g.GE2);
  }
  need(p.IFG===(i?'1':'0')&&(!i||Object.hasOwn(p,'NFG')),'INVALID_FREE_GAME_STATE');
  const n=integer(p.NFG??'0'),t=integer(p.TFG??'0'),c=integer(p.CFGG??'0');need(n<=99,'PIGGIES_COUNTER_MISMATCH');
  if(n||i){need(Object.hasOwn(p,'TFG')&&Object.hasOwn(p,'CFGG')&&t===n+c&&t>0&&t<=99,'PIGGIES_COUNTER_MISMATCH');
   need(i?before.n>0&&c===before.c+1&&t>=before.t&&n===before.n-1+t-before.t:c===0&&integer(p.FGT)===n,'PIGGIES_COUNTER_MISMATCH');
  }else need(t===0&&c===0&&integer(p.FGT??'0')===0,'PIGGIES_COUNTER_MISMATCH');
  for(const k of ['B','AB','TW'])integer(p[k]);before={n,t,c};last=p;
 });
 if(!before.n){const b=integer(last.B);need(b===integer(last.AB),'BALANCE_MISMATCH');need(Number.isSafeInteger(raw.startBalanceRaw)&&raw.startBalanceRaw>=0&&raw.startBalanceRaw-b+integer(last.TW)===100,'TRIAL_ACTUAL_COST_MISMATCH');}
 return before.n?{MSGID:'FREE_GAME'}:null;
}
export function piggiesMapping(raw,baseHash,extensionHash){need(piggiesNext(raw)===null,'INCOMPLETE_ROUND');need(/^[a-f0-9]{64}$/.test(baseHash??''),'MAPPING_REQUIRED');const mappingHash=hasPiggiesSize2(raw)?extensionHash:baseHash;need(/^[a-f0-9]{64}$/.test(mappingHash??''),'PIGGIES_SIZE_TWO_MAPPING_REQUIRED');return{buy:0,bonus:raw.steps.length>1?1:0,typeMappingHash:mappingHash};}
