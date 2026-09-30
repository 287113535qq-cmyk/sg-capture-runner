/** Independent validation of standalone Inca FID1 and legacy complete rounds. */
const requireInca=(ok:unknown,code:string):void=>{if(!ok)throw Error(code);};
function fields(text:string,separator='&',delimiter='='):Record<string,string>{
  requireInca(typeof text==='string','INVALID_PARAMETERS');const result:Record<string,string>=Object.create(null);
  for(const item of text.split(separator).filter(Boolean)){
    const at=item.indexOf(delimiter),key=item.slice(0,at);
    requireInca(at>0&&!Object.prototype.hasOwnProperty.call(result,key)
      &&(delimiter!=='~'||item.lastIndexOf(delimiter)===at),'AMBIGUOUS_PARAMETERS');
    result[key]=item.slice(at+1);
  }return result;
}
function counter(value:string):number{
  requireInca(typeof value==='string'&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value)),'INVALID_COUNTER');return Number(value);
}
export function incaFields(raw:any,mappingHash:string){
  requireInca(raw.sourceKey==='hyperchargedincajungle96-round-one-base-v1'&&raw.protocol==='nextgen'
    &&raw.roundFieldsVersion==='sg-round-fields-v1'&&raw.steps.length>0&&raw.steps.length<=100,'INCA_PROFILE_REQUIRED');
  const special=raw.steps.some((s:any)=>['1','1|'].includes(fields(s.responsePayload).FID));
  let remaining=0,total=0,current=0,session:string|undefined,last:Record<string,string>={};
  raw.steps.forEach((s:any,i:number)=>{
    const request=fields(s.requestPayload),p=fields(s.responsePayload),msg=i===0?'BET':'FREE_GAME';
    requireInca(s.msgId===msg&&p.MSGID===msg&&request.MSGID===msg&&(i===0||remaining>0),'INVALID_SEQUENCE');
    requireInca(Object.keys(request).length===5&&request.BPL==='1'&&request.LB==='40'
      &&request.GN==='hyperchargedincajungle96','REQUEST_MISMATCH');
    requireInca(/^gdmgcm.{1,505}$/.test(request.PID??'')&&(i===0||session===request.PID),'SESSION_CHANGED');session=request.PID;
    requireInca((special?['1','1|']:['','0','0|']).includes(p.FID??'')
      &&!Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_)/.test(k))
      &&['CFG','ABPM','SB'].every(k=>p[k]===undefined),'UNKNOWN_TRIAL_FEATURE');
    requireInca(['0','1'].includes(p.IFG)&&(i===0||p.IFG==='1'),'INVALID_FREE_STATE');
    ['B','AB','TW'].forEach(k=>counter(p[k]));
    const n=counter(p.NFG??(i===0&&!special?'0':undefined));requireInca(n<=100,'FREE_LIMIT');
    if(!special)requireInca(raw.steps.length===1&&n===0,'UNKNOWN_TRIAL_FEATURE');
    if(special){
      const gsd=fields(p.GSD??'','#','~');requireInca(Object.keys(gsd).every(k=>['BGRS','IIFS','VA','NWI','PWI','FGTS','FGRS','CFGC'].includes(k)),'INCA_UNREVIEWED_GSD');
      requireInca(gsd.IIFS===undefined||gsd.IIFS===(i===0?'1':'0'),'INCA_UNREVIEWED_GSD');
      requireInca((p.FRBAL??'0')==='0','INCA_UNREVIEWED_FREE_ROUNDS');
      const t=counter(p.TFG),c=counter(p.CFGG);requireInca(t===10&&c<=10&&n<=10&&t===n+c,'INCA_COUNTERS');
      requireInca((p.GCT??'0')==='0','UNSUPPORTED_INCA_TERMINATION');
      requireInca((gsd.FGRS===undefined||counter(gsd.FGRS)===n)&&(gsd.CFGC===undefined||counter(gsd.CFGC)===c),'UNSUPPORTED_INCA_NESTED_COUNTER');
      if(i===0)requireInca(n>0&&c===0&&p.IFG==='0','EMPTY_TRIGGER');
      else{
        requireInca(c===current+1&&t===total&&n===remaining-1,'INCA_PROGRESS');
        if(n===0)requireInca(remaining===1&&t===total,'INCA_TERMINAL');
      }total=t;current=c;
    }remaining=n;last=p;
  });
  requireInca(remaining===0&&(!special||raw.steps.length>1),'INCOMPLETE_ROUND');
  const start=raw.startBalanceRaw,end=counter(last.B),win=counter(last.TW),stake=start-end+win;
  requireInca(Number.isSafeInteger(start)&&start>=0&&stake===20,'STAKE_MISMATCH');
  requireInca(end===counter(last.AB)&&(raw.steps[raw.steps.length-1].responseBalance===undefined
    ||Number(raw.steps[raw.steps.length-1].responseBalance)===end),'BALANCE_MISMATCH');
  requireInca(/^[a-f0-9]{64}$/.test(mappingHash),'MAPPING_REQUIRED');
  return {roundFieldsVersion:raw.roundFieldsVersion,protocol:raw.protocol,sourceKey:raw.sourceKey,
    bet:stake/100,mul:win/stake,buy:0,bonus:special?2:raw.steps.length>1?1:0,
    primaryBonusKind:raw.steps.length>1?'freeGame':'none',typeMappingHash:mappingHash,
    money:{startBalanceRaw:start,endBalanceRaw:end,totalWinRaw:win,betRaw:stake}};
}
