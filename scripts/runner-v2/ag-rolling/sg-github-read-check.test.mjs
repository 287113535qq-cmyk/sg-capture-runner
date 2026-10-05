import test from 'node:test';
import assert from 'node:assert/strict';
import {checkGithubReads,queries} from './sg-github-read-check.mjs';
function response(q,status=200){return {ok:status===200,status,headers:new Headers({etag:'"0123456789abcdef0123456789abcdef"','x-ratelimit-limit':'1000','x-ratelimit-remaining':'700','x-ratelimit-resource':'core','authorization':'private'}),
 async text(){throw Error('BODY_READ_FORBIDDEN')},async json(){assert.equal(status,200);return q.kind==='list'?{total_count:0,workflow_runs:[]}:q.kind==='jobs'?{total_count:43,jobs:Array(43).fill({})}:{id:q.run,run_attempt:1,head_sha:q.commit,repository:{full_name:q.repository},status:'completed'};}};}
test('fixed job-token diagnosis repeats both full fresh checks through the actual conditional admission reader, exposing bounded evidence only',async()=>{
 const seen=[];const result=await checkGithubReads({token:'secret',fetchRead:async(url,options)=>{
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer secret');
  const q=queries().find(q=>'https://api.github.com/'+q.path===url);assert(q);seen.push(q.path);return response(q,options.headers['If-None-Match']?304:200);
 }});assert.equal(result.outcome,'complete');assert.equal(seen.length,40);assert.equal(new Set(seen).size,20);
 assert.equal(result.readAttempts,40);assert.equal(result.completedFreshChecks,2);assert.equal(result.rows.filter(r=>r.httpStatus===304&&r.accepted&&r.conditionalHeaderSent).length,20);
 assert.equal(result.sourceRequests+result.nativeWrites+result.dispatches+result.retries,0);
 const text=JSON.stringify(result);for(const value of ['secret','private','authorization','responseBody'])assert(!text.includes(value));
});
for(const status of [401,403,429])test(`HTTP ${status} records the real endpoint and quota, drains its wave and stops without body reads or retry`,async()=>{
 let active=0,done=0,seen=0;const result=await checkGithubReads({token:'secret',fetchRead:async url=>{
  const q=queries().find(q=>'https://api.github.com/'+q.path===url);active++;seen++;await new Promise(r=>setTimeout(r,2));active--;done++;return response(q,status);
 }});assert.equal(active,0);assert.equal(done,5);assert.equal(seen,5);assert.equal(result.outcome,'stopped');assert.equal(result.code,'GITHUB_RUN_READ_FAILED');
 assert(result.rows.every(r=>r.httpStatus===status&&r.endpoint.kind==='active-run-list'&&r.headers['x-ratelimit-limit']==='1000'));
});
test('network outcome stays unknown, stops the next wave, and never invents an HTTP status',async()=>{
 let seen=0;const result=await checkGithubReads({token:'secret',fetchRead:async()=>{seen++;throw Error('contains credential and arbitrary network text')}});
 assert.equal(seen,5);assert.equal(result.code,'GITHUB_READ_OUTCOME_UNKNOWN');assert.equal(result.rows.length,0);assert(!JSON.stringify(result).includes('credential'));
});
test('malformed or capped inventories stay rejected instead of turning missing rows into idle',async()=>{
 const result=await checkGithubReads({token:'secret',fetchRead:async url=>{const q=queries().find(q=>'https://api.github.com/'+q.path===url);const r=response(q);r.json=async()=>({total_count:100,workflow_runs:[]});return r;}});
 assert.equal(result.code,'GITHUB_READ_CHECK_INCOMPLETE');assert.equal(result.readAttempts,5);assert(result.rows.every(r=>r.complete===false));
});

test('actual diagnostic reader records a contradictory list and both complete pagination views without losing its initial counts',async()=>{
 let contradicted=false;const result=await checkGithubReads({token:'secret',fetchRead:async url=>{
  const relative=url.slice('https://api.github.com/'.length),base=relative.replace(/&page=[12]$/,'');
  const q=queries().find(q=>q.path===base);const r=response(q);
  if(q.kind==='list'&&q.repository==='287113535qq-cmyk/sg-capture-runner'&&q.status==='in_progress'&&!contradicted){
   contradicted=true;r.json=async()=>({total_count:1,workflow_runs:[]});
  }return r;
 }});assert.equal(result.outcome,'complete');assert.equal(result.completedFreshChecks,2);assert.equal(result.readAttempts,42);
 assert.equal(result.inventoryRechecks.length,1);const original=result.rows.find(r=>r.resolvedByPagination);
 assert.equal(original.initialReportedTotal,1);assert.equal(original.initialReturnedRows,0);assert(original.complete);
 assert.equal(result.rows.filter(r=>r.endpoint.page&&r.accepted).length,2);
});
