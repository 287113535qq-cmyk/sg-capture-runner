import test from 'node:test';import assert from 'node:assert/strict';import {createStageProgress} from './stage-progress.mjs';
test('stages proceed immediately, preserve errors and report an actual running command',async()=>{
 const rows=[];const p=createStageProgress({emit:r=>rows.push(r),slowMs:5});let calls=0;
 assert.equal(await p.run('admission',async()=>{calls++;await new Promise(r=>setTimeout(r,15));return 7;}),7);
 const error=Object.assign(Error('PRIVATE_PAYLOAD'),{code:'SAFE_CODE'});
 await assert.rejects(p.run('readback',async()=>{calls++;throw error;}),e=>e===error);
 assert.equal(calls,2);assert(rows.some(r=>r.event==='running'&&r.thresholdExceeded));
 assert.equal(rows.at(-1).code,'SAFE_CODE');assert(!JSON.stringify(rows).includes('PRIVATE'));
 await assert.rejects(p.run('private-command',async()=>calls++));assert.equal(calls,2);
});
test('broken stage output does not fail a valid action',async()=>{
 const p=createStageProgress({emit:()=>{throw Error('sink');}});assert.equal(await p.run('select',async()=>42),42);
});
