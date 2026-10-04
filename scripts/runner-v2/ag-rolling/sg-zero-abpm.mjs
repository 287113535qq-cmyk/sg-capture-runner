import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {params,integer} from '../../trial/capture-batch.mjs';
import {parseXml,one} from '../../trial/pearl-protocol.mjs';
export const ZERO_ABPM='nextgen-zero-abpm-base-v1';
let cached;
const sha=v=>createHash('sha256').update(stable(v)).digest('hex');
const amount=v=>{const n=integer(v);assert(n>=0,'INVALID_MONEY_EVIDENCE');return n;};
function inspect(plan,raw){
 cached??=JSON.parse(fs.readFileSync('config/ag-rolling-zero-abpm-contracts.json','utf8'));
 const e=cached.sources?.[plan.sourceKey];
 assert(cached.schema==='sg-ag-zero-abpm-contracts-v1'&&cached.sourceAllowance===0&&e
  &&plan.rollingPlan==='sg-ag-rolling-plan-v1'&&plan.zeroAbpmContract===ZERO_ABPM&&plan.zeroAbpmContractHash===sha(e)
  &&['gameId','runtimeGameId','sourceKey','betRaw','requestParams','maxSteps'].every(k=>stable(plan[k])===stable(e[k])),'ZERO_ABPM_PLAN_BINDING');
 assert(raw?.zeroAbpmContract===ZERO_ABPM&&raw.sourceKey===e.sourceKey&&raw.fixtureOnly===false
  &&raw.protocol==='nextgen'&&raw.roundFieldsVersion==='sg-round-fields-v1','ZERO_ABPM_PROFILE_REQUIRED');
 assert(Array.isArray(raw.steps)&&raw.steps.length<=1,'ZERO_ABPM_BASE_ONLY');
 const start=amount(raw.startBalanceRaw),cost=amount(e.betRaw);assert(cost>0&&start>=cost,'INVALID_WAGER_BASIS');
 if(!raw.steps.length)return null;
 const s=raw.steps[0];assert(s.msgId==='BET'&&s.methodName==='processGameMessage'&&!s.sourceRejected,'ZERO_ABPM_BASE_ONLY');
 const q=params(s.requestPayload),pid=q.PID;
 assert(stable(Object.fromEntries(Object.entries(q).filter(([k])=>k!=='PID')))===stable({...e.requestParams,MSGID:'BET'}),'FIRST_ROUND_REQUEST_MODE');
 assert(typeof pid==='string'&&pid.startsWith('gdmgcm')&&pid.length>6&&pid.length<512,'TRIAL_SESSION_REQUIRED');
 const p=params(s.responsePayload);
 assert(p.MSGID==='BET'&&p.IFG==='0'&&p.ABPM==='0'&&['','0','0|'].includes(p.FID??'0|')
  &&!Object.keys(p).some(k=>k.startsWith('FS_')||k.startsWith('NFR_'))&&p.CFG===undefined
  &&!String(p.GSD??'').includes('#lives~')&&amount(p.NFG??'0')===0,'UNKNOWN_TRIAL_FEATURE');
 const win=amount(p.TW),end=amount(p.B),ab=amount(p.AB);
 assert(end===start-cost+win&&ab===end&&amount(s.responseBalance)===end,'ZERO_ABPM_MONEY_MISMATCH');
 const xml=parseXml(s.responseXml);assert(xml.tag.toUpperCase()==='GDMRESPONSE'
  &&one(xml,'SUCCESS').children.map(n=>n.text??'').join('').toLowerCase()==='true'
  &&one(xml,'PAYLOAD').children.map(n=>n.text??'').join('')===s.responsePayload,'TRIAL_XML_EVIDENCE_MISMATCH');
 assert(amount(s.elapsedMs)<=300000,'INVALID_TRIAL_TIMING');
 return {startBalanceRaw:start,endBalanceRaw:end,totalWinRaw:win,betRaw:cost};
}
export function zeroAbpmNext(plan,raw){return inspect(plan,raw)?null:{MSGID:'BET'};}
export function zeroAbpmFields(plan,raw,mappingHash){
 const money=inspect(plan,raw);assert(money,'INCOMPLETE_ROUND');
 assert(/^[a-f0-9]{64}$/.test(mappingHash??''),'TYPE_MAPPING_REQUIRED');
 return {roundFieldsVersion:'sg-round-fields-v1',protocol:'nextgen',sourceKey:plan.sourceKey,
  bet:money.betRaw/100,mul:money.totalWinRaw/money.betRaw,buy:0,bonus:0,primaryBonusKind:'none',typeMappingHash:mappingHash,money};
}
