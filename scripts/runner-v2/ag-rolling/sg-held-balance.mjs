import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {params,integer} from '../../trial/capture-batch.mjs';
import {parseXml,one} from '../../trial/pearl-protocol.mjs';
export const BALANCE_CONTRACT='nextgen-held-award-balance-v1';
let cached;
const sha=v=>createHash('sha256').update(stable(v)).digest('hex');
const amount=value=>{const n=integer(value);assert(n>=0,'INVALID_MONEY_EVIDENCE');return n;};
export function heldBalanceFields(plan,raw,mappingHash){
 cached??=JSON.parse(fs.readFileSync('config/ag-rolling-balance-contracts.json','utf8'));
 const entry=cached.sources?.[plan.sourceKey];
 assert(cached.schema==='sg-ag-rolling-balance-contracts-v1'&&cached.sourceAllowance===0&&entry
  &&plan.rollingPlan==='sg-ag-rolling-plan-v1'&&plan.balanceContract===BALANCE_CONTRACT&&plan.balanceContractHash===sha(entry)
  &&['gameId','runtimeGameId','sourceKey','betRaw','requestParams'].every(k=>stable(plan[k])===stable(entry[k])),'HELD_BALANCE_PLAN_BINDING');
 assert(raw?.balanceContract===BALANCE_CONTRACT&&raw.sourceKey===plan.sourceKey&&raw.fixtureOnly===false
  &&raw.protocol==='nextgen'&&raw.roundFieldsVersion==='sg-round-fields-v1','HELD_BALANCE_PROFILE_REQUIRED');
 const start=amount(raw.startBalanceRaw),cost=amount(entry.betRaw);assert(cost>0&&start>=cost,'INVALID_WAGER_BASIS');
 assert(Array.isArray(raw.steps)&&raw.steps.length>0&&raw.steps.length<=100,'INVALID_ROUND_STEPS');
 const held=start-cost;let priorRemaining=0,win=0,balance,player;
 for(let i=0;i<raw.steps.length;i++){
  const step=raw.steps[i],msg=i?'FREE_GAME':'BET';
  assert(step.msgId===msg&&step.methodName==='processGameMessage'&&!step.sourceRejected,'HELD_BALANCE_FRAME_SCOPE');
  assert(i===0||priorRemaining>0,'UNEXPECTED_FREE_CONTINUATION');
  const q=params(step.requestPayload),pid=q.PID;
  assert(stable(Object.fromEntries(Object.entries(q).filter(([k])=>k!=='PID')))===stable({...entry.requestParams,MSGID:msg}),'FIRST_ROUND_REQUEST_MODE');
  assert(typeof pid==='string'&&pid.startsWith('gdmgcm')&&pid.length>6&&pid.length<512&&(player===undefined||player===pid),'SESSION_CHANGED_MID_ROUND');player=pid;
  const p=params(step.responsePayload);assert(p.MSGID===msg&&p.IFG===(i?'1':'0'),'INVALID_NEXTGEN_STATE');
  assert(['0','0|',''].includes(p.FID??'0|')&&!Object.keys(p).some(k=>k.startsWith('FS_')||k.startsWith('NFR_'))
   &&p.CFG===undefined&&p.ABPM===undefined&&!String(p.GSD??'').includes('#lives~'),'UNKNOWN_TRIAL_FEATURE');
  const remaining=amount(p.NFG??'0');assert(remaining<=100&&(i===0||p.NFG!==undefined),'TRIAL_FREE_LIMIT');
  const b=amount(p.B),ab=amount(p.AB),currentWin=amount(p.TW);
  const terminal=i===raw.steps.length-1&&remaining===0;
  assert(b===held+currentWin&&(ab===held||terminal&&ab===b)&&currentWin>=win,'HELD_BALANCE_RELATION_MISMATCH');
  assert(amount(step.responseBalance)===ab,'HELD_BALANCE_OBSERVER_MISMATCH');
  const xml=parseXml(step.responseXml);assert(xml.tag.toUpperCase()==='GDMRESPONSE'
   &&one(xml,'SUCCESS').children.map(n=>n.text??'').join('').toLowerCase()==='true'
   &&one(xml,'PAYLOAD').children.map(n=>n.text??'').join('')===step.responsePayload,'TRIAL_XML_EVIDENCE_MISMATCH');
  assert(amount(step.elapsedMs)<=300000,'INVALID_TRIAL_TIMING');priorRemaining=remaining;balance=b;win=currentWin;
 }
 assert(priorRemaining===0,'INCOMPLETE_ROUND');assert(/^[a-f0-9]{64}$/.test(mappingHash??''),'TYPE_MAPPING_REQUIRED');
 return {roundFieldsVersion:'sg-round-fields-v1',protocol:'nextgen',sourceKey:plan.sourceKey,bet:cost/100,mul:win/cost,buy:0,
  bonus:Number(raw.steps.length>1),primaryBonusKind:raw.steps.length>1?'freeGame':'none',typeMappingHash:mappingHash,
  money:{startBalanceRaw:start,endBalanceRaw:balance,totalWinRaw:win,betRaw:cost}};
}
