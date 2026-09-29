// Entirely synthetic control fixture; ancestry/semantic analyzer are test doubles.
// Real historical binding and267 semantic checks live in the private review suite.
import {fixture as base} from './demon-nested-test-fixture.mjs';
import {DemonPairRecovery} from './demon-pair-recovery.mjs';
import {INCIDENT as I} from './demon-pair-review.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
export async function fixture(){
 const f=base();await f.operator.recover();const old=f.operator,p=f.docs.get('state/pool:'+f.plan.trialId).value,c=f.docs.get('state/campaign').value;
 c.games[0].status='active';c.protocolValidation={phase:'short',gameId:32739,proofHash:I.proof,commit:I.commit,runKey:I.failedRun,nestedShort:I.spec};p.protocolRecovery=I.proof;
 for(const {value:b} of (await old.snapshots()).batches){const v=f.docs.get('state/batch:'+f.plan.trialId+':'+b.id).value;v.protocolRecovery=I.proof;v.protocolResume=null;
 }
 const prior=await old.snapshots();
 for(const e of I.rejected){const b=f.docs.get('state/batch:'+f.plan.trialId+':'+e.batch).value;b.pending.raw.steps.push({msgId:'FREE_GAME',requestPayload:b.pending.raw.steps[0].requestPayload.replace('MSGID=BET','MSGID=FREE_GAME'),sourceRejected:true,responsePayload:'&MSGID=ERROR&EID=ERROR_INVALID_SESSION&',responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>&amp;MSGID=ERROR&amp;EID=ERROR_INVALID_SESSION&amp;</PAYLOAD></GDMRESPONSE>'});}
 f.put('state','global-hold',{active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{code:'SOURCE_REJECTED',batchId:5,trialId:f.plan.trialId}});
 const primary=()=>f.get('state','global-hold'),secondary={_id:'secondary/global-hold',value:{active:false}};
 const transport={request:(op,r)=>op==='global_holds'?Promise.resolve([primary(),secondary]):old.transport.request(op,r)};
 const s=await old.snapshots(),full=await old.verifyRecords(s,{allCommitted:true});
 const profile={...f.profile,schema:'sg-demon-pair-review-v1',id:I.id,complete:267,checkpoint:267,pending:2,createdAt:Date.parse('2026-09-29T15:00:00Z'),snapshotHash:hash(s),recordsHash:full.recordsHash,primaryHoldHash:hash(primary().value),secondaryHoldHash:hash(secondary.value)};
 f.profile=profile;f.operator=new DemonPairRecovery({...old,profile,transport,commit:'a'.repeat(40),run:'999996:1',now:()=>profile.createdAt+1000});
 f.operator.ancestor=async()=>({before:structuredClone(prior)});f.writes.length=0;return f;
}
export async function finish(f){
 const c=f.docs.get('state/campaign').value;c.protocolValidation.runKey='capture-run:999997:1';
 const spec=f.get('journal','fresh-start:'+c.protocolValidation.proofHash).value,p=f.docs.get('state/pool:'+f.plan.trialId).value;
 for(let worker=0;worker<20;worker++){
 let b=[...f.docs].find(([k,x])=>k.startsWith('state/batch:')&&x.value.worker===worker)?.[1].value;
 if(!b){b={id:p.nextBatchId++,worker,start:p.nextSequence,end:p.nextSequence+99,journaled:p.nextSequence-1,checkpoint:p.nextSequence-1,epoch:1,sessionHash:p.workers[worker].sessionHash};p.nextSequence+=100;f.put('state','batch:'+f.plan.trialId+':'+b.id,b);b=f.docs.get('state/batch:'+f.plan.trialId+':'+b.id).value;}
 for(let n=0;n<spec.remaining[worker];n++){const r=f.makeRecord(b,++b.journaled);r.raw.steps[0].ts=new Date(f.profile.createdAt+2000).toISOString();f.put('journal',receiptKey(f.plan.trialId,r.sequence),r);f.rounds.set(r._id,structuredClone(r));b.checkpoint=b.journaled;}
 Object.assign(b,{pending:null,protocolResume:null,pendingOriginal:null,failure:null,owner:null,leaseUntil:0});Object.assign(p.workers[worker],{owner:null,leaseUntil:0,activeBatch:null});
 }
}
