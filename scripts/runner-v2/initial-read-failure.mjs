import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';

const sourceId=36908875451,sourceCommit='f1cf4b3c82216daf35c03957e88ac96d55e1a549';
const logHash='37d62b912661757e34c61211768e9367e76d5bccf952012c7c5be1183f937bd9';
export function checkInitialReadFailure({ended,jobs,evidence}){
 assert(ended.id===sourceId&&ended.head_sha===sourceCommit&&ended.status==='completed'&&ended.conclusion==='failure'
  &&ended.run_attempt===1&&ended.repository?.full_name==='zyzuoyang/sg-capture-runner'
  &&ended.path==='.github/workflows/trial-300k.yml','INITIAL_READ_SOURCE_IDENTITY');
 assert(jobs.total_count===jobs.jobs.length&&jobs.jobs.every(j=>j.status==='completed')
  &&jobs.jobs.filter(j=>j.name==='formal-admit'&&j.conclusion==='success').length===1,'INITIAL_READ_JOBS');
 for(let host=0;host<20;host++)assert(jobs.jobs.filter(j=>j.name==='capture-'+host
  &&j.conclusion===([0,7,11].includes(host)?'failure':'success')).length===1,'INITIAL_READ_PARENT_SCOPE');
 assert(jobs.jobs.filter(j=>j.name==='verify'&&j.conclusion==='success').length===1,'INITIAL_READ_VERIFY');
 assert(jobs.jobs.every(j=>j.name==='formal-admit'||j.name==='verify'||/^capture-(?:[0-9]|1[0-9])$/.test(j.name)
  ||j.conclusion==='skipped'),'INITIAL_READ_EXTRA_JOB');
 assert(evidence?.schema==='sg-initial-read-failure-v1'&&evidence.sourceRun===sourceId+':1'
  &&evidence.commit===sourceCommit&&evidence.logSha256===logHash&&evidence.rows?.length===80,'INITIAL_READ_LOG_BINDING');
 const slots=new Set();let complete=0,requests=0;
 for(const row of evidence.rows){
  assert(Number.isSafeInteger(row.slot)&&[0,40,80,120].some(base=>row.slot>=base&&row.slot<base+20)
   &&!slots.has(row.slot)&&row.gameId===32799&&row.sourceErrors===0
   &&Number.isSafeInteger(row.complete)&&row.complete>=0&&Number.isSafeInteger(row.sourceRequests)&&row.sourceRequests>=0,'INITIAL_READ_ROW');
  slots.add(row.slot);complete+=row.complete;requests+=row.sourceRequests;
  if([47,51,120].includes(row.slot))assert(row.outcome==='stopped'&&row.error==='GATEWAY_DISCONNECTED'
   &&row.businessOutcome==='requires-review'&&row.firstReadyAtMs===null&&row.complete===0&&row.sourceRequests===0
   &&hash(row.operationRequests)===hash({read:1}),'INITIAL_READ_ZERO_SOURCE_REQUIRED');
  else assert(row.outcome==='success'&&row.error==null&&row.sourceRequests>0
   &&Number.isSafeInteger(row.firstReadyAtMs),'INITIAL_READ_HEALTHY_CHILD');
 }
 assert(complete===16056&&requests===33998,'INITIAL_READ_TOTAL');
 return {schema:evidence.schema,sourceRun:evidence.sourceRun,commit:sourceCommit,logSha256:logHash,
  failedSlots:[47,51,120],childComplete:complete,sourceRequests:requests,evidenceHash:hash(evidence)};
}
export function loadInitialReadFailure(ended,jobs){
 assert(ended.id===sourceId&&ended.head_sha===sourceCommit,'INITIAL_READ_SOURCE_IDENTITY');
 const bytes=execFileSync('gh',['api',`repos/zyzuoyang/sg-capture-runner/actions/runs/${sourceId}/attempts/1/logs`],
  {maxBuffer:64*1024**2,timeout:60000,stdio:['ignore','pipe','pipe']});
 assert(createHash('sha256').update(bytes).digest('hex')===logHash,'INITIAL_READ_ARCHIVE_HASH');
 fs.mkdirSync('.local',{recursive:true});const path='.local/initial-read-failure-private.zip';fs.writeFileSync(path,bytes);
 const rows=JSON.parse(execFileSync('python3',[fileURLToPath(new URL('./canary-log-extract.py',import.meta.url)),path,'startup'],
  {maxBuffer:32*1024**2,timeout:30000,stdio:['ignore','pipe','pipe']}));
 const evidence={schema:'sg-initial-read-failure-v1',sourceRun:sourceId+':1',commit:sourceCommit,logSha256:logHash,rows};
 checkInitialReadFailure({ended,jobs,evidence});return evidence;
}
