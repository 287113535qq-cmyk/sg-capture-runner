import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

export function extractCanaryLog(path,{python='python3',expectedCount=40}={}){
 assert([40,80].includes(expectedCount),'CANARY_LOG_ROW_COUNT');
 return JSON.parse(execFileSync(python,[fileURLToPath(new URL('./canary-log-extract.py',import.meta.url)),path,String(expectedCount)],
  {maxBuffer:32*1024**2,timeout:30000,stdio:['ignore','pipe','pipe']}));
}

// Read exactly one authenticated, completed source archive. No retry, arbitrary
// URL, shell interpolation, or extraction into the checkout is permitted.
export function loadCanarySourceLog(ended,jobs,{expectedCount=40}={}){
 assert([40,80].includes(expectedCount),'CANARY_LOG_ROW_COUNT');
 assert(ended.repository?.full_name==='zyzuoyang/sg-capture-runner'&&ended.status==='completed'&&ended.conclusion==='success'
  &&Number.isSafeInteger(ended.id)&&ended.run_attempt===1&&ended.path==='.github/workflows/trial-300k.yml'
  &&jobs.total_count===jobs.jobs.length&&jobs.jobs.every(j=>j.status==='completed'&&['success','skipped'].includes(j.conclusion))
  &&Array.from({length:20},(_,i)=>'capture-'+i).every(name=>jobs.jobs.filter(j=>j.name===name&&j.conclusion==='success').length===1),
 'CANARY_SOURCE_LOG_IDENTITY');
 const bytes=execFileSync('gh',['api',`repos/zyzuoyang/sg-capture-runner/actions/runs/${ended.id}/attempts/1/logs`],
  {maxBuffer:64*1024**2,timeout:60000,stdio:['ignore','pipe','pipe']});
 assert(bytes.length>0&&bytes.length<=64*1024**2,'CANARY_LOG_ARCHIVE_SIZE');
 fs.mkdirSync('.local',{recursive:true});const path='.local/canary-source-log-private.zip';fs.writeFileSync(path,bytes);
 const rows=extractCanaryLog(path,{expectedCount});
 return {rows,logSha256:createHash('sha256').update(bytes).digest('hex')};
}
