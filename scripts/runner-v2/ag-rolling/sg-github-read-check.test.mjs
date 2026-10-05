import test from 'node:test';
import assert from 'node:assert/strict';
import {checkGithubReads,queries} from './sg-github-read-check.mjs';
function response(q,status=200){return {ok:status===200,status,headers:new Headers({'x-ratelimit-limit':'1000','x-ratelimit-remaining':'700','x-ratelimit-resource':'core','authorization':'private'}),
 async text(){throw Error('BODY_READ_FORBIDDEN')},async json(){return q.kind==='list'?{total_count:0,workflow_runs:[]}:q.kind==='jobs'?{total_count:43,jobs:Array(43).fill({})}:{id:q.run,run_attempt:1,head_sha:q.commit,repository:{full_name:q.repository},status:'completed'};}};}
test('fixed job-token diagnosis checks both repositories and all target identities once, exposing bounded evidence only',async()=>{
 const seen=[];const result=await checkGithubReads({token:'secret',fetchRead:async(url,options)=>{
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer secret');
  const q=queries().find(q=>'https://api.github.com/'+q.path===url);assert(q);seen.push(q.path);return response(q);
 }});assert.equal(result.outcome,'complete');assert.equal(seen.length,20);assert.equal(new Set(seen).size,20);
 assert.equal(result.readAttempts,20);assert.equal(result.sourceRequests+result.nativeWrites+result.dispatches+result.retries,0);
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
