import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fixture as baseFixture} from './demon-three-recovery.test.mjs';
import {finishShort} from './session-test-fixture.mjs';
import {DemonTwoRecovery,DEMON_TWO as K} from './demon-two-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
const out=spawnSync(process.env.PYTHON||'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_demon_fields import sample;print(json.dumps(sample()))"],{encoding:'utf8'});
assert.equal(out.status,0,out.stderr);const special=JSON.parse(out.stdout);
export async function fixture(){
  const f=await baseFixture();const result=await f.operator.recover();
  const oldOp=f.operator,get=f.get,put=(c,k,v)=>f.docs.set(c+'/'+k,{_id:'primary/'+k,version:1,value:structuredClone(v)});
  const prefix=K.oldPrefix,prior=structuredClone(f.docs.get('journal/'+prefix+':before').value);
  put('journal',prefix+':proof',{proofHash:K.previousProof});
  const archive=f.docs.get('journal/'+prefix+':abandoned:5').value;archive.proofHash=K.previousProof;
  const reconciled=f.docs.get('journal/'+prefix+':reconciled').value;reconciled.proofHash=K.previousProof;
  const stage=structuredClone(f.docs.get('journal/pending-first:'+result.proofHash).value);
  stage.proofHash=K.previousProof;stage.commit=K.previousCommit;
  put('journal','pending-first:'+K.previousProof,stage);
  const p=get('pool:'+f.plan.trialId),c=get('campaign');p.protocolRecovery=K.previousProof;
  Object.assign(c.protocolValidation,{proofHash:K.previousProof,commit:K.previousCommit,runKey:K.runKey,pendingFirst:hash(stage)});
  for(const {value:b} of f.snapshot().batches){
    b.protocolRecovery=K.previousProof;if(b.protocolResume)b.protocolResume.proofHash=K.previousProof;
    if(b.id===5)b.abandonedAttemptProof=K.previousProof;
  }
  const b=get(`batch:${f.plan.trialId}:2`);b.protocolResume=null;
  b.pending.raw.steps.push({msgId:'FREE_GAME',sourceRejected:true,requestPayload:b.pending.raw.steps[0].requestPayload.replace('MSGID=BET','MSGID=FREE_GAME'),
    responsePayload:'&MSGID=ERROR&EID=ERROR_INVALID_SESSION&',responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>&amp;MSGID=ERROR&amp;EID=ERROR_INVALID_SESSION&amp;</PAYLOAD></GDMRESPONSE>'});
  f.holds[0].value={active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{code:'SOURCE_REJECTED',batchId:2,trialId:f.plan.trialId,cooldownUntil:0}};put('state','global-hold',f.holds[0].value);
  const records=f.snapshot().batches.flatMap(({value:b})=>Array.from({length:b.journaled-b.start+1},(_,i)=>f.docs.get('journal/'+receiptKey(f.plan.trialId,b.start+i)).value));
  const profile={schema:'sg-demon-two-v1',id:K.id,group:'primary',gameId:32739,complete:246,checkpoint:246,pending:3,createdAt:f.now,
    planHash:hash(f.plan),campaignHash:hash(c),poolHash:hash(p),priorHash:hash(prior),primaryHoldHash:hash(f.holds[0].value),secondaryHoldHash:hash(f.holds[1].value),
    recordsHash:hash(records),archives:Object.fromEntries([[806,9,'demon-pending-session:demon-pending-session-36518623937'],[434,5,prefix]].map(([seq,bid,pre])=>[seq,{archiveHash:hash(f.docs.get('journal/'+pre+':abandoned:'+bid).value),reconciledHash:hash(f.docs.get('journal/'+pre+':reconciled').value)}])),previousStageHash:hash(stage),
    batches:f.snapshot().batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null}))};
  const request=oldOp.transport.request.bind(oldOp.transport);
  oldOp.transport.request=async(type,r)=>{
    if((type==='cas' && (r.key.startsWith('batch:') || r.key==='global-hold')) || type==='rounds_insert')assert(f.docs.has('journal/demon-queue:demon-two-36525403196:backup-complete'));
    return request(type,r);
  };
  f.operator=new DemonTwoRecovery({...oldOp,profile,commit:'b'.repeat(40)});f.profile=profile;f.events.length=0;return f;
}
export async function finish(f,{feature=true}={}){
  const before=structuredClone(f.snapshot());f.get('campaign').protocolValidation.runKey='capture-run:333:1';
  delete f.get('pool:'+f.plan.trialId).workers[18];await finishShort(f);
  for(const {value:b} of before.batches){if(!b.pending)continue;
    const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,b.pending.sequence)).value;
    r.raw=structuredClone(special);r.bonus=2;
    if(!feature){r.raw.steps=[...structuredClone(b.pending.raw.steps),structuredClone(special.steps.at(-1))];
      const last=r.raw.steps.at(-1);last.responsePayload=last.responsePayload.replace('FID=1|0|','FID=0|');last.responseXml=last.responseXml.replace('FID=1|0|','FID=0|');r.bonus=1;}
    f.rounds.set(r._id,structuredClone(r));
  }
  for(const sequence of [117,434,806]){const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,sequence)).value;r.raw.steps[0].ts=new Date(f.now+1000).toISOString();f.rounds.set(r._id,structuredClone(r));}
}
