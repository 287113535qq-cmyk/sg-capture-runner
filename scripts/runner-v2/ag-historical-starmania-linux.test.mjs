import test from 'node:test';import assert from 'node:assert/strict';
import {verifyBusinessLinuxEvidence,requireBusinessLinux,BUSINESS_BRANCH,BUSINESS_LINUX_REPOSITORY} from './ag-rolling/sg-historical-starmania-linux.mjs';
function fixture(){return {run:{id:99124,repository:{full_name:BUSINESS_LINUX_REPOSITORY},head_sha:'a'.repeat(40),head_branch:BUSINESS_BRANCH,run_attempt:1,event:'workflow_dispatch',path:'.github/workflows/preflight.yml',status:'completed',conclusion:'success'},jobs:{total_count:1,jobs:[{id:99125,name:'preflight',run_id:99124,status:'completed',conclusion:'success'}]},result:{schema:'sg-offline-preflight-v1',passed:true,complete:true,sourceRequests:0,mongoWrites:0,runs:[{workers:3,passed:true,groups:Object.entries({python:8,'collector-protocol':3,'runner-persistence':3}).map(([group,n],g)=>({group,passed:true,expectedCommands:n,commands:Array.from({length:n},(_,i)=>({exitCode:0,argvHash:(g*10+i+1).toString(16).padStart(64,'0')}))}))}]}};}
test('own Linux identity and all14 distinct joined commands are required; other historical branches cannot supply permission',()=>{
 assert.equal(verifyBusinessLinuxEvidence(fixture(),99124,'a'.repeat(40)).joinedCommands,14);
 for(const change of [v=>v.run.head_branch='sg-business-historical-32723-20261005',v=>v.run.head_sha='b'.repeat(40),v=>v.run.run_attempt=2,v=>v.jobs.jobs[0].conclusion='cancelled',v=>v.jobs.total_count=2,v=>v.result.runs[0].groups[0].commands.pop(),v=>v.result.runs[0].groups[1].commands[0].argvHash=v.result.runs[0].groups[0].commands[0].argvHash,v=>v.result.mongoWrites=1]){
  const x=fixture();change(x);assert.throws(()=>verifyBusinessLinuxEvidence(x,99124,'a'.repeat(40)));
 }
});
test('unknown own Linux metadata read is attempted once without archive polling or retry',async()=>{
 let reads=0;await assert.rejects(requireBusinessLinux({id:99124,commit:'a'.repeat(40),token:'synthetic-memory-token',fetchImpl:async()=>{reads++;throw Error('UNKNOWN_LINUX_READ');}}),/UNKNOWN_LINUX_READ/);assert.equal(reads,1);
});
