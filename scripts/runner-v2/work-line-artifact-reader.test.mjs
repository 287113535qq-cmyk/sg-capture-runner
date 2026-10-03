import test from 'node:test';import assert from 'node:assert/strict';
import {readWorkLineArtifacts} from './work-line-artifact-reader.mjs';
test('each artifact tick calls the fixed current-code consumer independently',async()=>{
 const calls=[];
 const execute=async(...args)=>{calls.push(args);return{stdout:JSON.stringify({status:'evidence-artifacts-read',delivered:1,errors:[],sourceRequests:0,mongoWrites:0})};};
 for(let i=0;i<2;i++)assert.equal((await readWorkLineArtifacts('/workspace',{execute})).delivered,1);
 assert.equal(calls.length,2);
 for(const [exe,args,options] of calls){
  assert.equal(exe,process.execPath);assert.deepEqual(args,['scripts/runner-v2/work-line-artifact-executor.mjs']);
  assert.equal(options.cwd,'/workspace');assert.equal(options.timeout,180000);assert.equal(options.windowsHide,true);
 }
});
test('artifact consumer cannot return source or database write authority',async()=>{
 for(const changed of [{sourceRequests:1},{mongoWrites:1},{status:'capture'}])
  await assert.rejects(readWorkLineArtifacts('/workspace',{execute:async()=>({stdout:JSON.stringify({status:'evidence-artifacts-read',sourceRequests:0,mongoWrites:0,...changed})})}),/EVIDENCE_EXECUTOR_BOUNDARY/);
});
