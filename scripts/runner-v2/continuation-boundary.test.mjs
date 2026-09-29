import test from 'node:test';import assert from 'node:assert/strict';
import {continuationHasOtherRun} from './continuation-boundary.mjs';
import {original} from './expired-run-review.mjs';import {stalled,revokedMarker} from './demo-run-fence.mjs';
import {RECEIPT_KEY,NEW_PREFIX} from './supersession-receipt.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
function fixture(){
 const receipt={schema:'sg-queued-supersession-v1',oldRun:original.id,oldCommit:original.commit,
   oldProfileHash:original.profileHash,newPrefix:NEW_PREFIX,newCommit:'a'.repeat(40)};
 const docs=new Map([['state/campaign',{demoRunRevoked:revokedMarker}],
   ['journal/demo-run-revoked:'+stalled.id+':complete',{schema:'sg-demo-run-revoked-complete-v1',marker:revokedMarker}],
   ['journal/'+RECEIPT_KEY,receipt],['journal/'+RECEIPT_KEY+':complete',{receiptHash:hash(receipt),proofHash:'b'.repeat(64),commit:receipt.newCommit}],
   ['journal/'+NEW_PREFIX+':proof',{proofHash:'b'.repeat(64)}]]);
 const runs=[original,stalled].map(x=>({id:x.id,head_sha:x.commit,run_attempt:1,path:'.github/workflows/trial-300k.yml',
   repository:{full_name:original.repository},event:'workflow_dispatch',status:'queued',conclusion:null}));
 let late=false,time=original.expiresAt+600000;
 return {docs,runs,late(){late=true;},stale(){time+=31000;},args:{store:{get:async(c,k)=>docs.has(c+'/'+k)?{value:docs.get(c+'/'+k)}:null},
   repository:original.repository,runId:'999',now:()=>time,read:async path=>{
     if(path.includes('/runs?'))return {total_count:path.includes('status=queued')?runs.length:0,workflow_runs:path.includes('status=queued')?runs:[]};
     if(path.includes('/jobs?'))return {total_count:late?1:0,jobs:late?[{id:1}]:[]};
     return runs.find(r=>path.endsWith('/'+r.id));
   }}};
}
test('continuation excludes only the two exact revoked runs with complete receipts and fresh jobs0',async()=>{
 const f=fixture();assert.equal(await continuationHasOtherRun(f.args),false);
});
test('another queued run prevents duplicate continuation',async()=>{
 const f=fixture();f.runs.push({id:123});assert.equal(await continuationHasOtherRun(f.args),true);
});
test('missing revocation, changed identity and late jobs all block continuation',async()=>{
 for(const mutate of [f=>f.docs.delete('state/campaign'),f=>f.docs.delete('journal/'+RECEIPT_KEY+':complete'),
   f=>f.runs[0].head_sha='c'.repeat(40),f=>f.late()]){
  const f=fixture();mutate(f);await assert.rejects(continuationHasOtherRun(f.args));
 }
});
test('stale reads cannot authorize continuation',async()=>{
 const f=fixture(),read=f.args.read;f.args.read=async path=>{const result=await read(path);if(path.includes('/jobs?'))f.stale();return result;};
 await assert.rejects(continuationHasOtherRun(f.args),/GITHUB_EVIDENCE_STALE/);
});
