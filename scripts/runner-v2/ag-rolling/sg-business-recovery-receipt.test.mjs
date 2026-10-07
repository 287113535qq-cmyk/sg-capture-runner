import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {isRecoveryReceiptReference,inspectRecoveryReceiptEvidence,readReviewedRecoveryReceipt,recoveryNativeHash,recoveryProposalHash} from './sg-business-recovery-receipt.mjs';
import {inspectExistingWorkflowPolicy} from './sg-ag-existing-workflow.mjs';
const h=v=>createHash('sha256').update(stable(v)).digest('hex');
function fixture(){
 const native=JSON.parse(fs.readFileSync(new URL('./fixtures/recovery-32547-native.json',import.meta.url)));
 const oldRoot='game:32547:'+recoveryNativeHash,root=oldRoot+':recovery:'+recoveryProposalHash;
 const oldOwner='independent-current-32547-1-2',owner='independent-recovery-32547-3-4';
 const docs=new Map(),oldHashes=[],newHashes=[];
 const old=(key)=>{const d={_id:key,owner:oldOwner,immutable:true};docs.set(key,d);oldHashes.push([key,h(d)]);};
 old(oldRoot);old(oldRoot+':validated');old(oldRoot+':backup:100');
 for(let i=0;i<100;i++){const id=i.toString(16).padStart(24,'0');old(oldRoot+':rtp-intent:'+id);old(oldRoot+':rtp-complete:'+id);}
 for(let w=0;w<=11;w++)for(let end=100;end<=(w===11?100:15000);end+=100){
  old(oldRoot+':intent:'+w+':'+end);if(w<11)old(oldRoot+':ack:'+w+':'+end);
 }
 const add=(key,value={})=>{const d={_id:key,schema:'sg-current-recovery-audit-v1',owner,immutable:true,
  oldOwner,oldClaimKey:oldRoot,oldRootHash:h(docs.get(oldRoot)),proposalHash:recoveryProposalHash,value};docs.set(key,d);newHashes.push([key,h(d)]);};
 add(oldRoot+':recovery-claim');add(root+':validated');add(root+':resolution:11:100');
 for(let w=11;w<20;w++)for(let end=w===11?200:100;end<=15000;end+=100){add(root+':intent:'+w+':'+end);add(root+':ack:'+w+':'+end);}
 const done={schema:'sg-ag-final-business-recovery-complete-v1',gameId:'32547',database:'sg_fixture',queueId:native.queueId,
  recoveryOwner:owner,oldOwner,sourceProofHash:recoveryNativeHash,sourceRecordsHash:native.recordsHash,
  recoveryClaimKey:oldRoot+':recovery-claim',recoveryRootKey:root,proposalHash:recoveryProposalHash,oldRootHash:h(docs.get(oldRoot)),
  oldResultFileSha256:'a23acb908bf7d5a492e4a981b03442596e8f09fdf675d92f63a7c5f44b8300d2',
  reviewEvidenceHash:'49a7aff0287676646807f7790a85e4fb5eb6d1b49d3eb997ec622bff2825223e',
  campaignCount:300000,businessCount:300100,originalCount:100,newInserted:134900,retainedTargetCount:165100,sourcePasses:3,
  fullReadback:true,independentlyVerified:true,originalUnchanged:true,targetReadbackFull:true,oldOutcomeUnknownRetained:true,sourceRequests:0,nativeWrites:0,
  oldAuditHash:h(oldHashes.sort((a,b)=>a[0].localeCompare(b[0]))),newAuditHash:h(newHashes.sort((a,b)=>a[0].localeCompare(b[0])))};
 add(root+':complete',{done});
 const evidence={schema:'sg-ag-recovery-receipt-evidence-v1',gameId:'32547',kind:'recovery-chained',complete:true,
  oldOutcomeUnknownRetained:true,mayReplayOldIntent:false,independentPostExitVerified:true,
  independentPostExitFileSha256:'a'.repeat(64),supervisedOutcomeFileSha256:'b'.repeat(64),
  auditCompleteKey:root+':complete',auditDocumentHash:h(docs.get(root+':complete')),nativeReceiptHash:recoveryNativeHash,
  receipt:done,oldAuditHashes:oldHashes,newAuditHashes:newHashes};
 let reads=0,guards=0;
 const options={binding:{gameId:32547,database:'sg_fixture',queueId:native.queueId,trialId:native.trialId},game:{gameId:'32547',campaignId:native.campaignId},native,
  readExact:async keys=>{reads++;assert(keys.length<=100);return keys.map(k=>structuredClone(docs.get(k)??null));},guard:async()=>{guards++;}};
 const bind=()=>{options.bytes=Buffer.from(JSON.stringify(evidence));const sha=createHash('sha256').update(options.bytes).digest('hex');
  options.proof={kind:'recovery-chained',nativeReceiptHash:recoveryNativeHash,auditCompleteKey:evidence.auditCompleteKey,
   auditDocumentHash:evidence.auditDocumentHash,evidenceSha256:sha,evidenceFile:`config/ag-business-recovery-${sha}.json`};};bind();
 return {options,evidence,docs,oldRoot,root,bind,stats:()=>({reads,guards})};
}
test('all old and new immutable documents are read, while the old unknown stays incomplete',async()=>{
 const f=fixture();const before=h([...f.docs]);const got=await readReviewedRecoveryReceipt(f.options);
 assert.equal(got.kind,'recovery-chained');assert(got.complete);assert.equal(got.mayReplayOldIntent,false);
 assert.equal(f.evidence.oldAuditHashes.length,3504);assert.equal(f.evidence.newAuditHashes.length,2702);
 assert.equal(f.stats().reads,66);assert.equal(f.stats().guards,132);assert.equal(h([...f.docs]),before);
 assert.equal(f.docs.has(f.oldRoot+':complete'),false);
});
test('policy accepts only exact32547 recovery references and keeps ordinary receipt shape',()=>{
 const f=fixture(),p=f.options.proof;assert(isRecoveryReceiptReference('32547',p));
 for(const changed of [{...p,kind:'ordinary'},{...p,evidenceFile:'../file'},{...p,nativeReceiptHash:'a'.repeat(64)},{...p,auditCompleteKey:f.oldRoot+':complete'}])assert(!isRecoveryReceiptReference('32547',changed));
 assert(!isRecoveryReceiptReference('32595',p));
 const policy={schema:'sg-ag-existing-workflow-control-v1',evidenceMode:'existing-immutable-audit',linuxEvidenceFile:'config/ag-full-control-linux-'+ 'a'.repeat(64)+'.json',linuxEvidenceSha256:'b'.repeat(64),completedBusinessReceipts:{'32547':p}};
 assert.equal(inspectExistingWorkflowPolicy({fullAgControl:policy}),policy);
});
test('unsigned bytes, partial source, partial chain and missing independent exit evidence are rejected before reads',()=>{
 for(const mutate of [f=>{f.options.bytes=Buffer.from('{}');},f=>{f.options.native.count--;},f=>{f.evidence.oldAuditHashes.pop();f.bind();},
  f=>{f.evidence.newAuditHashes.pop();f.bind();},f=>{f.evidence.independentPostExitVerified=false;f.bind();},f=>{f.evidence.receipt.newInserted--;f.bind();}]){
  const f=fixture();mutate(f);assert.throws(()=>inspectRecoveryReceiptEvidence(f.options),/SG_AG_RECOVERY_/);assert.equal(f.stats().reads,0);
 }
});
test('missing, changed and foreign audit documents cannot be accepted',async()=>{
 for(const mutate of [f=>f.docs.delete(f.evidence.oldAuditHashes[8][0]),f=>{f.docs.get(f.evidence.newAuditHashes[8][0]).owner='foreign';},f=>{f.docs.set(f.oldRoot+':complete',{_id:f.oldRoot+':complete'});}]){
  const f=fixture();mutate(f);await assert.rejects(readReviewedRecoveryReceipt(f.options),/SG_AG_RECOVERY_/);
 }
});
test('reader rejects reordered responses and drains no writes when its guard stops',async()=>{
 const f=fixture(),read=f.options.readExact;f.options.readExact=async keys=>(await read(keys)).reverse();
 await assert.rejects(readReviewedRecoveryReceipt(f.options),/EXACT_READ/);
 const g=fixture();g.options.guard=async()=>{throw Error('deadline');};await assert.rejects(readReviewedRecoveryReceipt(g.options),/deadline/);assert.equal(g.stats().reads,0);
});
test('completion changed after chain traversal cannot settle the game',async()=>{
 const f=fixture(),read=f.options.readExact;
 f.options.readExact=async keys=>{if(keys.length===2&&keys[0]===f.root+':complete')f.docs.get(keys[0]).value.done.fullReadback=false;return read(keys);};
 await assert.rejects(readReviewedRecoveryReceipt(f.options),/FINAL_RACE/);
});
