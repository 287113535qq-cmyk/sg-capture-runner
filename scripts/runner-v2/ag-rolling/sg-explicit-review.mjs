import fs from 'node:fs';
import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {stable} from '../mongo-writer.mjs';
import {params,integer} from '../../trial/capture-batch.mjs';
import {parseXml,one} from '../../trial/pearl-protocol.mjs';
// Read-only review of source-pinned request constructors. This is not used
// by next(), intent(), fields() or record() and never approves a settlement.
let cached;
const amount=v=>{const n=integer(v);assert(n>=0,'INVALID_MONEY_EVIDENCE');return n;};
function scope(plan){
 cached??=JSON.parse(fs.readFileSync('config/ag-rolling-explicit-request-reviews.json','utf8'));
 const {explicitProbeContract,explicitProbeContractHash,...base}=plan;
 if(explicitProbeContract!==undefined||explicitProbeContractHash!==undefined){
  assert(explicitProbeContract==='nextgen-explicit-request-evidence-v1'&&explicitProbeContractHash===queueHash(cached),'EXPLICIT_REVIEW_PLAN_BINDING');plan=base;
 }
 const id=String(plan.gameId),binding=cached.sourceBindings?.[id];
 assert(['32474','32497'].includes(id)&&binding&&binding.planHash===queueHash(plan)
  &&plan.adapter==='native-nextgen-v1'&&plan.rollingPlan==='sg-ag-rolling-plan-v1'
  &&cached.diagnosticEvidenceOnly===true&&cached.automaticAdmission===false
  &&cached.sourceRequests===0&&cached.mongoWrites===0&&cached.failedRoundsCredited===0
  &&cached.fullSpecialTerminalsObserved===0,'EXPLICIT_REVIEW_PLAN_BINDING');
 return id;
}
export function reviewedPickRequest(plan,ordinal,position=0){
 const id=scope(plan);assert(Number.isSafeInteger(ordinal)&&ordinal>=1&&ordinal<=15,'EXPLICIT_PICK_ORDINAL');
 assert(Number.isSafeInteger(position)&&position>=0&&position<=14,'EXPLICIT_PICK_POSITION');
 if(id==='32497'){
  assert(ordinal===1&&position===0,'EXPLICIT_DRAGON_PICK_SCOPE');
  return {MSGID:'FEATURE_PICK',CFG:'0',FP:'0|1|1'};
 }
 assert(cached.originalFrontendGridExecuted===true&&cached.carnivalPositionEventCount===15
  &&cached.carnivalFrontendPositionMin===0&&cached.carnivalFrontendPositionMax===14,'EXPLICIT_POSITION_EVIDENCE');
 return {MSGID:'FEATURE_PICK',CFG:'1',FP:`1|${ordinal}|${position}`};
}
export function reviewExplicitPrefix(plan,raw){
 const id=scope(plan),cfg=id==='32474'?'1':'0';
 assert(raw?.fixtureOnly===false&&raw.protocol==='nextgen'&&raw.sourceKey===plan.sourceKey
  &&raw.roundFieldsVersion==='sg-round-fields-v1','EXPLICIT_REVIEW_PROFILE');
 assert(Array.isArray(raw.steps)&&raw.steps.length>=1&&raw.steps.length<=2,'UNREVIEWED_EXPLICIT_RESPONSE');
 const start=amount(raw.startBalanceRaw),stake=amount(plan.betRaw);assert(start>=stake&&stake>0,'INVALID_WAGER_BASIS');
 let player,previousWin=0;const parsed=[];
 for(let i=0;i<raw.steps.length;i++){
  const s=raw.steps[i],msg=i?'FEATURE_START':'BET',q=params(s.requestPayload),pid=q.PID;
  assert(s.methodName==='processGameMessage'&&s.msgId===msg&&!s.sourceRejected,'EXPLICIT_REVIEW_FRAME');
  const request=i?{GN:plan.runtimeSlug,MSGID:msg,CFG:cfg}:{...plan.requestParams,MSGID:msg};
  assert(stable(Object.fromEntries(Object.entries(q).filter(([k])=>k!=='PID')))===stable(request),'EXPLICIT_REVIEW_REQUEST');
  assert(typeof pid==='string'&&pid.startsWith('gdmgcm')&&pid.length>6&&pid.length<512
   &&(player===undefined||player===pid),'SESSION_CHANGED_MID_ROUND');player=pid;
  const p=params(s.responsePayload);assert(p.MSGID===msg&&p.IFG==='0','EXPLICIT_REVIEW_STATE');
  assert(amount(p.NFG??'0')<=100&&p.ABPM===undefined&&!String(p.GSD??'').includes('#lives~'),'UNREVIEWED_EXPLICIT_RESPONSE');
  const held=start-stake,b=amount(p.B),ab=amount(p.AB),win=amount(p.TW);
  assert(b===held+win&&(ab===held||ab===b)&&win>=previousWin,'EXPLICIT_REVIEW_MONEY');previousWin=win;
  assert(amount(s.responseBalance)===ab,'EXPLICIT_REVIEW_OBSERVER');
  assert(typeof s.responseXml==='string'&&s.responseXml.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(s.responseXml),'INVALID_TRIAL_XML');
  const xml=parseXml(s.responseXml);assert(xml.tag.toUpperCase()==='GDMRESPONSE'
   &&one(xml,'SUCCESS').children.map(n=>n.text??'').join('').toLowerCase()==='true'
   &&one(xml,'PAYLOAD').children.map(n=>n.text??'').join('')===s.responsePayload,'TRIAL_XML_EVIDENCE_MISMATCH');
  assert(amount(s.elapsedMs)<=300000,'INVALID_TRIAL_TIMING');parsed.push(p);
 }
 const trigger=parsed[0],fids=id==='32474'?['1|','1|0|']:['0|'];
 assert(trigger.CFG===cfg&&fids.includes(trigger.FID)&&trigger['FS_'+cfg]==='0'
  &&trigger['NFR_'+cfg]==='1'&&trigger['CFP_'+cfg]==='0'&&trigger['FPM_'+cfg]==='|'
  &&!Object.keys(trigger).some(k=>(k.startsWith('FS_')||k.startsWith('NFR_'))&&!['FS_'+cfg,'NFR_'+cfg].includes(k)),
 'EXPLICIT_TRIGGER_REQUIRED');
 const values=String(trigger['FTV_'+cfg]??'').replace(/[|;]+$/,'').split(';').map(amount),maxPicks=values[1];
 assert(maxPicks>=1&&maxPicks<=15&&values[2]===maxPicks&&values.length===maxPicks+3
  &&values.slice(3).every(v=>v>=1&&v<=5)&&(id==='32474'||maxPicks===1),'EXPLICIT_PICK_COUNT');
 let candidate={MSGID:'FEATURE_START',CFG:cfg},options=[];
 if(raw.steps.length===2){
  assert(id==='32474','UNREVIEWED_EXPLICIT_RESPONSE');
  const p=parsed[1];assert(amount(p.NFG)>0&&p.FID===undefined&&p.CFG===undefined
   &&!Object.keys(p).some(k=>k.startsWith('FS_')||k.startsWith('NFR_')),'UNREVIEWED_EXPLICIT_RESPONSE');
  candidate=reviewedPickRequest(plan,1,0);
  options=Array.from({length:15},(_,position)=>({pickIndex:position+1,position}));
 }
 return {schema:'sg-explicit-prefix-review-v1',gameId:plan.gameId,frames:raw.steps.length,
  diagnosticOnly:true,sourceAllowance:0,settlementApproved:false,candidateRequest:candidate,maxPicks,options};
}
