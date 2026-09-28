// Independent Runner mirror of 32836 standalone foam. Other stacks stay parked.
export const QUARTERBACK_SOURCE='quarterbackfieldsofglory96-round-one-base-v1';
export const QUARTERBACK_EXTENSION=QUARTERBACK_SOURCE+'-foam-pick-v1';
const need=(ok,code)=>{if(!ok)throw Error(code);};
const integer=v=>{need(typeof v==='string' && /^\d+$/.test(v) && Number.isSafeInteger(Number(v)),'INVALID_PROTOCOL_COUNTER');return Number(v);};
function parts(text,separator='&',kv='='){
  need(typeof text==='string','INVALID_NEXTGEN_PAYLOAD');
  const out=Object.create(null);
  for(const part of text.split(separator)){
    if(!part)continue;
    const at=part.indexOf(kv),key=part.slice(0,at);
    need(at>0 && !Object.hasOwn(out,key) && (kv!=='~' || part.indexOf(kv,at+1)<0),'AMBIGUOUS_NEXTGEN_PARAMETER');
    out[key]=part.slice(at+1);
  }
  return out;
}
function sequence(raw){
  need(raw.sourceKey===QUARTERBACK_SOURCE && raw.protocol==='nextgen' && Array.isArray(raw.steps)
    && raw.steps.length<=100,'FOAM_PROFILE_REQUIRED');
  const special=raw.steps.some(s=>s.msgId.startsWith('FEATURE_') || ['2','2|'].includes(parts(s.responsePayload).FID));
  let next={MSGID:'BET'},player;
  need(!special || raw.steps.length<=4,'FOAM_SEQUENCE_MISMATCH');
  for(const [i,step] of raw.steps.entries()){
    const r=parts(step.requestPayload),p=parts(step.responsePayload),fid=p.FID??'';
    need(next && Object.entries(next).every(([k,v])=>r[k]===v) && p.MSGID===step.msgId && r.MSGID===step.msgId,'FOAM_SEQUENCE_MISMATCH');
    need(/^gdmgcm.{1,505}$/.test(r.PID??'') && (player===undefined || r.PID===player),'SESSION_CHANGED_MID_ROUND');
    player=r.PID;
    const request=step.msgId==='BET'||step.msgId==='FREE_GAME'
      ? {GN:'quarterbackfieldsofglory96',BPR:'1',RB:'5',MSGID:step.msgId}
      : {GN:'quarterbackfieldsofglory96',MSGID:step.msgId,CFG:'2',...(step.msgId==='FEATURE_PICK'?{FP:next.FP}:{})};
    need(Object.keys(r).length===Object.keys(request).length+1 && Object.entries(request).every(([k,v])=>r[k]===v),'FIRST_ROUND_REQUEST_MODE');
    for(const k of ['B','AB','TW'])integer(p[k]);
    if(!special){
      need(['','0','0|'].includes(fid) && !Object.keys(p).some(k=>/^(FS_|NFR_)/.test(k)) && p.CFG===undefined && p.ABPM===undefined,'UNKNOWN_TRIAL_FEATURE');
      need(['0','1'].includes(p.IFG) && (step.msgId!=='FREE_GAME' || p.IFG==='1' && p.NFG!==undefined),'INVALID_FREE_GAME_STATE');
      const remaining=p.NFG===undefined?0:integer(p.NFG);need(remaining<=100,'TRIAL_FREE_LIMIT');
      next=remaining?{MSGID:'FREE_GAME'}:null;continue;
    }
    need(['','0','0|','2','2|'].includes(fid) && p.ABPM===undefined && [undefined,'0','2'].includes(p.CFG)
      && [undefined,'0'].includes(p.IFG),'UNKNOWN_TRIAL_FEATURE');
    need(Object.keys(p).every(k=>!/^(FS|NFR|CFR|CFP|FTV|FPM)_/.test(k)||k.endsWith('_2')),'UNKNOWN_TRIAL_FEATURE');
    for(const k of ['NFG','TFG','CFGG'])if(p[k]!==undefined)need(integer(p[k])===0,'UNKNOWN_TRIAL_FEATURE');
    for(const k of ['NFR_2','CFR_2','CFP_2'])if(p[k]!==undefined)need(integer(p[k])<=1,'UNKNOWN_TRIAL_FEATURE');
    need([undefined,'0','1'].includes(p.FS_2),'UNKNOWN_TRIAL_FEATURE');
    if(i===0){
      need(['2','2|'].includes(fid) && p.CFG==='2' && p.IFG==='0' && p.FS_2==='0' && p.NFR_2==='1'
        && p.CFR_2==='0' && p.CFP_2==='0' && p.FPM_2==='|','UNKNOWN_TRIAL_FEATURE');
      next={MSGID:'FEATURE_START',CFG:'2'};
    }else if(i===1){
      need(p.CFG==='2' && p.CFP_2==='0','UNKNOWN_TRIAL_FEATURE');
      const gsd=parts(p.GSD,'#','~');need(gsd.featureData!==undefined,'UNKNOWN_TRIAL_FEATURE');
      const data=gsd.featureData.split(';');
      need(data.length>=1 && data.length<=5,'FOAM_INVALID_FEATURE_DATA');data.forEach(integer);
      next={MSGID:'FEATURE_PICK',CFG:'2',FP:`0|1|${data[0]}`};
    }else if(i===2){
      need(['2','2|'].includes(fid) && p.CFG==='2' && p.CFP_2==='1','UNKNOWN_TRIAL_FEATURE');
      next={MSGID:'FEATURE_END',CFG:'2'};
    }else{
      if(['2','2|'].includes(fid))need(p.NFR_2!==undefined && p.CFR_2!==undefined,'FOAM_MISSING_END_COUNTERS');
      if(p.NFR_2!==undefined)need(integer(p.NFR_2)===0 || p.CFR_2===p.NFR_2,'INCOMPLETE_ROUND');
      need([undefined,'1'].includes(p.CFP_2),'INCOMPLETE_ROUND');next=null;
    }
  }
  return {next,special};
}
export function quarterbackNextRequest(raw){return sequence(raw).next;}
export function quarterbackMapping(raw,baseHash,extensionHash){
  const {next,special}=sequence(raw);need(raw.steps.length>0 && next===null,'INCOMPLETE_ROUND');
  if(special)need(extensionHash,'FOAM_FEATURE_MAPPING_REQUIRED');
  return {buy:0,bonus:special?2:raw.steps.some(s=>s.msgId==='FREE_GAME')?1:0,typeMappingHash:special?extensionHash:baseHash};
}
