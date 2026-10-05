import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {withGithubHttpDiagnostic,githubReadDiagnostic} from '../github-read-diagnostic.mjs';
import {authenticatedRead} from '../github-boundary.mjs';

export const repositories=['zyzuoyang/sg-capture-runner','287113535qq-cmyk/sg-capture-runner'];
export const target={run:37241550681,commit:'7c293bc500f1a0c25b775c46198a45ce644f4253'};
const statuses=['in_progress','queued','pending','waiting','requested'];
// Fixed, read-only evidence for the failed preparation and its existing sealed
// predecessors. No capture, transport, state-store, or dispatch module is loaded.
export function queries(){return [
 ...repositories.flatMap(repository=>statuses.map(status=>({repository,kind:'list',status,
  path:`repos/${repository}/actions/runs?status=${status}&per_page=100`}))),
 ...[{repository:repositories[0],run:target.run,commit:target.commit},
     {repository:repositories[0],run:37238783184,commit:'5434b8a2b6e3b645665371fd78ffdd77ca3361a4'},
     {repository:repositories[0],run:37209573313,commit:'76e45bf8877beabf1d802b50518257931a5ee881'},
     {repository:repositories[1],run:37212801323,commit:'76e45bf8877beabf1d802b50518257931a5ee881'},
     {repository:repositories[1],run:37237945887,commit:'97d31ba762991662cb7896827aad254a8e360779'}]
   .flatMap(q=>[{...q,kind:'run',path:`repos/${q.repository}/actions/runs/${q.run}`},
               {...q,kind:'jobs',path:`repos/${q.repository}/actions/runs/${q.run}/jobs?filter=all&per_page=100`}])
 ];}
export async function checkGithubReads({token,fetchRead=fetch,now=Date.now}){
 assert(typeof token==='string'&&token.length>0,'GITHUB_AUTH_REQUIRED');
 const report={schema:'sg-ag-github-read-check-v2',targetRun:target.run+':1',targetCommit:target.commit,
  observedAt:Math.floor(now()/1000),completedFreshChecks:0,readAttempts:0,rows:[],sourceRequests:0,nativeWrites:0,dispatches:0,retries:0};
 let round=0;const responseRows=new Map();
 const read=authenticatedRead(token,{fetchRead:async(url,options)=>{
  report.readAttempts++;const q=queries().find(q=>'https://api.github.com/'+q.path===url);assert(q,'GITHUB_READ_CHECK_SCOPE');
  const response=await fetchRead(url,options);
  const diagnostic=githubReadDiagnostic(withGithubHttpDiagnostic(new Error('GITHUB_RUN_READ_FAILED'),q.path,response));
  const row={...diagnostic,round,conditionalHeaderSent:typeof options.headers['If-None-Match']==='string',
   etagAvailable:typeof response.headers?.get('etag')==='string',accepted:false};
  responseRows.set(q.path,row);report.rows.push(row);return response;
 }});
 // A second complete check starts only after the first succeeded. Every URL
 // still reaches GitHub; a 304 is accepted by the actual admission reader only
 // with its exact matching prior ETag. No failed or unknown read is retried.
 for(round=1;round<=2;round++){
 for(let offset=0;offset<queries().length;offset+=5){
  const wave=queries().slice(offset,offset+5);
  const results=await Promise.allSettled(wave.map(async q=>{
   const value=await read(q.path),row=responseRows.get(q.path);assert(row?.round===round,'GITHUB_READ_CHECK_RESPONSE');
   if(q.kind==='list'){
    row.reportedTotal=Number.isSafeInteger(value.total_count)?value.total_count:null;
    row.returnedRows=Array.isArray(value.workflow_runs)?value.workflow_runs.length:null;
    row.complete=Number.isInteger(value.total_count)&&value.total_count<100&&Array.isArray(value.workflow_runs)&&value.workflow_runs.length===value.total_count;
   }else if(q.kind==='jobs'){
    row.reportedTotal=Number.isSafeInteger(value.total_count)?value.total_count:null;
    row.returnedRows=Array.isArray(value.jobs)?value.jobs.length:null;
    row.complete=Number.isInteger(value.total_count)&&value.total_count<100&&Array.isArray(value.jobs)&&value.jobs.length===value.total_count;
   }else{
    row.identityMatches=value.id===q.run&&value.run_attempt===1&&value.head_sha===q.commit&&value.repository?.full_name===q.repository;
    row.completed=value.status==='completed';
   }
   row.accepted=q.kind==='run'?row.identityMatches&&row.completed:row.complete;
   assert(row.accepted,'GITHUB_READ_CHECK_INCOMPLETE');
  }));
  const failed=results.find(r=>r.status==='rejected');
  if(failed){report.outcome='stopped';report.code=failed.reason?.message==='GITHUB_RUN_READ_FAILED'?'GITHUB_RUN_READ_FAILED':failed.reason?.message==='GITHUB_READ_CHECK_INCOMPLETE'?'GITHUB_READ_CHECK_INCOMPLETE':'GITHUB_READ_OUTCOME_UNKNOWN';return report;}
 }
 report.completedFreshChecks=round;
 }
 report.outcome='complete';report.code='GITHUB_READ_CHECK_COMPLETE';return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_OS==='Linux'
  &&process.env.RUNNER_ENVIRONMENT==='github-hosted'&&repositories.includes(process.env.GITHUB_REPOSITORY)
  &&process.env.GITHUB_JOB==='read-check'&&process.env.GITHUB_RUN_ATTEMPT==='1','SG_GITHUB_READ_CHECK_OWNER');
 const report=await checkGithubReads({token:process.env.GH_TOKEN});
 console.log(JSON.stringify({...report,repository:process.env.GITHUB_REPOSITORY,
  diagnosticRun:process.env.GITHUB_RUN_ID+':1',diagnosticCommit:process.env.GITHUB_SHA}));
 if(report.outcome!=='complete')process.exitCode=2;
}
