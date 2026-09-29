// Independent Runner mirror of 32836 standalone foam. Other stacks stay parked.
export const QUARTERBACK_SOURCE='quarterbackfieldsofglory96-round-one-base-v1';
export const QUARTERBACK_EXTENSION=QUARTERBACK_SOURCE+'-foam-pick-v1';
export const QUARTERBACK_PICK_EXTENSION=QUARTERBACK_SOURCE+'-pick-a-ball-v1';
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
  const special=raw.steps.some(s=>s.msgId.startsWith('FEATURE_') || ['1','1|','2','2|'].includes(parts(s.responsePayload).FID));
  const pickBall=raw.steps.some(s=>['1','1|'].includes(parts(s.responsePayload).FID) || s.msgId.startsWith('FEATURE_') && parts(s.requestPayload).CFG==='1');
  const feature=pickBall?'1':'2';
  let next={MSGID:'BET'},player;
  need(!special || raw.steps.length<=4,'FOAM_SEQUENCE_MISMATCH');
  for(const [i,step] of raw.steps.entries()){
    const r=parts(step.requestPayload),p=parts(step.responsePayload),fid=p.FID??'';
    need(next && Object.entries(next).every(([k,v])=>r[k]===v) && p.MSGID===step.msgId && r.MSGID===step.msgId,'FOAM_SEQUENCE_MISMATCH');
    need(/^gdmgcm.{1,505}$/.test(r.PID??'') && (player===undefined || r.PID===player),'SESSION_CHANGED_MID_ROUND');
    player=r.PID;
    const request=step.msgId==='BET'||step.msgId==='FREE_GAME'
      ? {GN:'quarterbackfieldsofglory96',BPR:'1',RB:'5',MSGID:step.msgId}
      : {GN:'quarterbackfieldsofglory96',MSGID:step.msgId,CFG:feature,...(step.msgId==='FEATURE_PICK'?{FP:next.FP}:{})};
    need(Object.keys(r).length===Object.keys(request).length+1 && Object.entries(request).every(([k,v])=>r[k]===v),'FIRST_ROUND_REQUEST_MODE');
    for(const k of ['B','AB','TW'])integer(p[k]);
    if(!special){
      need(['','0','0|'].includes(fid) && !Object.keys(p).some(k=>/^(FS_|NFR_)/.test(k)) && p.CFG===undefined && p.ABPM===undefined,'UNKNOWN_TRIAL_FEATURE');
      need(['0','1'].includes(p.IFG) && (step.msgId!=='FREE_GAME' || p.IFG==='1' && p.NFG!==undefined),'INVALID_FREE_GAME_STATE');
      const remaining=p.NFG===undefined?0:integer(p.NFG);need(remaining<=100,'TRIAL_FREE_LIMIT');
      next=remaining?{MSGID:'FREE_GAME'}:null;continue;
    }
    need(['','0','0|',feature,feature+'|'].includes(fid) && p.ABPM===undefined && [undefined,'0',feature].includes(p.CFG)
      && [undefined,'0'].includes(p.IFG),'UNKNOWN_TRIAL_FEATURE');
    need(Object.keys(p).every(k=>!/^(FS|NFR|CFR|CFP|FTV|FPM)_/.test(k)||k.endsWith('_'+feature)),'UNKNOWN_TRIAL_FEATURE');
    for(const k of ['NFG','TFG','CFGG'])if(p[k]!==undefined)need(integer(p[k])===0,'UNKNOWN_TRIAL_FEATURE');
    for(const k of ['NFR_'+feature,'CFR_'+feature,'CFP_'+feature])if(p[k]!==undefined)need(integer(p[k])<=1,'UNKNOWN_TRIAL_FEATURE');
    need([undefined,'0','1'].includes(p['FS_'+feature]),'UNKNOWN_TRIAL_FEATURE');
    if(i===0){
      need([feature,feature+'|'].includes(fid) && p.CFG===feature && p.IFG==='0' && p['FS_'+feature]==='0' && p['NFR_'+feature]==='1'
        && p['CFR_'+feature]==='0' && p['CFP_'+feature]==='0' && p['FPM_'+feature]==='|','UNKNOWN_TRIAL_FEATURE');
      next={MSGID:'FEATURE_START',CFG:feature};
    }else if(i===1){
      need(p.CFG===feature && p['CFP_'+feature]==='0','UNKNOWN_TRIAL_FEATURE');
      let pick='1';
      if(!pickBall){
        const gsd=parts(p.GSD,'#','~');need(gsd.featureData!==undefined,'UNKNOWN_TRIAL_FEATURE');
        const data=gsd.featureData.split(';');
        need(data.length>=1 && data.length<=5,'FOAM_INVALID_FEATURE_DATA');data.forEach(integer);pick=data[0];
      }
      next={MSGID:'FEATURE_PICK',CFG:feature,FP:`0|1|${pick}`};
    }else if(i===2){
      need([feature,feature+'|'].includes(fid) && p.CFG===feature && p['CFP_'+feature]==='1','UNKNOWN_TRIAL_FEATURE');
      next={MSGID:'FEATURE_END',CFG:feature};
    }else{
      if([feature,feature+'|'].includes(fid))need(['CFG','FS_'+feature,'NFR_'+feature,'CFR_'+feature,'CFP_'+feature].every(k=>p[k]===undefined)
        || p['NFR_'+feature]!==undefined && p['CFR_'+feature]!==undefined,'FOAM_MISSING_END_COUNTERS');
      if(p['NFR_'+feature]!==undefined)need(integer(p['NFR_'+feature])===0 || p['CFR_'+feature]===p['NFR_'+feature],'INCOMPLETE_ROUND');
      need([undefined,'1'].includes(p['CFP_'+feature]),'INCOMPLETE_ROUND');next=null;
    }
  }
  return {next,special,pickBall};
}
export function quarterbackNextRequest(raw){return sequence(raw).next;}
export function quarterbackMapping(raw,baseHash,extensionHash){
  const {next,special,pickBall}=sequence(raw);need(raw.steps.length>0 && next===null,'INCOMPLETE_ROUND');
  const selectedHash=typeof extensionHash==='object' ? extensionHash?.[pickBall?'pickBall':'foam'] : pickBall?undefined:extensionHash;
  if(special)need(typeof selectedHash==='string' && selectedHash.length>0,'FOAM_FEATURE_MAPPING_REQUIRED');
  return {buy:0,bonus:special?(pickBall?3:2):raw.steps.some(s=>s.msgId==='FREE_GAME')?1:0,typeMappingHash:special?selectedHash:baseHash};
}
