import test from 'node:test';import assert from 'node:assert/strict';
import {authenticatedRead} from '../github-boundary.mjs';
import {githubReadDiagnostic} from '../github-read-diagnostic.mjs';
const path='repos/zyzuoyang/sg-capture-runner/actions/runs?status=in_progress&per_page=100',etag='"0123456789abcdef0123456789abcdef"',other='"abcdef0123456789abcdef0123456789"';
function response(status,value,tag=etag){return {status,ok:status===200,headers:new Headers(tag?{etag:tag}:{}),async json(){assert.equal(status,200);return value}};}
test('every unchanged read still sends a fresh authenticated GET and accepts only the exact server-confirmed ETag',async()=>{
 const calls=[];let bodies=0;const value={total_count:0,workflow_runs:[]};
 const read=authenticatedRead('private',{fetchRead:async(url,options)=>{
  calls.push(options);assert.equal(url,'https://api.github.com/'+path);assert.equal(options.headers.Authorization,'Bearer private');assert.equal(options.redirect,'error');assert(options.signal instanceof AbortSignal);
  const r=response(calls.length===1?200:304,value);if(r.status===200){r.json=async()=>{bodies++;return value;}}return r;
 }});assert.equal(await read(path),value);assert.deepEqual(await read(path),value);assert.deepEqual(await read(path),value);
 assert.equal(calls.length,3);assert.equal(bodies,1);assert.equal(calls[0].headers['If-None-Match'],undefined);assert.equal(calls[1].headers['If-None-Match'],etag);
});
test('callers cannot mutate the cached source representation or later 304 results',async()=>{
 let n=0;const read=authenticatedRead('private',{fetchRead:async()=>response(++n===1?200:304,{workflow_runs:[{id:1}]})});
 const first=await read(path);first.workflow_runs[0].id=999;const second=await read(path);assert.equal(second.workflow_runs[0].id,1);second.workflow_runs.length=0;assert.equal((await read(path)).workflow_runs.length,1);
});
test('a changed 200 response replaces the ETag and identity; no old state is treated as current',async()=>{
 const calls=[];const read=authenticatedRead('private',{fetchRead:async(url,o)=>{calls.push(o.headers);return response(calls.length===3?304:200,{owner:calls.length===1?'old':'new'},calls.length===1?etag:other);}});
 assert.equal((await read(path)).owner,'old');assert.equal((await read(path)).owner,'new');assert.equal((await read(path)).owner,'new');assert.equal(calls[2]['If-None-Match'],other);
});
test('304 without a prior representation, matching tag, or valid quoted tag is rejected without reading a body',async()=>{
 for(const invalid of [undefined,'"different0000000000000000000000"','not-an-etag']){
  let n=0;const read=authenticatedRead('private',{fetchRead:async()=>++n===1?response(200,{ok:true}):response(304,undefined,invalid??null)});await read(path);
  await assert.rejects(read(path),e=>e.message==='GITHUB_RUN_READ_FAILED'&&githubReadDiagnostic(e).httpStatus===304);assert.equal(n,2);
 }
 await assert.rejects(authenticatedRead('private',{fetchRead:async()=>response(304) })(path),/GITHUB_RUN_READ_FAILED/);
});
test('known HTTP failure and unknown network outcome never fall back to cached data or retry',async()=>{
 for(const failure of [response(403),Error('private arbitrary network text')]){
  let n=0;const read=authenticatedRead('private',{fetchRead:async()=>{n++;if(n===1)return response(200,{ok:true});if(failure instanceof Error)throw failure;return failure;}});await read(path);
  await assert.rejects(read(path),e=>failure instanceof Error?e===failure:e.message==='GITHUB_RUN_READ_FAILED');assert.equal(n,2);
 }
});
test('cache entries are exact URL and repository scoped and are bounded without weakening a cache-miss read',async()=>{
 const sent=[];const read=authenticatedRead('private',{maxEntries:1,fetchRead:async(url,o)=>{sent.push(o.headers['If-None-Match']);return response(200,{ok:true})}});
 await read(path);await read(path.replace('zyzuoyang','287113535qq-cmyk'));await read(path);assert.deepEqual(sent,[undefined,undefined,undefined]);
});
test('unclassified paths and missing or unsafe tags retain the original uncached single-read behavior',async()=>{
 for(const p of [path,'repos/other/sg-capture-runner/actions/runs/123']){
  const sent=[];const read=authenticatedRead('private',{fetchRead:async(url,o)=>{sent.push(o.headers['If-None-Match']);return response(200,{ok:true},p===path?'unsafe':etag)}});
  await read(p);await read(p);assert.deepEqual(sent,[undefined,undefined]);
 }
});
test('invalid authentication, paths and cache bounds fail before a request',async()=>{
 let calls=0;const fetchRead=async()=>{calls++;return response(200,{})};assert.throws(()=>authenticatedRead('',{fetchRead}),/AUTH/);assert.throws(()=>authenticatedRead('private',{fetchRead,maxEntries:65}),/CACHE_BOUND/);
 await assert.rejects(authenticatedRead('private',{fetchRead})('repos/../secret'),/INVALID_GITHUB_PATH/);assert.equal(calls,0);
});
