import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fixture as pickFixture} from './pick-bonus-recovery.test.mjs';
import {finishShort} from './session-test-fixture.mjs';
import {PickClaimRecovery,PICK_CLAIM as K} from './pick-claim-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
test('unconsumed claim rebind is pinned independently of already applied Pick A Ball profile',()=>{
 const p=JSON.parse(fs.readFileSync('config/pick-claim-20260929.json','utf8'));
 const files=Object.fromEntries(Object.keys(p.adapterFiles).map(f=>[f,createHash('sha256').update(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
 assert.equal(hash(p),'c48f3d7068be70b954b684e709e8129151b60709e7a57777c1680765056cfbed');assert.notEqual(hash(files),p.adapterHash);
});
async function fixture(){
 const f=await pickFixture(),base=await f.operator.recover(),batchKey=`batch:${f.plan.trialId}:11`,b=structuredClone(f.get(batchKey));
 await finishShort(f);for(let seq=b.journaled+1;seq<=b.journaled+10;seq++){
  const key='journal/'+receiptKey(f.plan.trialId,seq),r=f.docs.get(key).value;f.rounds.delete(r._id);f.docs.delete(key);
 }
 f.docs.get('state/'+batchKey).value=b;b.protocolResume.proofHash=K.proof;
 const p=f.get('pool:'+f.plan.trialId),c=f.get('campaign');p.protocolRecovery=K.proof;c.protocolValidation={phase:'short',gameId:32836,proofHash:K.proof,commit:K.commit,runKey:K.runKey};
 const prior=f.docs.get('journal/pick-bonus:pick-bonus-36502517559:reconciled').value;prior.proofHash=K.proof;
 const grant=structuredClone(f.docs.get('journal/protocol-resume:'+base.proofHash).value);grant.proofHash=K.proof;grant.commit=K.commit;
 const raw={sourceKey:'quarterbackfieldsofglory96-round-one-base-v1',protocol:'nextgen',steps:[{msgId:'BET',requestPayload:'GN=quarterbackfieldsofglory96&BPR=1&RB=5&MSGID=BET&PID=gdmgcmfixture',responsePayload:'MSGID=BET&FID=1|&CFG=1&FS_1=0&NFR_1=1&CFR_1=0&CFP_1=0&FPM_1=|&IFG=0&B=99975&AB=99975&TW=0'}]};b.pending.raw=raw;
 b.protocolResume.pendingHash=hash(b.pending);grant.batches[0].pendingHash=hash(b.pending);
 f.docs.set('journal/protocol-resume:'+K.proof,{value:grant,version:1});
 const bs=[...f.docs].filter(([k])=>k.startsWith('state/batch:')).map(([,v])=>v).sort((a,b)=>a.value.id-b.value.id);
 f.profile={schema:'sg-pick-claim-rebind-v1',id:K.id,group:'secondary',gameId:32836,createdAt:f.now,complete:380,checkpoint:380,pending:1,planHash:hash(f.plan),campaignHash:hash(c),poolHash:hash(p),pendingHash:hash(b.pending),previousGrantHash:hash(grant),batches:bs.map(x=>({id:x.value.id,hash:hash(x.value)}))};
 const old=f.operator;f.operator=new PickClaimRecovery({store:f.store,transport:old.transport,gate:old.gate,parser:old.parser,plan:f.plan,profile:f.profile,githubIdle:old.githubIdle,owner:'claim',commit:'e'.repeat(40),now:()=>f.now,sleep:async()=>{}});
 return f;
}
test('preserves all380 and untouched1008, issues a new code-bound grant without source or clearing holds',async()=>{
 const f=await fixture(),q=structuredClone(f.get(`batch:${f.plan.trialId}:11`).pending),grant=structuredClone(f.docs.get('journal/protocol-resume:'+K.proof));
 const r=await f.operator.recover();assert.equal(r.count,380);assert.equal(r.committed,380);assert.equal(r.sourceRequests,0);
 assert.deepEqual(f.get(`batch:${f.plan.trialId}:11`).pending,q);assert.deepEqual(f.docs.get('journal/protocol-resume:'+K.proof),grant);
 assert.notEqual(r.proofHash,K.proof);await assert.rejects(f.operator.recover());
});
test('consumed permit, changed pending, active lease, changed previous run or hold prevent rebind',async()=>{
 for(const mode of ['consumed','pending','lease','run','hold']){
  const f=await fixture(),b=f.get(`batch:${f.plan.trialId}:11`);
  if(mode==='consumed')b.protocolResume=null;
  if(mode==='pending')b.pending.raw.steps.push({msgId:'FEATURE_START'});
  if(mode==='lease')b.leaseUntil=f.now+1;
  if(mode==='run')f.get('campaign').protocolValidation.runKey='capture-run:2:2';
  if(mode==='hold')f.holds[1].value.active=true;
  await assert.rejects(f.operator.recover());assert.equal(f.get('pool:'+f.plan.trialId).protocolRecovery,K.proof);
 }
});
test('new580 full short requires actual original1008 bonus3 and20 workers, then permits formal',async()=>{
 const f=await fixture();await f.operator.recover();await finishShort(f);f.get('campaign').protocolValidation.commit=f.operator.commit;
 const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,1008)).value;r.bonus=3;f.rounds.set(r._id,structuredClone(r));
 const v=await f.operator.validate();assert.equal(v.fullReadback,580);assert.equal(v.originalPendingSettled,1);assert(v.livePickABallSettlementVerified);
 assert.equal((await f.operator.formal()).validationLimit,0);
});
