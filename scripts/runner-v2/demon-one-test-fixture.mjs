// All gameplay here is synthetic. Ancestor metadata contains only public
// counters, hashes, timestamps and run identifiers; it grants no permission.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fixture as base,finish as finishPrevious} from './demon-queue-test-fixture.mjs';
import {DemonOneRecovery,DEMON_ONE as K} from './demon-one-recovery.mjs';
import {ANCESTOR} from './demon-one-ancestor.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
export async function fixture(){
 const f=await base();f.operator.prefix=K.oldPrefix;const result=await f.operator.recover(),old=f.operator;
 const put=(k,v)=>f.docs.set('journal/'+k,{_id:'primary/'+k,version:1,value:structuredClone(v)});
 const metadata=JSON.parse(fs.readFileSync('scripts/runner-v2/demon-one-history-fixture.json','utf8'));
 for(const [k,v] of Object.entries(metadata))put(k,v);
 f.docs.get('journal/'+K.oldPrefix+':proof').value.profile=JSON.parse(fs.readFileSync('config/demon-queue-20260929.json','utf8'));
 for(const suffix of ['abandoned:2','backup-complete','reconciled'])f.docs.get('journal/'+K.oldPrefix+':'+suffix).value.proofHash=K.previousProof;
 const stage=structuredClone(f.docs.get('journal/pending-first:'+result.proofHash).value);stage.proofHash=K.previousProof;stage.commit=K.previousCommit;put('pending-first:'+K.previousProof,stage);
 const pool=f.get('pool:'+f.plan.trialId),c=f.get('campaign');pool.protocolRecovery=K.previousProof;
 Object.assign(c.protocolValidation,{proofHash:K.previousProof,commit:K.previousCommit,runKey:K.runKey,pendingFirst:hash(stage)});
 for(const {value:b} of f.snapshot().batches){b.protocolRecovery=K.previousProof;if(b.protocolResume)b.protocolResume.proofHash=K.previousProof;if(b.id===2)b.abandonedAttemptProof=K.previousProof;}
 const b=f.get('batch:'+f.plan.trialId+':10');b.protocolResume=null;
 b.pending.raw.steps.push({msgId:'FREE_GAME',sourceRejected:true,requestPayload:b.pending.raw.steps[0].requestPayload.replace('MSGID=BET','MSGID=FREE_GAME'),responsePayload:'&MSGID=ERROR&EID=ERROR_INVALID_SESSION&',responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>&amp;MSGID=ERROR&amp;EID=ERROR_INVALID_SESSION&amp;</PAYLOAD></GDMRESPONSE>'});
 f.holds[0].value={active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{code:'SOURCE_REJECTED',batchId:10,trialId:f.plan.trialId,cooldownUntil:0}};
 f.docs.get('state/global-hold').value=structuredClone(f.holds[0].value);
 f.now=Date.parse('2026-09-29T10:45:00Z');
 const records=f.snapshot().batches.flatMap(({value:b})=>Array.from({length:b.journaled-b.start+1},(_,i)=>f.docs.get('journal/'+receiptKey(f.plan.trialId,b.start+i)).value));
 f.profile={schema:'sg-demon-one-v1',id:K.id,group:'primary',gameId:32739,complete:246,checkpoint:246,pending:2,createdAt:f.now,planHash:hash(f.plan),campaignHash:hash(c),poolHash:hash(pool),priorHash:hash(f.docs.get('journal/'+K.oldPrefix+':before').value),primaryHoldHash:hash(f.holds[0].value),secondaryHoldHash:hash(f.holds[1].value),recordsHash:hash(records),previousStageHash:hash(stage),ancestorReceiptHash:hash(metadata[ANCESTOR.receipt]),ancestorCompleteHash:hash(metadata[ANCESTOR.receipt+':complete']),
 archives:Object.fromEntries([[806,9,'demon-pending-session:demon-pending-session-36518623937'],[434,5,'demon-three:demon-three-36522161320'],[117,2,K.oldPrefix]].map(([seq,bid,pre])=>[seq,{archiveHash:hash(f.docs.get('journal/'+pre+':abandoned:'+bid).value),reconciledHash:hash(f.docs.get('journal/'+pre+':reconciled').value)}])),batches:f.snapshot().batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null}))};
 let blocked=false,lease=false;
 f.operator=new DemonOneRecovery({...old,profile:f.profile,run:'777777:1',commit:'c'.repeat(40),now:()=>f.now,githubIdle:async()=>assert(!blocked,'OLD_JOB_EXISTS'),checkLeases:async()=>assert(!lease,'LEASE_ACTIVE')});
 f.events.length=0;return {...f,block:()=>{blocked=true;},occupy:()=>{lease=true;}};
}
export async function finish(f,options){
 await finishPrevious(f,options);
 const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,902)).value;r.raw.steps[0].ts=new Date(f.now+1000).toISOString();f.rounds.set(r._id,structuredClone(r));
}
