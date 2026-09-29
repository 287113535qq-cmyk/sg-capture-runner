import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {protocolHash as hash} from './protocol-resume.mjs';
import {nextRequest} from '../trial/squid-protocol.mjs';
import {ZERO_PROOF,ZERO_SPEC_HASH} from './demon-nested-short.mjs';
const {XMLParser}=createRequire(import.meta.url)('../../collector/node_modules/fast-xml-parser');
const xml=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false});
export const INCIDENT={id:'demon-pair-36577344185',prefix:'demon-pair:demon-pair-36577344185',stage:'demon-pair-stage:36577344185',
 previousPrefix:'demon-nested-rebind:demon-nested-rebind-36574646755',previousStage:'demon-nested-rebind-stage:36574646755',
 proof:'bd59c9591a5e00da90e0ee9909eb9a44bb280295563138f2e1403ec3f12850c9',
 profile:'620b0e95839a85dba3ee6a9827d2275089040c89b9980259f637dcbd7749ba52',
 commit:'dc0f7288a22d88ba30f736a1fe2f64cf5de0aa99',run:'36576758603:1',failedRun:'capture-run:36577344185:1',
 spec:'be45f6914b5bc9db33e2181d14a789d1533974c6ae8bff1c108c6a84a8baa4c9',
 rejected:[{batch:3,worker:14,sequence:218,frames:8},{batch:5,worker:0,sequence:440,frames:1}]};
