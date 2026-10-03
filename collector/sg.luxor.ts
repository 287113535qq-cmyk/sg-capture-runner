const {advanceFreeGameCounters}=require('./free-game-counters.cjs');
/** Independent validation of standalone Luxor FID2 and legacy complete rounds. */
const requireLuxor=(ok:unknown,code:string):void=>{if(!ok)throw Error(code);};
function fields(text:string,separator='&',delimiter='='):Record<string,string>{
  requireLuxor(typeof text==='string','INVALID_PARAMETERS');const result:Record<string,string>=Object.create(null);
  for(const item of text.split(separator).filter(Boolean)){
    const at=item.indexOf(delimiter),key=item.slice(0,at);
    requireLuxor(at>0&&!Object.prototype.hasOwnProperty.call(result,key)
      &&(delimiter!=='~'||item.lastIndexOf(delimiter)===at),'AMBIGUOUS_PARAMETERS');
    result[key]=item.slice(at+1);
  }return result;
}
function counter(value:string):number{
  requireLuxor(typeof value==='string'&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value)),'INVALID_COUNTER');return Number(value);
}
export function luxorFields(raw:any,mappingHash:string){
  requireLuxor(raw.sourceKey==='pyramidsofluxor96-round-one-base-v1'&&raw.protocol==='nextgen'
    &&raw.roundFieldsVersion==='sg-round-fields-v1'&&raw.steps.length>0&&raw.steps.length<=100,'LUXOR_PROFILE_REQUIRED');
  const special=raw.steps.some((s:any)=>['2','2|'].includes(fields(s.responsePayload).FID));
  let remaining=0,total=0,current=0,session:string|undefined,last:Record<string,string>={};
  raw.steps.forEach((s:any,i:number)=>{
    const request=fields(s.requestPayload),p=fields(s.responsePayload),msg=i===0?'BET':'FREE_GAME';
    requireLuxor(s.msgId===msg&&p.MSGID===msg&&request.MSGID===msg&&(i===0||remaining>0),'INVALID_SEQUENCE');
    requireLuxor(Object.keys(request).length===5&&request.BPR==='5'&&request.RB==='20'
      &&request.GN==='pyramidsofluxor96','REQUEST_MISMATCH');
    requireLuxor(/^gdmgcm.{1,505}$/.test(request.PID??'')&&(i===0||session===request.PID),'SESSION_CHANGED');session=request.PID;
    requireLuxor((special?['2','2|']:['','0','0|']).includes(p.FID??'')
      &&!Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_)/.test(k))
      &&['CFG','ABPM','SB'].every(k=>p[k]===undefined),'UNKNOWN_TRIAL_FEATURE');
    requireLuxor(['0','1'].includes(p.IFG)&&(i===0||p.IFG==='1'),'INVALID_FREE_STATE');
    ['B','AB','TW'].forEach(k=>counter(p[k]));
    const n=counter(p.NFG??(i===0&&!special?'0':undefined));requireLuxor(n<=100,'FREE_LIMIT');
    if(special){
      const gsd=fields(p.GSD??'','#','~');requireLuxor(gsd.CFG===undefined&&(gsd.FID??'[]')==='[]','UNKNOWN_TRIAL_FEATURE');
      const t=counter(p.TFG),c=counter(p.CFGG);requireLuxor(t<=100&&c<=100&&t===n+c,'LUXOR_COUNTERS');
      if(i===0)requireLuxor(n>0&&c===0&&p.IFG==='0','EMPTY_TRIGGER');
      else{
        advanceFreeGameCounters({total,remaining,played:current},{total:t,remaining:n,played:c},{maximum:100});
      }total=t;current=c;
    }remaining=n;last=p;
  });
  requireLuxor(remaining===0&&(!special||raw.steps.length>1),'INCOMPLETE_ROUND');
  const start=raw.startBalanceRaw,end=counter(last.B),win=counter(last.TW),stake=start-end+win;
  requireLuxor(Number.isSafeInteger(start)&&start>=0&&stake===100,'STAKE_MISMATCH');
  requireLuxor(end===counter(last.AB)&&(raw.steps[raw.steps.length-1].responseBalance===undefined
    ||Number(raw.steps[raw.steps.length-1].responseBalance)===end),'BALANCE_MISMATCH');
  requireLuxor(/^[a-f0-9]{64}$/.test(mappingHash),'MAPPING_REQUIRED');
  return {roundFieldsVersion:raw.roundFieldsVersion,protocol:raw.protocol,sourceKey:raw.sourceKey,
    bet:stake/100,mul:win/stake,buy:0,bonus:special?2:raw.steps.length>1?1:0,
    primaryBonusKind:raw.steps.length>1?'freeGame':'none',typeMappingHash:mappingHash,
    money:{startBalanceRaw:start,endBalanceRaw:end,totalWinRaw:win,betRaw:stake}};
}
