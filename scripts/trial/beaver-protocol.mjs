// Independent FID1 protocol; unsupported mixed features remain rejected.
const source='beaverlasvegas96-round-one-base-v1';
export const BEAVER_SOURCE=source;
export const BEAVER_EXTENSION=source+'-beaver-free-v1';
export const BEAVER_CFG1_EXTENSION=source+'-beaver-free-cfg1-v2';
const plan={gameId:32820,sourceKey:source,betRaw:100,
  requestParams:{AP:'false',BPL:'5',GN:'beaverlasvegas96',LB:'20'}};
export function beaverNextRequest(raw){
  if(!raw.steps.length)return {MSGID:'BET'};
  const {next}=beaverSequence(raw,plan);return next?{MSGID:next}:null;
}
export function beaverMapping(raw,baseHash,extensionHash){
  const e=beaverEvidence(raw,plan);
  const cfg1=raw.steps.some(s=>parameters(parameters(s.responsePayload).GSD??'','#','~').CFG==='1');
  const selected=cfg1?extensionHash?.cfg1:(typeof extensionHash==='string'?extensionHash:extensionHash?.free);
  requireValue(!e.independentFid1 || typeof selected==='string','BEAVER_MAPPING_REQUIRED');
  return {buy:0,bonus:e.independentFid1?2:e.kind==='freeGame'?1:0,
    typeMappingHash:e.independentFid1?selected:baseHash};
}
const requireValue=(yes,code)=>{if(!yes)throw Error(code);};
const integer=x=>{requireValue(typeof x==='string' && /^\d+$/.test(x) && Number.isSafeInteger(Number(x)),'INVALID_NUMBER');return Number(x);};
function parameters(text,separator='&',equals='='){
  requireValue(typeof text==='string','INVALID_PARAMETERS');const out=Object.create(null);
  for(const part of text.split(separator)){
    if(!part)continue;const index=part.indexOf(equals),key=part.slice(0,index);
    requireValue(index>0 && !Object.hasOwn(out,key),'AMBIGUOUS_PARAMETERS');
    if(equals==='~')requireValue(part.lastIndexOf('~')===index,'AMBIGUOUS_GSD');
    out[key]=part.slice(index+1);
  }
  return out;
}
export function beaverSequence(raw,plan){
  requireValue(plan.gameId===32820 && plan.sourceKey===source && raw.sourceKey===source
    && raw.protocol==='nextgen' && raw.steps?.length>0 && raw.steps.length<=100,'BEAVER_PROFILE_REQUIRED');
  let next='BET',player,previous,special=false,replay=false,last,sawBeaver=false,sawCfg1=false,priorCounts;
  for(const frame of raw.steps){
    requireValue(next!==null && frame.msgId===next,'BEAVER_SEQUENCE_MISMATCH');
    const request=parameters(frame.requestPayload),response=parameters(frame.responsePayload);
    const expected={...plan.requestParams,MSGID:frame.msgId};
    requireValue(Object.keys(request).length===Object.keys(expected).length+1
      && Object.entries(expected).every(([k,v])=>request[k]===v),'REQUEST_MISMATCH');
    requireValue(/^gdmgcm.{1,505}$/.test(request.PID??'') && (player===undefined || request.PID===player),'SESSION_CHANGED');
    player=request.PID;
    requireValue(response.MSGID===frame.msgId,'MESSAGE_MISMATCH');
    const fid=response.FID??'',active=['1','1|'].includes(fid);
    requireValue(['','0','0|','1','1|'].includes(fid) && !Object.keys(response).some(k=>/^(FS_|NFR_|CFR_|CFP_)/.test(k))
      && !['CFG','ABPM','SB'].some(k=>Object.hasOwn(response,k)),'UNKNOWN_TRIAL_FEATURE');
    const gsd=parameters(response.GSD??'','#','~'),beaver=gsd.CFG==='0';
    requireValue(!Object.hasOwn(gsd,'CFG') || beaver && ['0','0|'].includes(fid)
      || gsd.CFG==='1' && active,'UNSUPPORTED_BEAVER_NESTED_FEATURE');
    sawBeaver ||= beaver;
    requireValue(!((special||active) && sawBeaver),'UNSUPPORTED_BEAVER_NESTED_FEATURE');
    for(const k of ['B','AB','TW'])integer(response[k]);
    requireValue(['0','1'].includes(response.IFG) && (frame.msgId!=='FREE_GAME' || response.IFG==='1'),'INVALID_FREE_STATE');
    const counters=['NFG','TFG','CFGG'].map(k=>Object.hasOwn(response,k)?integer(response[k]):null);
    requireValue(counters.every(x=>x===null || x<=100),'FREE_LIMIT');
    if(frame.msgId==='FREE_GAME' || active || counters[0])requireValue(counters.every(x=>x!==null),'MISSING_FREE_COUNTER');
    sawCfg1 ||= gsd.CFG==='1';
    if(sawCfg1){
      const [n,t,c]=counters;requireValue(counters.every(x=>x!==null)&&t===n+c,'BEAVER_CFG1_COUNTERS');
      if(priorCounts){requireValue(c===priorCounts[2]+1&&t>=priorCounts[1],'BEAVER_CFG1_PROGRESS');
        if(n===0)requireValue(priorCounts[0]===1&&t===priorCounts[1],'BEAVER_CFG1_TERMINAL');}
    }
    if(active && !previous){
      requireValue(previous===undefined,'UNSUPPORTED_BEAVER_NESTED_FEATURE');
      requireValue(counters[0]>0,'EMPTY_TRIGGER');
    }
    if(special && !active)requireValue(counters[0]===0,'UNSUPPORTED_BEAVER_NESTED_FEATURE');
    replay ||= previous===true && frame.msgId==='FREE_GAME';special ||= active;
    previous=active;last=response;priorCounts=counters;next=counters[0]?'FREE_GAME':null;
  }
  return {next,special,replay,last};
}
export function beaverEvidence(raw,plan){
  const {next,special,replay,last}=beaverSequence(raw,plan);
  requireValue(raw.roundFieldsVersion==='sg-round-fields-v1' && next===null && (!special||replay),'INCOMPLETE_ROUND');
  const end=integer(last.B),win=integer(last.TW),stake=raw.startBalanceRaw-end+win;
  requireValue(end===integer(last.AB) && (raw.steps.at(-1).responseBalance===undefined
    || Number(raw.steps.at(-1).responseBalance)===end),'BALANCE_MISMATCH');
  requireValue(Number.isSafeInteger(raw.startBalanceRaw) && stake===plan.betRaw,'STAKE_MISMATCH');
  requireValue(!Object.hasOwn(last,'NFG') || integer(last.NFG)===0,'INCOMPLETE_ROUND');
  return {betRaw:stake,totalWinRaw:win,endBalanceRaw:end,
    kind:raw.steps.some(s=>s.msgId==='FREE_GAME')?'freeGame':'none',independentFid1:special};
}
