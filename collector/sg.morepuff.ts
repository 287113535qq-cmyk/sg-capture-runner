/** Independent raw validation of the reviewed standalone Wheel cash exit. */
const need=(value:unknown,code:string):void=>{if(!value)throw Error(code);};
function fields(text:string,separator='&',delimiter='='):Record<string,string>{
  need(typeof text==='string','INVALID_PARAMETERS');const result:Record<string,string>=Object.create(null);
  for(const item of text.split(separator).filter(Boolean)){
    const at=item.indexOf(delimiter),key=item.slice(0,at);
    need(at>0&&!Object.prototype.hasOwnProperty.call(result,key)
      &&(delimiter!=='~'||item.lastIndexOf(delimiter)===at),'AMBIGUOUS_PARAMETERS');result[key]=item.slice(at+1);
  }return result;
}
const integer=(v:string):number=>{need(typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(Number(v)),'INVALID_COUNTER');return Number(v);};
export function hasMorepuffWheel(raw:any):boolean{
  return raw.sourceKey==='huffnmorepuffhighlimit96-round-one-base-v1'
    &&raw.steps.some((s:any)=>(fields(s.responsePayload).FID??'').split('|').includes('2'));
}
export function morepuffFields(raw:any,mappingHash:string){
  need(hasMorepuffWheel(raw)&&raw.protocol==='nextgen'&&raw.roundFieldsVersion==='sg-round-fields-v1'
    &&raw.fixtureOnly===false&&raw.steps.length===2,'MOREPUFF_PROFILE_REQUIRED');
  const allowed=new Set(['BWS','BRS','BMS','ABW','buyInPrice','FMS','WHSTOP','WHEELSPIN','WHJPM','FRAMES','PREVFRAMES','FRAMEWINS','HHSHIFTPOS','VA','BSSHIFTPOS','FEAT_WIN','HHPOS','BSPOS','FEAT','BWC']);
  let session:string|undefined,last:Record<string,string>={};
  raw.steps.forEach((step:any,i:number)=>{
    const p=fields(step.responsePayload),q=fields(step.requestPayload),msg=i?'FREE_GAME':'BET';
    need(step.msgId===msg&&p.MSGID===msg&&q.MSGID===msg,'MESSAGE_MISMATCH');
    need(Object.keys(q).length===5&&q.GN==='huffnmorepuffhighlimit96'&&q.BPR==='100'&&q.RB==='5','REQUEST_MISMATCH');
    need(/^gdmgcm.{1,505}$/.test(q.PID??'')&&(i===0||session===q.PID),'SESSION_CHANGED');session=q.PID;
    need(['0','1'].includes(p.IFG),'INVALID_FREE_STATE');
    need(['CFG','ABPM','SB','FRTR','FRTW','BUY_IN'].every(k=>p[k]===undefined)&&(p.FRBAL??'0')==='0'
      &&!Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_|FR_)/.test(k)),'UNKNOWN_TRIAL_FEATURE');
    need((p.GCT??'0')==='0','MOREPUFF_FEATURE_NOT_ADAPTED');
    for(const k of ['B','AB','TW'])integer(p[k]);
    const g=fields(p.GSD??'','#','~');need(Object.keys(g).every(k=>allowed.has(k)),'UNKNOWN_TRIAL_FEATURE');
    need(['FEAT','FRAMES','PREVFRAMES','FRAMEWINS','HHSHIFTPOS','FEAT_WIN','HHPOS','buyInPrice','FMS'].every(k=>g[k]===undefined),'MOREPUFF_FEATURE_NOT_ADAPTED');
    const symbols=(g.VA??'').split(',').filter(Boolean).map(integer);need(symbols.length===15,'MISSING_WHEEL_SYMBOLS');
    need(!(symbols.filter(n=>n===13).length>=3&&symbols.filter(n=>n===14).length>=6),'MOREPUFF_FEATURE_NOT_ADAPTED');
    const remaining=integer(p.NFG),total=integer(p.TFG),count=integer(p.CFGG);
    need(total===remaining+count&&total===1&&remaining<=1&&count<=1,'MOREPUFF_FEATURE_NOT_ADAPTED');
    if(i===0)need(['2','2|'].includes(p.FID)&&remaining===1&&count===0&&p.IFG==='0'&&p.RID==='0'&&g.WHSTOP===undefined,'MOREPUFF_FEATURE_NOT_ADAPTED');
    else{
      need(['0','0|','1','1|'].includes(p.FID)&&[0,2,7,8,11].includes(integer(g.WHSTOP)),'MOREPUFF_FEATURE_NOT_ADAPTED');
      need(remaining===0&&count===1,'INCOMPLETE_ROUND');
    }last=p;
  });
  const start=raw.startBalanceRaw,end=integer(last.B),win=integer(last.TW),stake=start-end+win;
  need(Number.isSafeInteger(start)&&start>=0&&stake===2000,'STAKE_MISMATCH');
  need(end===integer(last.AB)&&(raw.steps[1].responseBalance===undefined||Number(raw.steps[1].responseBalance)===end),'BALANCE_MISMATCH');
  need(/^[a-f0-9]{64}$/.test(mappingHash),'MAPPING_REQUIRED');
  return {roundFieldsVersion:raw.roundFieldsVersion,protocol:raw.protocol,sourceKey:raw.sourceKey,
    bet:stake/100,mul:win/stake,buy:0,bonus:2,primaryBonusKind:'freeGame',typeMappingHash:mappingHash,
    money:{startBalanceRaw:start,endBalanceRaw:end,totalWinRaw:win,betRaw:stake}};
}
