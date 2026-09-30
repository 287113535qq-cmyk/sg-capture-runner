// Independent offline candidate, not imported by the capture worker.
import assert from 'node:assert/strict';
const need=(ok,code)=>assert(ok,code);
const source='huffnpuffmoneymansionhighlimit96-round-one-base-v1';
const known=new Set(['MMBG','BRS','BGHHPOS','BMS','VA','HHPOS','BWC','BWS','FEAT','NEXTFRAMES','MMW','PCFID','FRAMES','PREVFRAMES','FRAMEWINS']);
function parts(s,sep,delim){
  need(typeof s==='string','HUFF_INVALID_PAYLOAD');const out={};
  for(const part of s.split(sep).filter(Boolean)){
    const at=part.indexOf(delim),k=part.slice(0,at);
    need(at>0&&!Object.hasOwn(out,k),'HUFF_AMBIGUOUS_PAYLOAD');out[k]=part.slice(at+1);
  }return out;
}
function numbers(s,sep,signed=false){
  need(typeof s==='string'&&s.length,'HUFF_MISSING_BOARD');
  const a=s.split(sep);need(a.every(v=>(signed?/^-?\d+$/:/^\d+$/).test(v)&&Number.isSafeInteger(Number(v))),'HUFF_INVALID_BOARD');
  return a.map(Number);
}
const ids=s=>s?numbers(s.replace(/\|$/,''),'|'):[];
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function reviewTouchup(raw){
  need(raw?.sourceKey===source&&raw.protocol==='nextgen','HUFF_PROFILE_REQUIRED');
  need(Array.isArray(raw.steps)&&raw.steps.length>=2&&raw.steps.length<=8,'HUFF_TOUCHUP_LENGTH');let player;
  raw.steps.forEach((s,i)=>{
    const msg=i?'FREE_GAME':'BET',p=parts(s.responsePayload,'&','='),r=parts(s.requestPayload,'&','='),g=parts(p.GSD??'','#','~');
    need(s.msgId===msg&&p.MSGID===msg&&r.MSGID===msg,'HUFF_SEQUENCE_MISMATCH');
    need(Object.keys(r).sort().join(',')==='AP,BPR,GN,MSGID,PID,RB'
      &&r.AP==='false'&&r.BPR==='25'&&r.GN==='huffnpuffmoneymansionhighlimit96'&&r.RB==='5','HUFF_REQUEST_MODE');
    need(/^gdmgcm.{1,505}$/.test(r.PID??'')&&(player===undefined||player===r.PID),'HUFF_SESSION_MISMATCH');player=r.PID;
    need(!Object.keys(p).some(k=>/^(FS_|NFR_)/.test(k))&&!('CFG'in p)&&!('ABPM'in p),'HUFF_UNREVIEWED_FEATURE_PROTOCOL');
    need(!('GCT'in p)&&p.RID==='0','HUFF_REPLAY_NOT_ALLOWED');
    need(Object.keys(g).every(k=>known.has(k)),'HUFF_UNKNOWN_TOUCHUP_FIELD');
    need((p.FRBAL??'0')==='0'&&!['SB','FRTR','FRTW','BUY_IN'].some(k=>k in p)
      &&!Object.keys(p).some(k=>/^(CFR_|CFP_|FR_)/.test(k)),'HUFF_UNREVIEWED_FEATURE_PROTOCOL');
    for(const k of ['B','AB','TW'])need(/^\d+$/.test(p[k]??'')&&Number.isSafeInteger(Number(p[k])),'HUFF_AMOUNT');
    need(Number.isSafeInteger(s.elapsedMs)&&s.elapsedMs>=0&&s.elapsedMs<=300000,'INVALID_TRIAL_TIMING');
    need(p.IFG===(i?'1':'0'),'HUFF_INVALID_FREE_STATE');
    const n=['NFG','TFG','CFGG'].map(k=>{need(/^\d+$/.test(p[k]??''),'HUFF_COUNTER');return Number(p[k]);});
    const board=numbers(g.VA,',');need(board.length===15&&board.every(v=>v<=15),'HUFF_INVALID_BOARD');
    need(!(board.filter(v=>v===13).length>=3&&board.filter(v=>v===14).length>=6),'HUFF_COMBINED_EXIT_NOT_ADAPTED');
    if('FRAMEWINS'in g){const wins=numbers(g.FRAMEWINS,'|',true),frames=numbers(g.FRAMES,'|');
      need(wins.length===15&&frames.length===15,'HUFF_INVALID_FRAME_AWARDS');need(wins.every(v=>v>=0),'HUFF_FRAME_EXIT_NOT_ADAPTED');}
    const f=ids(p.FID),prev=ids(g.PCFID);
    if(i===0)need(eq(f,[0])&&!prev.length&&g.FEAT===undefined&&g.MMBG==='1'&&!g.MMW&&eq(n,[1,1,0]),'HUFF_TOUCHUP_TRIGGER_REQUIRED');
    else if(i===1)need(eq(f,[2])&&eq(prev,[0])&&g.FEAT==='MMANSION'&&g.MMBG==='1'&&g.MMW&&eq(n,[6,6,0]),'HUFF_TOUCHUP_AWARD_REQUIRED');
    else{
      need(eq(f,[2])&&(!prev.length||eq(prev,[2]))&&g.FEAT==='PAINT'&&[undefined,'0'].includes(g.MMBG)&&!g.MMW,'HUFF_TOUCHUP_TRANSITION_NOT_ADAPTED');
      need(eq(n,[7-i,6,i-1]),'HUFF_TOUCHUP_PROGRESS_NOT_ADAPTED');need('FRAMEWINS'in g&&'FRAMES'in g,'HUFF_MISSING_FRAME_AWARDS');
    }
  });
  const complete=raw.steps.length===8;
  if(complete){const p=parts(raw.steps.at(-1).responsePayload,'&','=');
    need(Number.isSafeInteger(raw.startBalanceRaw)&&raw.startBalanceRaw>=0
      &&raw.startBalanceRaw-Number(p.B)+Number(p.TW)===500&&p.B===p.AB,'HUFF_SETTLEMENT_MISMATCH');}
  return {schema:'sg-huff-touchup-candidate-v1',candidateComplete:complete,clientNext:complete?null:'FREE_GAME',captureAuthorized:false,sourceRequests:0,naturalTerminalObserved:false};
}
