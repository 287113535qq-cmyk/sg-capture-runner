import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {extractDirectJobFinal} from './action-direct-resource.mjs';
export function reviewEndedHttpLogs({source,jobs,commit,logs}){
 assert(source?.repository?.full_name==='287113535qq-cmyk/sg-capture-runner'&&source.status==='completed'&&source.conclusion==='failure'
 &&source.head_sha===commit&&source.run_attempt===1&&source.event==='workflow_dispatch'&&source.path==='.github/workflows/trial-300k.yml'
 &&jobs?.total_count===jobs.jobs?.length&&jobs.total_count<100&&jobs.jobs.every(j=>j.status==='completed'),'HTTP_CLOSE_SOURCE');
 const captures=Array.from({length:20},(_,i)=>{const found=jobs.jobs.filter(j=>j.name==='capture-'+i);assert(found.length===1&&found[0].conclusion==='failure'&&Number.isSafeInteger(found[0].id),'HTTP_CLOSE_JOBS');return found[0];});
 assert(new Set(captures.map(j=>j.id)).size===20,'HTTP_CLOSE_DUPLICATE_JOB');
 assert(jobs.jobs.filter(j=>j.name==='pyramids-formal-admit'&&j.conclusion==='success').length===1
 &&jobs.jobs.filter(j=>j.name==='verify'&&j.conclusion==='failure').length===1
 &&jobs.jobs.filter(j=>!captures.includes(j)&&!['verify','pyramids-formal-admit'].includes(j.name)).every(j=>['success','skipped'].includes(j.conclusion)), 'HTTP_CLOSE_OTHER_JOB');
 assert(logs.length===20,'HTTP_CLOSE_LOGS');let faults=0;const manifest=[],outcomes=[];
 for(let i=0;i<20;i++){
  const job=captures[i],bytes=logs[i];assert(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=32*1024**2,'HTTP_CLOSE_LOG_SIZE');
  const text=bytes.toString('utf8'),final=extractDirectJobFinal(text,20+i),rows=[];
  assert(final.gameId===32721&&Number.isSafeInteger(final.completedThisRun)&&final.completedThisRun>=0,'HTTP_CLOSE_PERFORMANCE');
  for(const line of text.split(/\r?\n/))if(/"schema"\s*:\s*"sg-work-pool-v1"/.test(line)){const r=JSON.parse(line.slice(line.indexOf('{')));if(r.outcome==='stopped')rows.push(r);}
  assert(rows.length===1&&rows[0].gameId===32721&&rows[0].shardId===20+i,'HTTP_CLOSE_FINAL_SUMMARY');const row=rows[0];
  if(row.error==='SOURCE_HTTP_REJECTED'){assert(row.httpStatus===502&&final.sourceErrors===1,'HTTP_CLOSE_STATUS');faults++;}
  else assert(row.error==='GLOBAL_SOURCE_STOPPED'&&final.sourceErrors===0,'HTTP_CLOSE_FOREIGN_FAULT');
  manifest.push({jobId:job.id,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
  outcomes.push({slot:20+i,error:row.error,httpStatus:row.httpStatus??null,complete:final.completedThisRun});
 }
 assert(faults===1,'HTTP_CLOSE_FAULT_COUNT');return {schema:'sg-ended-http-evidence-v1',sourceRun:source.id+':1',commit,manifest,outcomes,sourceRequests:0};
}
