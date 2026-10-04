import fs from 'node:fs';
import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {params,integer} from '../../trial/capture-batch.mjs';
import {parseXml,one,children} from '../../trial/pearl-protocol.mjs';
import {AUTOMATIC_FREE_CONTRACT,automaticFreePrefix} from './sg-automatic-free.mjs';
export const AUTOMATIC_TERMINAL='nextgen-moneyraid-terminal-evidence-v2';
let policy,legacy;
const same=(a,b)=>queueHash(a)===queueHash(b);
const money=v=>{const n=integer(v);assert(n>=0,'AUTOMATIC_TERMINAL_MONEY');return n;};
export function terminalBinding(plan,raw){
 policy??=JSON.parse(fs.readFileSync('config/ag-rolling-automatic-terminal-contracts.json','utf8'));
 legacy??=JSON.parse(fs.readFileSync('config/ag-rolling-automatic-free-contracts.json','utf8'));
 const {automaticTerminalContract,automaticTerminalContractHash,...previous}=plan,b=policy.sourceBinding;
 assert(automaticTerminalContract===AUTOMATIC_TERMINAL&&automaticTerminalContractHash===queueHash(policy)
  &&policy.schema==='sg-ag-moneyraid-terminal-evidence-v2'&&policy.contract===AUTOMATIC_TERMINAL
  &&queueHash(previous)===b.previousPlanHash&&plan.gameId===32595&&plan.runtimeGameId===33066
  &&plan.runtimeSlug==='moneyraidwapiti96'&&plan.sourceKey===b.sourceKey&&plan.betRaw===200&&plan.maxSteps===100
  &&same(plan.requestParams,b.requestParams)&&plan.automaticFreeContract===AUTOMATIC_FREE_CONTRACT
  &&plan.automaticFreeContractHash===b.previousContractHash&&queueHash(legacy.sources[plan.sourceKey])===b.previousContractHash
  &&policy.ownClosedNaturalRounds===104&&same(policy.terminalFidCounts,{'2|':91,'3|':13})
  &&same(policy.initialRemaining,{'2|':[7],'3|':[9,10,11,12]})
  &&policy.sourceRequests===0&&policy.mongoWrites===0&&policy.failedRoundsCredited===0,'AUTOMATIC_TERMINAL_BINDING');
 assert(raw?.automaticTerminalContract===AUTOMATIC_TERMINAL&&raw.automaticFreeContract===AUTOMATIC_FREE_CONTRACT
  &&raw.sourceKey===plan.sourceKey&&raw.fixtureOnly===false&&raw.protocol==='nextgen'
  &&raw.roundFieldsVersion==='sg-round-fields-v1'&&raw.balanceContract===undefined,'AUTOMATIC_TERMINAL_PROFILE');
 return {previous,policy};
}
export function terminalPrefix(plan,raw){
 const {previous,policy:p}=terminalBinding(plan,raw);
 assert(Array.isArray(raw.steps)&&raw.steps.length<=100,'INVALID_ROUND_STEPS');
 if(!raw.steps.length||!['2|','3|'].includes(params(raw.steps[0].responsePayload).FID))return automaticFreePrefix(previous,raw);
 const start=money(raw.startBalanceRaw),stake=200,held=start-stake;assert(held>=0,'INVALID_WAGER_BASIS');
 let remaining=0,total=0,win=0,base=0,balance=null,player,sid,fid;
 for(let i=0;i<raw.steps.length;i++){
  const st=raw.steps[i],msg=i?'FREE_GAME':'BET',q=params(st.requestPayload),v=params(st.responsePayload);
  assert(st.msgId===msg&&st.methodName==='processGameMessage'&&!st.sourceRejected,'AUTOMATIC_TERMINAL_FRAME');
  assert(same(Object.fromEntries(Object.entries(q).filter(([k])=>k!=='PID')),{...previous.requestParams,MSGID:msg})
   &&typeof q.PID==='string'&&q.PID.startsWith('gdmgcm')&&q.PID.length>6&&q.PID.length<512
   &&(player===undefined||player===q.PID),'AUTOMATIC_TERMINAL_REQUEST');player=q.PID;
  assert(p.responseKeySets[msg].some(keys=>same(Object.keys(v).sort(),keys)),'AUTOMATIC_TERMINAL_SHAPE');
  assert(v.MSGID===msg&&v.IFG===String(Number(i>0))&&v.BPR==='10'&&v.MUL==='1'&&v.FRBAL==='0'
   &&typeof v.SID==='string'&&v.SID.length>0&&v.SID.length<512&&(sid===undefined||sid===v.SID),'AUTOMATIC_TERMINAL_STATE');sid=v.SID;
  const left=money(v.NFG);
  if(!i){fid=v.FID;total=left;base=money(v.TW);assert(p.initialRemaining[fid]?.includes(total)&&v.FGT===String(total),'AUTOMATIC_TERMINAL_COUNTER');}
  assert(v.FID===fid&&v.TFG===String(total)&&v.CFGG===String(i)
   &&(i===0||remaining>0&&left===remaining-1&&v.FGT===undefined),'AUTOMATIC_TERMINAL_COUNTER');
  assert(!Object.keys(v).some(k=>k.startsWith('FS_')||k.startsWith('NFR_'))&&v.CFG===undefined&&v.ABPM===undefined
   &&!String(v.GSD??'').includes('#lives~'),'UNKNOWN_TRIAL_FEATURE');
  const current=money(v.TW),b=money(v.B),ab=money(v.AB),terminal=i===raw.steps.length-1&&left===0;
  assert(current>=win&&money(v.CW)===current-win&&money(v.FGTW)===current-base
   &&b===held+current&&(ab===held||terminal&&ab===b)&&money(st.responseBalance)===ab,'AUTOMATIC_TERMINAL_MONEY');
  const xml=parseXml(st.responseXml);assert(xml.tag.toUpperCase()==='GDMRESPONSE'&&Object.keys(xml.a).length===0
   &&same(children(xml).map(n=>n.tag),['OGS_RC','SUCCESS','PAYLOAD'])
   &&children(xml).every(n=>Object.keys(n.a).length===0&&children(n).length===0)
   &&one(xml,'OGS_RC').children.map(n=>n.text??'').join('')==='0'
   &&one(xml,'SUCCESS').children.map(n=>n.text??'').join('').toLowerCase()==='true'
   &&one(xml,'PAYLOAD').children.map(n=>n.text??'').join('')===st.responsePayload,'TRIAL_XML_EVIDENCE_MISMATCH');
  assert(money(st.elapsedMs)<=300000,'INVALID_TRIAL_TIMING');remaining=left;win=current;balance=b;
 }
 return {count:raw.steps.length,remaining,start,stake,win,balance};
}
export function terminalNext(plan,raw){const s=terminalPrefix(plan,raw);return !s.count?{MSGID:'BET'}:s.remaining?{MSGID:'FREE_GAME'}:null;}
export function terminalFields(plan,raw,mappingHash){const s=terminalPrefix(plan,raw);
 assert(s.count>0&&s.remaining===0,'INCOMPLETE_ROUND');assert(/^[a-f0-9]{64}$/.test(mappingHash??''),'TYPE_MAPPING_REQUIRED');
 return {roundFieldsVersion:'sg-round-fields-v1',protocol:'nextgen',sourceKey:plan.sourceKey,bet:s.stake/100,
  mul:s.win/s.stake,buy:0,bonus:Number(s.count>1),primaryBonusKind:s.count>1?'freeGame':'none',typeMappingHash:mappingHash,
  money:{startBalanceRaw:s.start,endBalanceRaw:s.balance,totalWinRaw:s.win,betRaw:s.stake}};
}
