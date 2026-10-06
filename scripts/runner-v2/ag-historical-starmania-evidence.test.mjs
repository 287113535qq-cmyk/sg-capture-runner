import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';
import {assertOwnHistoricalEvidencePipe,createOwnHistoricalPrivateEvidenceWriter} from './ag-rolling/sg-historical-starmania-evidence.mjs';
const env={GITHUB_RUN_ID:'99123',GITHUB_SHA:'a'.repeat(40),SG_HISTORICAL_PRIVATE_EVIDENCE_FD:'3'};
const report=()=>({schema:'sg-historical-starmania-run-v1',owner:'99123:1:historical-32737',commit:env.GITHUB_SHA,sourceRequests:0,nativeWrites:0,complete:false,linuxProof:{commit:env.GITHUB_SHA}});
function fixture(){let writes=0,bytes;const io={fstatSync:fd=>({isFIFO:()=>true,uid:7,mode:0o10600,dev:1,ino:100+fd}),readlinkSync:p=>'pipe:['+(p.endsWith('/0')?100:103)+']',readFileSync:p=>'ino:\t'+(p.endsWith('/0')?100:103)+'\nflags:\t'+(p.endsWith('/0')?'00':'01')+'\n',writeSync:(fd,b)=>{assert.equal(fd,3);writes++;bytes=b;return b.length;}};
 return {io,options:{io,env,platform:'linux',euid:()=>7},get writes(){return writes;},get bytes(){return bytes;}};}
test('private evidence requires distinct anonymous owned pipes and correct input/output direction',()=>{
 const x=fixture();assertOwnHistoricalEvidencePipe(x.options);
 for(const alter of [x=>x.options.platform='win32',x=>x.options.euid=()=>8,x=>x.io.readlinkSync=()=>'/synthetic/file',x=>x.io.fstatSync=()=>({isFIFO:()=>false}),x=>x.io.readFileSync=()=> 'ino:\t103\nflags:\t00\n',x=>x.io.fstatSync=()=>({isFIFO:()=>true,uid:7,mode:0o10644,dev:1,ino:103})]){
  const x=fixture();alter(x);assert.throws(()=>assertOwnHistoricalEvidencePipe(x.options),/HISTORICAL_PRIVATE_EVIDENCE_PIPE_REQUIRED/);assert.equal(x.writes,0);
 }
});
test('one complete private evidence write clears its buffer and permanently consumes the writer',()=>{
 const x=fixture(),write=createOwnHistoricalPrivateEvidenceWriter(x.options);write(report());assert.equal(x.writes,1);assert(x.bytes.every(b=>b===0));
 assert.throws(()=>write(report()),/HISTORICAL_PRIVATE_EVIDENCE_CONSUMED_NO_RETRY/);assert.equal(x.writes,1);
});
test('unknown or partial private write stops once with no public or disk fallback',()=>{
 for(const unknown of [true,false]){const x=fixture();let writes=0;x.io.writeSync=()=>{writes++;if(unknown)throw Error('UNKNOWN_PRIVATE_ACK');return 1;};
  const write=createOwnHistoricalPrivateEvidenceWriter(x.options);assert.throws(()=>write(report()),unknown?/UNKNOWN_PRIVATE_ACK/:/HISTORICAL_PRIVATE_EVIDENCE_WRITE_UNKNOWN_NO_RETRY/);
  assert.throws(()=>write(report()),/HISTORICAL_PRIVATE_EVIDENCE_CONSUMED_NO_RETRY/);assert.equal(writes,1);
 }
});
test('foreign evidence identity is rejected before private write and no report file path exists',()=>{
 for(const change of [v=>v.owner='other:1:historical-32737',v=>v.commit='b'.repeat(40),v=>v.sourceRequests=1,v=>{v.complete=true;v.result={gameId:32723};}]){
  const x=fixture(),v=report();change(v);assert.throws(()=>createOwnHistoricalPrivateEvidenceWriter(x.options)(v),/HISTORICAL_PRIVATE_EVIDENCE_IDENTITY/);assert.equal(x.writes,0);
 }
 const job=fs.readFileSync('scripts/runner-v2/ag-rolling/sg-historical-starmania-job.mjs','utf8');assert(!job.includes('business-evidence'));assert(!job.includes('console.log'));assert(job.includes('writeOwnHistoricalPrivateEvidence(report)'));
});
test('actual disabled job stops before private stdin, SSH, Mongo or evidence emission',()=>{
 const x=spawnSync(process.execPath,['scripts/runner-v2/ag-rolling/sg-historical-starmania-job.mjs'],{input:'synthetic-unread-private-input',encoding:'utf8',timeout:10000,env:{...process.env,...env,GH_TOKEN:undefined,GITHUB_TOKEN:undefined,GITHUB_ACTIONS:'true',RUNNER_OS:'Linux',RUNNER_ENVIRONMENT:'github-hosted',GITHUB_REPOSITORY:'zyzuoyang/sg-capture-runner',GITHUB_REF:'refs/heads/sg-business-historical-32737-20261006',GITHUB_JOB:'ag-rolling-business-delivery',GITHUB_RUN_ATTEMPT:'1',SG_BUSINESS_GAME_IDS:'32737'}});
 assert.notEqual(x.status,0);assert(!x.stdout.includes('synthetic-unread'));assert(!x.stderr.includes('synthetic-unread'));assert(x.stderr.includes('HISTORICAL_OWN_EXECUTION_ADMISSION_REQUIRED'));assert.equal(x.stdout,'');
});
