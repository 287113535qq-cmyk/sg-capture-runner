import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {reviewResourceWorkers} from './resource-windows.mjs';
const execute=promisify(execFile);

export function directCaptureJobs({source,jobs,commit}){
 assert(source?.repository?.full_name==='287113535qq-cmyk/sg-capture-runner'
  &&Number.isSafeInteger(source.id)&&source.run_attempt===1&&source.head_sha===commit
  &&source.event==='workflow_dispatch'&&source.path==='.github/workflows/trial-300k.yml'
  &&['in_progress','completed'].includes(source.status)
  &&(source.status!=='completed'||source.conclusion==='success')
  &&jobs?.total_count===jobs.jobs?.length&&jobs.total_count<100,'DIRECT_RESOURCE_SOURCE');
 const captures=Array.from({length:20},(_,i)=>{
  const found=jobs.jobs.filter(j=>j.name==='capture-'+i);
  assert(found.length===1&&found[0].status==='completed'&&found[0].conclusion==='success'
   &&Number.isSafeInteger(found[0].id),'DIRECT_RESOURCE_CAPTURE_JOB');return found[0];
 });
 assert(new Set(captures.map(j=>j.id)).size===20,'DIRECT_RESOURCE_DUPLICATE_JOB');return captures;
}
export function extractDirectJobFinal(text,slot){
 const rows=[];
 for(const line of text.split(/\r?\n/)){
  if(!/"schema"\s*:\s*"sg-capture-performance-v1"/.test(line))continue;
  const row=JSON.parse(line.slice(line.indexOf('{')));
  if(row.reason==='final')rows.push(row);
 }
 assert(rows.length===1&&rows[0].shardId===slot,'DIRECT_RESOURCE_FINAL_ROW');return rows[0];
}

// Capture-job logs are available before the aggregate run ends. Download only
// those authenticated successful jobs, saving raw logs privately. The digest
// binds the ordered job-ID/log-SHA manifest, not a nonexistent run ZIP.
export async function loadDirectCaptureLogs({source,jobs,commit,download=async id=>{
 const result=await execute('gh',['api',`repos/287113535qq-cmyk/sg-capture-runner/actions/jobs/${id}/logs`],
  {encoding:'buffer',maxBuffer:32*1024**2,timeout:60000});return result.stdout;
},save=async(id,bytes)=>{
 fs.mkdirSync('.local/direct-action-resource',{recursive:true});
 const path=`.local/direct-action-resource/${source.id}-${id}.log`;
 if(fs.existsSync(path))assert(fs.readFileSync(path).equals(bytes),'DIRECT_RESOURCE_LOG_CHANGED');
 else fs.writeFileSync(path,bytes,{flag:'wx'});
}}){
 const captures=directCaptureJobs({source,jobs,commit}),rows=[],manifest=[];
 // Four independent read-only downloads; no source or storage business call.
 for(let first=0;first<captures.length;first+=4){
  const results=await Promise.allSettled(captures.slice(first,first+4).map(async(job,i)=>{
   const bytes=await download(job.id);assert(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=32*1024**2,'DIRECT_RESOURCE_LOG_SIZE');
   await save(job.id,bytes);
   return {row:extractDirectJobFinal(bytes.toString('utf8'),20+first+i),
    manifest:{jobId:job.id,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length}};
  }));
  const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
  for(const r of results){rows.push(r.value.row);manifest.push(r.value.manifest);}
 }
 return {rows,manifest,logSha256:createHash('sha256').update(JSON.stringify(manifest)).digest('hex')};
}
export function reviewDirectSourceResource({run,commit,rows,logSha256,completeDelta}){
 const slots=Array.from({length:20},(_,i)=>i+20);
 assert(Array.isArray(rows)&&rows.length===20&&new Set(rows.map(r=>r.shardId)).size===20
  &&rows.every(r=>slots.includes(r.shardId)&&r.schema==='sg-capture-performance-v1'&&r.reason==='final'
   &&r.gameId===32721&&r.sourceErrors===0&&Number.isSafeInteger(r.sourceRequests)&&r.sourceRequests>0
   &&Number.isSafeInteger(r.completedThisRun)&&r.completedThisRun>0)
  &&Number.isSafeInteger(completeDelta)&&completeDelta>0
  &&rows.reduce((n,r)=>n+r.completedThisRun,0)===completeDelta,'DIRECT_RESOURCE_FINAL_COUNTS');
 const startMs=Math.ceil(Math.max(...rows.map(r=>r.rpcMetrics?.resourceObservation?.firstReadyAtMs))/60000)*60000;
 const workers=rows.map(r=>({slot:r.shardId,run,commit,sourceErrors:r.sourceErrors,unknown:0,
  diagnostics:r.rpcMetrics.resourceObservation,hostDiagnostics:r.rpcMetrics.hostResourceObservation}));
 return reviewResourceWorkers({run,commit,logSha256,expectedSlots:slots,workers,startMs,endMs:startMs+600000});
}
