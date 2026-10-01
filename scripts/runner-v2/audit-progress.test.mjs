import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuditProgress} from './audit-progress.mjs';

test('bounded page progress separates time from completion and never emits record identities',async()=>{
 let clock=0;const rows=[],p=createAuditProgress({emit:r=>rows.push(r),now:()=>clock});
 for(let i=0;i<100;i++){
  await p.run('readback',async()=>{clock+=2;});await p.run('python',async()=>{clock+=3;});
  await p.run('recordChecks',async()=>{clock+=1;});p.page(100,(i+1)*100);
 }
 assert.equal(rows.length,1);assert.equal(rows[0].verified,10000);assert.equal(rows[0].event,'page-checks-complete');
 assert.equal(rows[0].gameCompletionProved,undefined);assert.equal(rows[0].phases.python.elapsedMs,300);
 await p.run('commitProof',async()=>{clock+=4;});p.finish();
 assert.equal(rows[1].gameCompletionProved,true);assert.equal(rows[1].elapsedMs,604);
 assert.deepEqual(Object.keys(rows[1]).sort(),['elapsedMs','event','gameCompletionProved','pages','phases','schema','verified'].sort());
});
test('failure does not report completion; diagnostic sink failure cannot abort protected processing',async()=>{
 const rows=[],p=createAuditProgress({emit:r=>rows.push(r)});
 await assert.rejects(p.run('python',async()=>{throw Error('COUNT_AUDIT_UNVERIFIED');}),/COUNT_AUDIT_UNVERIFIED/);
 p.failed(Error('COUNT_AUDIT_UNVERIFIED'));assert.equal(rows[0].gameCompletionProved,false);assert.equal(rows[0].verified,0);
 const bad=createAuditProgress({emit:()=>{throw Error('log sink failed');}});bad.finish();
 await assert.rejects(p.run('raw-session-value',async()=>{}),/UNKNOWN_AUDIT_PHASE/);
 assert.throws(()=>p.page(101,101),/AUDIT_PROGRESS_COUNT/);assert.throws(()=>p.page(2,3),/AUDIT_PROGRESS_COUNT/);
});