function parameters(raw){const a=[...new URLSearchParams(raw)];assert(a.length===new Set(a.map(x=>x[0])).size,'DUPLICATE_REQUEST_PARAMETER');return Object.fromEntries(a);}
export function reviewRejectedPending({batch,original,expected}){
 const p=batch.pending,q=original.pending;
 assert(batch.id===expected.batch&&batch.worker===expected.worker&&p?.sequence===expected.sequence&&q?.sequence===expected.sequence,'REJECTED_SCOPE_CHANGED');
 assert(['id','worker','start','end','sessionHash','journaled'].every(k=>batch[k]===original[k])&&p.attempt===q.attempt&&p.raw.startBalanceRaw===q.raw.startBalanceRaw,'ORIGINAL_IDENTITY_CHANGED');
 assert(p.awaiting===null&&q.awaiting===null&&!batch.bootstrapAwaiting&&!batch.pendingOriginal&&!batch.protocolResume,'UNKNOWN_OR_UNCONSUMED_PENDING');
 assert(q.raw.steps.length===expected.frames&&p.raw.steps.length===expected.frames+1&&hash(p.raw.steps.slice(0,-1))===hash(q.raw.steps),'ORIGINAL_PREFIX_CHANGED');
 assert(q.raw.steps.every(x=>!x.sourceRejected)&&hash(nextRequest(q.raw))===hash({MSGID:'FREE_GAME'}),'ORIGINAL_NOT_CONTINUABLE');
 const tail=p.raw.steps.at(-1),bet=parameters(q.raw.steps[0].requestPayload),free=parameters(tail.requestPayload);
 assert(bet.MSGID==='BET'&&tail.msgId==='FREE_GAME'&&hash(free)===hash({...bet,MSGID:'FREE_GAME'}),'CONTINUATION_PARAMETERS_CHANGED');
 assert(tail.sourceRejected===true&&tail.responsePayload==='&MSGID=ERROR&EID=ERROR_INVALID_SESSION&','EXPLICIT_REJECTION_REQUIRED');
 assert(typeof tail.responseXml==='string'&&tail.responseXml.length<=262144&&!/<!DOCTYPE|<!ENTITY/i.test(tail.responseXml),'REJECTION_XML_INVALID');
 const r=xml.parse(tail.responseXml).GDMRESPONSE;
 assert(r&&String(r.SUCCESS).toLowerCase()==='true'&&r.PAYLOAD===tail.responsePayload,'REJECTION_XML_MISMATCH');
 return {batch:batch.id,worker:batch.worker,sequence:p.sequence,pendingHash:hash(p),rawHash:hash(p.raw),disposition:'source-invalid-session/abandon_without_replay'};
}
export function residualPlan({plan,batches,original,proofHash,commit,createdAt,expiresAt}){
 assert(hash(original)===ZERO_SPEC_HASH&&original.proofHash===ZERO_PROOF&&original.planHash===hash(plan),'ORIGINAL_QUOTA_CHANGED');
 assert(plan.gameId===32739&&plan.phase===1&&plan.buy===0&&batches.length===19,'RESIDUAL_SCOPE_CHANGED');
 assert(/^[a-f0-9]{64}$/.test(proofHash)&&/^[a-f0-9]{40}$/.test(commit)&&commit!==INCIDENT.commit&&expiresAt>createdAt&&expiresAt-createdAt<=7200000,'NEW_PERMISSION_REQUIRED');
 const counts=Object.fromEntries(Array.from({length:20},(_,w)=>[w,0]));
 for(const {value:b} of batches){assert(!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&!b.protocolResume&&b.checkpoint===b.journaled&&Number.isInteger(b.worker)&&b.worker>=0&&b.worker<20,'ZERO_ORIGINAL_PENDING_REQUIRED');counts[b.worker]+=b.journaled-b.start+1;}
 const baseline=structuredClone(original.baseline),remaining=Object.fromEntries(Object.keys(counts).map(w=>[w,10-(counts[w]-baseline[w])]));
 assert(Object.values(counts).reduce((a,b)=>a+b,0)===267&&Object.values(baseline).reduce((a,b)=>a+b,0)===246&&Object.values(remaining).every(n=>Number.isSafeInteger(n)&&n>=0&&n<=10)&&remaining[0]===4&&remaining[13]===0&&remaining[14]===5&&Object.values(remaining).reduce((a,b)=>a+b,0)===179,'RESIDUAL_QUOTA_CHANGED');
 return {schema:'sg-demon-pair-residual-v1',gameId:32739,trialId:plan.trialId,planHash:hash(plan),proofHash,commit,createdAt,expiresAt,recoveryPrefix:INCIDENT.prefix,stageKey:INCIDENT.stage,originalPending:0,perWorker:10,originalComplete:246,currentComplete:267,finalComplete:446,totalRemaining:179,baseline,initialCounts:counts,remaining,originalSpecHash:ZERO_SPEC_HASH};
}
// Pure review only. No source, storage mutation, receipt creation or deployment.
export function reviewPair({plan,profile,s,prior,original,now}){
 assert(profile.schema==='sg-demon-pair-review-v1'&&profile.id===INCIDENT.id&&profile.complete===267&&profile.checkpoint===267&&profile.pending===2,'WRONG_PAIR_INCIDENT');
 assert(now>=profile.createdAt&&now-profile.createdAt<7200000&&hash(s)===profile.snapshotHash&&hash(plan)===profile.planHash,'PAIR_STALE_OR_CHANGED');
 const c=s.campaign.value,p=s.pool.value;
 assert(c.enabled&&!c.reason&&!c.audit&&c.activeGame===32739&&c.validationLimit===10&&c.games.find(g=>g.game_id===32739)?.status==='active'&&c.protocolValidation?.proofHash===INCIDENT.proof&&c.protocolValidation.commit===INCIDENT.commit&&c.protocolValidation.runKey===INCIDENT.failedRun&&c.protocolValidation.nestedShort===INCIDENT.spec,'PAIR_CAMPAIGN_CHANGED');
 assert(p.enabled&&!p.failure&&p.protocolRecovery===INCIDENT.proof&&p.planHash===hash(plan)&&p.nextBatchId===20&&Object.keys(p.workers).length===20&&Object.values(p.workers).every(w=>w.leaseUntil<=now),'PAIR_POOL_CHANGED');
 assert(s.batches.length===19&&prior.batches.length===19,'PAIR_COVERAGE_CHANGED');
 let end=0;const reviews=[];
 for(const [i,{value:b}] of s.batches.entries()){
  assert(b.id===i+1&&b.start===end+1&&b.end>=b.start&&b.end-b.start<100&&b.start-1<=b.checkpoint&&b.checkpoint===b.journaled&&b.journaled<b.end&&b.leaseUntil<=now&&!b.failure&&!b.bootstrapAwaiting&&!b.pendingOriginal,'PAIR_BATCH_CHANGED');end=b.end;
  assert(p.workers[b.worker]?.sessionHash===b.sessionHash,'PAIR_SESSION_CHANGED');
  const expected=INCIDENT.rejected.find(x=>x.batch===b.id),old=prior.batches.find(x=>x.value.id===b.id)?.value;
  assert(old&&['id','worker','start','end','sessionHash','journaled','checkpoint'].every(k=>b[k]===old[k]),'PAIR_ORIGINAL_CHANGED');
  if(expected)reviews.push(reviewRejectedPending({batch:b,original:old,expected}));else assert(!b.pending&&!b.protocolResume,'UNREVIEWED_PENDING');
 }
 assert(end+1===p.nextSequence&&reviews.length===2,'PAIR_COVERAGE_CHANGED');
 const cleared=s.batches.map(x=>({value:{...x.value,pending:null,protocolResume:null}}));
 const quota=residualPlan({plan,batches:cleared,original,proofHash:'f'.repeat(64),commit:'f'.repeat(40),createdAt:now,expiresAt:now+7200000});
 return {count:267,checkpoint:267,rejections:reviews,remaining:quota.remaining,totalRemaining:179,originalBaseline:quota.baseline};
}
