import fs from 'node:fs';
import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {stable} from '../mongo-writer.mjs';
import {params,integer} from '../../trial/capture-batch.mjs';
import {parseXml,one} from '../../trial/pearl-protocol.mjs';
export const AUTOMATIC_FREE_CONTRACT='nextgen-automatic-nfg-free-v1';
let cached;
const amount=value=>{const n=integer(value);assert(n>=0,'INVALID_MONEY_EVIDENCE');return n;};
export function automaticFreePrefix(plan,raw){
 cached??=JSON.parse(fs.readFileSync('config/ag-rolling-automatic-free-contracts.json','utf8'));
 const e=cached.sources?.[plan.sourceKey];
 assert(cached.schema==='sg-ag-rolling-automatic-free-contracts-v1'&&cached.sourceAllowance===0&&e
  &&plan.rollingPlan==='sg-ag-rolling-plan-v1'&&plan.automaticFreeContract===AUTOMATIC_FREE_CONTRACT
  &&plan.automaticFreeContractHash===queueHash(e)
  &&['gameId','runtimeGameId','sourceKey','betRaw','requestParams'].every(k=>stable(plan[k])===stable(e[k]))
  &&(plan.balanceContract??null)===(e.balanceContract??null)
  &&plan.maxSteps===(e.maxSteps??100),'AUTOMATIC_FREE_PLAN_BINDING');
 assert(raw?.automaticFreeContract===AUTOMATIC_FREE_CONTRACT&&raw.sourceKey===plan.sourceKey
  &&raw.fixtureOnly===false&&raw.protocol==='nextgen'&&raw.roundFieldsVersion==='sg-round-fields-v1'
  &&(raw.balanceContract??null)===(e.balanceContract??null),'AUTOMATIC_FREE_PROFILE_REQUIRED');
 const start=amount(raw.startBalanceRaw),stake=amount(e.betRaw);assert(start>=stake&&stake>0,'INVALID_WAGER_BASIS');
 const limit=e.maxSteps??100;assert([100,1026].includes(limit),'AUTOMATIC_FREE_LIMIT_BINDING');
 assert(Array.isArray(raw.steps)&&raw.steps.length<=limit,'INVALID_ROUND_STEPS');
 const held=start-stake;let remaining=0,win=0,balance=null,player;
 for(let i=0;i<raw.steps.length;i++){
  const step=raw.steps[i],msg=i?'FREE_GAME':'BET';
  assert(step?.msgId===msg&&step.methodName==='processGameMessage'&&!step.sourceRejected,'AUTOMATIC_FREE_FRAME_SCOPE');
  assert(i===0||remaining>0,'UNEXPECTED_FREE_CONTINUATION');
  const q=params(step.requestPayload),pid=q.PID;
  assert(stable(Object.fromEntries(Object.entries(q).filter(([k])=>k!=='PID')))===stable({...e.requestParams,MSGID:msg}),'FIRST_ROUND_REQUEST_MODE');
  assert(typeof pid==='string'&&pid.startsWith('gdmgcm')&&pid.length>6&&pid.length<512
   &&(player===undefined||player===pid),'SESSION_CHANGED_MID_ROUND');player=pid;
  const p=params(step.responsePayload);assert(p.MSGID===msg&&p.IFG===String(Number(i>0)),'INVALID_NEXTGEN_STATE');
  remaining=amount(p.NFG??'0');assert(remaining<=100&&(i===0||p.NFG!==undefined),'TRIAL_FREE_LIMIT');
  const fid=p.FID??'0|';assert(['','0','0|'].includes(fid)||(e.allowedFids[msg]??[]).includes(fid)
   &&(remaining>0||i>0&&e.allowTerminalFeatureId),'UNKNOWN_TRIAL_FEATURE');
  assert(!Object.keys(p).some(k=>k.startsWith('FS_')||k.startsWith('NFR_'))&&p.CFG===undefined
   &&p.ABPM===undefined&&!String(p.GSD??'').includes('#lives~'),'UNKNOWN_TRIAL_FEATURE');
  const b=amount(p.B),ab=amount(p.AB),current=amount(p.TW),terminal=i===raw.steps.length-1&&remaining===0;
  assert(b===held+current&&(ab===held||terminal&&ab===b)&&current>=win,'AUTOMATIC_FREE_MONEY_MISMATCH');
  assert(amount(step.responseBalance)===ab,'AUTOMATIC_FREE_OBSERVER_MISMATCH');
  const xml=parseXml(step.responseXml);assert(xml.tag.toUpperCase()==='GDMRESPONSE'
   &&one(xml,'SUCCESS').children.map(n=>n.text??'').join('').toLowerCase()==='true'
   &&one(xml,'PAYLOAD').children.map(n=>n.text??'').join('')===step.responsePayload,'TRIAL_XML_EVIDENCE_MISMATCH');
  assert(amount(step.elapsedMs)<=300000,'INVALID_TRIAL_TIMING');win=current;balance=b;
 }
 return {count:raw.steps.length,remaining,start,stake,win,balance};
}
export function automaticFreeNext(plan,raw){
 const s=automaticFreePrefix(plan,raw);return !s.count?{MSGID:'BET'}:s.remaining?{MSGID:'FREE_GAME'}:null;
}
export function automaticFreeFields(plan,raw,mappingHash){
 const s=automaticFreePrefix(plan,raw);assert(s.count>0&&s.remaining===0,'INCOMPLETE_ROUND');
 assert(/^[a-f0-9]{64}$/.test(mappingHash??''),'TYPE_MAPPING_REQUIRED');
 return {roundFieldsVersion:'sg-round-fields-v1',protocol:'nextgen',sourceKey:plan.sourceKey,bet:s.stake/100,
  mul:s.win/s.stake,buy:0,bonus:Number(s.count>1),primaryBonusKind:s.count>1?'freeGame':'none',typeMappingHash:mappingHash,
  money:{startBalanceRaw:s.start,endBalanceRaw:s.balance,totalWinRaw:s.win,betRaw:s.stake}};
}
