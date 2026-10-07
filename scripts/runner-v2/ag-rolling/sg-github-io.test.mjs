import test from 'node:test';
import assert from 'node:assert/strict';
import {conditionalGithubRead} from '../github-conditional-read.mjs';
import {githubReadDiagnostic,githubIoCode} from '../github-read-diagnostic.mjs';
const path='repos/zyzuoyang/sg-capture-runner/actions/runs/37632045282';
const secret='PRIVATE_RAW_MESSAGE_TOKEN';
const transient=()=>new TypeError(secret,{cause:Object.assign(Error(secret),{code:'ECONNRESET',url:secret})});
const ok=()=>({ok:true,status:200,headers:new Headers({etag:'"0123456789abcdef"'}),json:async()=>({id:37632045282})});
test('recognized transient GET retries once and returns only a fresh successful response',async()=>{
 let n=0;const delays=[];
 const read=conditionalGithubRead(secret,{sleep:async ms=>delays.push(ms),fetchRead:async(u,o)=>{
  assert.equal(o.method,'GET');assert.equal(o.redirect,'error');assert(o.signal instanceof AbortSignal);
  if(++n===1)throw transient();return ok();
 }});
 assert.deepEqual(await read(path),{id:37632045282});assert.equal(n,2);assert.deepEqual(delays,[250]);
});
test('retry exhaustion preserves the second exception and only fixed safe diagnostic fields',async()=>{
 let n=0;const failures=[transient(),transient()];
 const read=conditionalGithubRead(secret,{sleep:async()=>{},fetchRead:async()=>{throw failures[n++];}});
 await assert.rejects(read(path),e=>{
  assert.equal(e,failures[1]);const d=githubReadDiagnostic(e);
  assert.equal(d.attempt,2);assert.equal(d.phase,'fetch');assert.equal(d.ioCode,'ECONNRESET');assert.equal(d.retryScheduled,false);
  assert(!JSON.stringify(d).includes(secret));assert(!('httpStatus' in d));return true;
 });assert.equal(n,2);
});
test('malformed JSON and unclassified rejection fail once without retry or raw payload leakage',async()=>{
 for(const body of [false,true]){
  let n=0;const failure=body?new SyntaxError(secret):Error(secret);
  const read=conditionalGithubRead(secret,{sleep:async()=>assert.fail('unexpected retry'),fetchRead:async()=>{
   n++;if(!body)throw failure;return {...ok(),json:async()=>{throw failure;}};
  }});
  await assert.rejects(read(path),e=>{assert.equal(e,failure);const d=githubReadDiagnostic(e);
   assert.equal(d.phase,body?'body':'fetch');assert.equal(d.ioCode,null);assert(!JSON.stringify(d).includes(secret));return true;});
  assert.equal(n,1);
 }
});
test('a known interrupted response body is retried once with its discarded cache cleared',async()=>{
 let n=0;const headers=[];
 const read=conditionalGithubRead(secret,{sleep:async()=>{},fetchRead:async(u,o)=>{
  headers.push(o.headers['If-None-Match']);n++;
  return n===2?{...ok(),json:async()=>{throw transient();}}:ok();
 }});
 await read(path);await read(path);assert.equal(n,3);
 assert.deepEqual(headers,[undefined,'"0123456789abcdef"',undefined]);
});
test('a transient cache failure cannot accept a subsequent 304 without a fresh body',async()=>{
 let n=0;const read=conditionalGithubRead(secret,{sleep:async()=>{},fetchRead:async()=>{
  n++;if(n===2)throw transient();if(n===3)return {...ok(),status:304,ok:false};return ok();
 }});await read(path);await assert.rejects(read(path),/GITHUB_RUN_READ_FAILED/);assert.equal(n,3);
});
test('HTTP refusal is never retried even with an error-like code on the response',async()=>{
 let n=0;const read=conditionalGithubRead(secret,{sleep:async()=>assert.fail(),fetchRead:async()=>{
  n++;return {...ok(),ok:false,status:503,code:'ECONNRESET'};
 }});await assert.rejects(read(path),e=>githubReadDiagnostic(e).httpStatus===503);assert.equal(n,1);
});
test('overall budget prevents a retry when first failure or backoff consumes it',async()=>{
 for(const exhaustedDuringSleep of [false,true]){
  let clock=0,n=0;const failure=transient();
  const read=conditionalGithubRead(secret,{now:()=>clock,sleep:async()=>{clock=20000;},fetchRead:async()=>{
   n++;clock=exhaustedDuringSleep?19000:19900;throw failure;
  }});
  await assert.rejects(read(path),e=>e===failure);assert.equal(n,1);assert.equal(githubReadDiagnostic(failure).retryScheduled,false);
 }
});
test('throwing exception getters cannot replace the original failure or cause retry',async()=>{
 let n=0;const failure=Object.defineProperty(Error(secret),'cause',{get(){throw Error('getter '+secret);}});
 assert.equal(githubIoCode(failure),null);
 const read=conditionalGithubRead(secret,{fetchRead:async()=>{n++;throw failure;}});
 await assert.rejects(read(path),e=>e===failure);assert.equal(n,1);
});
