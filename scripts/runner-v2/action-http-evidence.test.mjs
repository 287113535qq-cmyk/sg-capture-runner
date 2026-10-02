import test from 'node:test';import assert from 'node:assert/strict';
import {reviewEndedHttpLogs} from './action-http-evidence.mjs';
function fixture(){
 const commit='a'.repeat(40),source={id:123,repository:{full_name:'287113535qq-cmyk/sg-capture-runner'},status:'completed',conclusion:'failure',head_sha:commit,run_attempt:1,event:'workflow_dispatch',path:'.github/workflows/trial-300k.yml'};
 const jobs={jobs:[{name:'pyramids-formal-admit',conclusion:'success'},...Array.from({length:20},(_,i)=>({id:100+i,name:'capture-'+i,conclusion:'failure'})),{name:'verify',conclusion:'failure'}].map(j=>({...j,status:'completed'})),total_count:22};
 const rows=Array.from({length:20},(_,i)=>[{schema:'sg-capture-performance-v1',reason:'final',shardId:20+i,gameId:32721,sourceErrors:i===3?1:0,completedThisRun:100},{schema:'sg-work-pool-v1',outcome:'stopped',shardId:20+i,gameId:32721,error:i===3?'SOURCE_HTTP_REJECTED':'GLOBAL_SOURCE_STOPPED',...(i===3?{httpStatus:502}:{})}]);
 return {source,jobs,commit,rows};
}
const args=f=>({...f,logs:f.rows.map(rs=>Buffer.from(rs.map(r=>'2026-10-02T00:00:00Z '+JSON.stringify(r)).join('\n')))});
test('one explicit 502 and nineteen protection stops bind ordered private job bytes and complete counts',()=>{
 const out=reviewEndedHttpLogs(args(fixture()));assert.equal(out.outcomes.reduce((n,r)=>n+r.complete,0),2000);assert.equal(out.manifest.length,20);assert.equal(out.sourceRequests,0);
});
test('foreign faults, non-502 statuses, missing or duplicate evidence and changed task identity refuse cleanup',()=>{
 for(const mutate of [f=>f.rows[3][1].httpStatus=401,f=>f.rows[0][1].error='MONGO_CONTENT_CONFLICT',f=>f.rows[0].pop(),f=>f.rows[0].push({...f.rows[0][0]}),f=>f.jobs.jobs[2].id=100,f=>f.source.conclusion='success',f=>f.rows[3][0].sourceErrors=0,f=>f.rows[0][0].completedThisRun=-1]){
  const f=fixture();mutate(f);assert.throws(()=>reviewEndedHttpLogs(args(f)));
 }
});
