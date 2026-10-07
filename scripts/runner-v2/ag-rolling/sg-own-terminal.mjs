// Own terminal contract candidate. Frozen source profiles are activated separately.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {queueHash} from './sg-queue-profile.mjs';
import {automaticFreePrefix} from './sg-automatic-free.mjs';
import {params,integer} from '../../trial/capture-batch.mjs';
import {parseXml,one,children} from '../../trial/pearl-protocol.mjs';
export const OWN_TERMINAL='nextgen-own-terminal-evidence-v3';
const contract=JSON.parse(fs.readFileSync(new URL('../../../config/ag-rolling-own-terminal-contracts.json',import.meta.url)));
const policies=contract.sources;
const money=x=>{const v=integer(x);assert(Number.isSafeInteger(v)&&v>=0,'TERMINAL_MONEY');return v;};
const same=(a,b)=>queueHash(a)===queueHash(b);
const gsd=s=>{const pairs=s.split('#').map(t=>t.split('~'));assert(pairs.every(t=>t.length===2)&&new Set(pairs.map(t=>t[0])).size===pairs.length,'TERMINAL_GSD');return Object.fromEntries(pairs);};
export function verifyTerminal(plan,raw){
 const p=policies[String(plan.gameId)];assert(p&&queueHash(plan)===p.planHash&&raw.sourceKey===p.sourceKey,'TERMINAL_PLAN');
 assert(raw.steps.length>1&&raw.steps.length<=plan.maxSteps,'TERMINAL_STEPS');
 const previous=automaticFreePrefix(plan,{...raw,steps:raw.steps.slice(0,-1)});
 assert(previous.remaining===1,'TERMINAL_PREVIOUS_PENDING');
 const st=raw.steps.at(-1),v=params(st.responsePayload),prev=params(raw.steps.at(-2).responsePayload);
 assert(same(Object.keys(v).sort(),p.responseKeys)&&st.methodName==='processGameMessage'&&st.msgId==='FREE_GAME'&&!st.sourceRejected,'TERMINAL_FRAME');
 assert(v.MSGID==='FREE_GAME'&&v.IFG==='1'&&v.NFG==='0'&&v.FID===p.terminalFid&&prev.FID===p.previousFid
  &&v.TFG===String(p.terminalTotal)&&v.CFGG===v.TFG&&prev.TFG===v.TFG&&money(prev.CFGG)+1===money(v.CFGG)
  &&v.FGT===undefined,'TERMINAL_COUNTER');
 let sid,pid,win=0;
 for(const step of raw.steps){
  const q=params(step.requestPayload),a=params(step.responsePayload);
  assert(same(Object.fromEntries(Object.entries(q).filter(([k])=>k!=='PID')),{...plan.requestParams,MSGID:step.msgId})
   &&q.PID?.startsWith('gdmgcm')&&q.PID.length<512&&(pid===undefined||pid===q.PID),'TERMINAL_REQUEST');pid=q.PID;
  assert(typeof a.SID==='string'&&a.SID.length>0&&(sid===undefined||sid===a.SID),'TERMINAL_SESSION');sid=a.SID;
  assert(a.FRBAL==='0'&&a.BPR===plan.requestParams.BPR&&a.MUL==='1','TERMINAL_MODE');
  assert(money(a.TW)>=win&&money(a.CW)===money(a.TW)-win,'TERMINAL_WIN_DELTA');win=money(a.TW);
  const xml=parseXml(step.responseXml);
  assert(xml.tag.toUpperCase()==='GDMRESPONSE'&&same(children(xml).map(n=>n.tag),['OGS_RC','SUCCESS','PAYLOAD'])
   &&children(xml).every(n=>!children(n).length&&!Object.keys(n.a).length)&&!Object.keys(xml.a).length
   &&one(xml,'OGS_RC').children.map(n=>n.text??'').join('')==='0'
   &&one(xml,'SUCCESS').children.map(n=>n.text??'').join('').toLowerCase()==='true'
   &&one(xml,'PAYLOAD').children.map(n=>n.text??'').join('')===step.responsePayload,'TERMINAL_XML');
  assert(money(step.elapsedMs)<=300000,'TERMINAL_TIME');
 }
 const total=money(v.TW),balance=money(v.B),held=previous.start-previous.stake;
 assert(total>=previous.win&&balance===held+total&&money(v.AB)===balance&&money(st.responseBalance)===balance,'TERMINAL_BALANCE');
 if(plan.gameId===32708){
  assert(money(v.FGTW)===money(prev.FGTW)+money(v.CW),'TERMINAL_FREE_TOTAL');
  const g=gsd(v.GSD);assert(g.CPDO==='-1'&&g.AGS==='7'&&g.MZ.endsWith('|2')&&!['SNFG','STFG','SCFGG'].some(k=>k in g),'TERMINAL_NESTED_PENDING');
 }else{
  const a=gsd(prev.GSD),b=gsd(v.GSD),direct=raw.steps.length===2&&prev.MSGID==='BET';
  assert(b.CFNFG==='0'&&b.WHEELSPIN==='1'&&b.WHSLICE==='MINI|'&&['0|','7|'].includes(b.WHSTOP)&&b.CFTFG==='1'&&b.CFCFGG==='1','TERMINAL_WHEEL_STATE');
  assert(direct?prev.FGT==='1'&&prev.CFGG==='0'&&prev.FGTW==='0'&&a.CFNFG===undefined&&a.FMS===undefined&&b.FMS===undefined&&a.FEAT_WIN===undefined
   :a.CFNFG==='0'&&a.FMS==='3'&&b.FMS==='3'&&a.FEAT_WIN===`FG;${previous.win}|`,'TERMINAL_WHEEL_ENTRY');
  assert(b.FEAT_WIN===(direct?'':`FG;${previous.win}|`)+`WHEEL;${money(v.CW)}|`
   &&money(v.FGTW)===money(v.CW)&&money(b.WHJPM)*previous.stake===money(v.CW),'TERMINAL_WHEEL_AWARD');
 }
 return {startBalanceRaw:previous.start,endBalanceRaw:balance,totalWinRaw:total,betRaw:previous.stake,bonus:1,primaryBonusKind:'freeGame'};
}

export function ownTerminalPrevious(plan){
 const {ownTerminalContract,ownTerminalContractHash,...previous}=plan,p=policies[String(plan.gameId)];
 assert(p&&[32708,32715].includes(plan.gameId)&&ownTerminalContract===OWN_TERMINAL&&ownTerminalContractHash===queueHash(p)
  &&contract.schema==='sg-ag-own-terminal-contract-v3'&&contract.contract===OWN_TERMINAL
  &&contract.sourceRequests===0&&contract.mongoWrites===0&&contract.failedRoundsCredited===0
  &&queueHash(previous)===p.planHash&&p.gameId===plan.gameId&&p.sourceKey===plan.sourceKey
  &&p.closedNaturalRounds===(plan.gameId===32708?4:5)&&new Set(p.closedRawHashes).size===p.closedNaturalRounds
  &&p.closedRawHashes.every(h=>/^[a-f0-9]{64}$/.test(h)),'OWN_TERMINAL_PLAN_BINDING');
 return previous;
}
export function ownTerminalBinding(plan,raw){
 const previous=ownTerminalPrevious(plan);
 assert(raw?.ownTerminalContract===OWN_TERMINAL&&raw.automaticFreeContract===previous.automaticFreeContract
  &&raw.sourceKey===plan.sourceKey&&raw.fixtureOnly===false&&raw.protocol==='nextgen'
  &&raw.roundFieldsVersion==='sg-round-fields-v1'&&raw.balanceContract===undefined,'OWN_TERMINAL_RAW_BINDING');
 return previous;
}
export function ownTerminalPrefix(plan,raw){
 const previous=ownTerminalBinding(plan,raw);assert(Array.isArray(raw.steps)&&raw.steps.length<=previous.maxSteps,'OWN_TERMINAL_STEPS');
 const last=raw.steps.at(-1),v=last?params(last.responsePayload):{};
 if(last?.msgId==='FREE_GAME'&&v.NFG==='0'&&v.FID===policies[String(plan.gameId)].terminalFid){
  const m=verifyTerminal(previous,raw);return {count:raw.steps.length,remaining:0,start:m.startBalanceRaw,stake:m.betRaw,win:m.totalWinRaw,balance:m.endBalanceRaw};
 }
 return automaticFreePrefix(previous,raw);
}
export function ownTerminalNext(plan,raw){const s=ownTerminalPrefix(plan,raw);return !s.count?{MSGID:'BET'}:s.remaining?{MSGID:'FREE_GAME'}:null;}
export function ownTerminalFields(plan,raw,mappingHash){const s=ownTerminalPrefix(plan,raw);
 assert(s.count>0&&s.remaining===0,'INCOMPLETE_ROUND');assert(/^[a-f0-9]{64}$/.test(mappingHash??''),'TYPE_MAPPING_REQUIRED');
 return {roundFieldsVersion:'sg-round-fields-v1',protocol:'nextgen',sourceKey:plan.sourceKey,bet:s.stake/100,mul:s.win/s.stake,
 buy:0,bonus:Number(s.count>1),primaryBonusKind:s.count>1?'freeGame':'none',typeMappingHash:mappingHash,
 money:{startBalanceRaw:s.start,endBalanceRaw:s.balance,totalWinRaw:s.win,betRaw:s.stake}};
}
export function ownTerminalProof(plan,proof){
 const previous=ownTerminalPrevious(plan),p=policies[String(plan.gameId)],e=proof?.ownTerminalEvidence,w=e?.wiringEvidence;
 const {planHash,ownTerminalEvidence,...fields}=proof??{},oldProof={...fields,planHash:queueHash(previous)};
 assert(planHash===queueHash(plan)&&queueHash(oldProof)===p.previousProofHash
  &&e?.schema==='sg-ag-own-terminal-repair-evidence-v3'&&e.previousPlanHash===p.planHash&&e.previousProofHash===p.previousProofHash
  &&e.contractHash===queueHash(p)&&e.ownClosedNaturalRounds===p.closedNaturalRounds&&e.nativeEvidenceHash===queueHash(p.closedRawHashes)
  &&e.ordinaryHistoryFileSha256===oldProof.historyFileSha256&&e.ordinaryRows===100&&e.independentJsPython===true
  &&e.sourceRequests===0&&e.mongoWrites===0&&e.failedRoundsCredited===0
  &&w?.schema==='sg-own-terminal-codec-game-v3'&&w.evidenceHash===queueHash(Object.fromEntries(Object.entries(w).filter(([k])=>k!=='evidenceHash')))
  &&w.gameId===String(plan.gameId)&&w.actualCodecPythonRecordAndVerify===true&&w.ownClosedNaturalRounds===p.closedNaturalRounds
  &&w.ordinaryRows===100&&w.actualOwnAndOrdinaryCodecRequests===(plan.gameId===32708?254:151)
  &&w.totalNewMarkedRecords===100+p.closedNaturalRounds&&w.oldMarkerTerminalRejected===p.closedNaturalRounds
  &&w.oldRawHashesUnchanged===true&&w.historyFileSha256===oldProof.historyFileSha256
  &&/^[a-f0-9]{64}$/.test(w.fullRecordsHash??'')&&w.sourceRequests===0&&w.mongoWrites===0&&w.failedRoundsCredited===0,
  'OWN_TERMINAL_PROOF');
 return {previousPlan:previous,previousProof:oldProof};
}
