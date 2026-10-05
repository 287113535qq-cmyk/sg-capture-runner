import test from 'node:test';import assert from 'node:assert/strict';
import {authenticatedRead,githubBoundary} from '../github-boundary.mjs';
import {completeActiveInventoryRead} from '../github-active-inventory.mjs';
import {githubReadDiagnostic} from '../github-read-diagnostic.mjs';
import {original} from '../expired-run-review.mjs';
const path='repos/287113535qq-cmyk/sg-capture-runner/actions/runs?status=in_progress&per_page=100';
const empty={total_count:0,workflow_runs:[]},bad={total_count:1,workflow_runs:[]};
const response=v=>({status:200,ok:true,headers:new Headers({etag:'"0123456789abcdef0123456789abcdef"'}),json:async()=>v});
test('known contradictory JSON obtains a complete fresh first page and matching empty second page',async()=>{
 const calls=[],observations=[];const read=authenticatedRead('private',{onInventoryRecheck:x=>observations.push(x),fetchRead:async(url,o)=>{
  assert.equal(o.headers.Authorization,'Bearer private');assert.equal(o.redirect,'error');calls.push(url);
  return response(calls.length===1?bad:empty);
 }});assert.deepEqual(await read(path),empty);assert.deepEqual(calls.map(x=>x.slice('https://api.github.com/'.length)),[path,path+'&page=1',path+'&page=2']);
 assert.equal(observations.length,1);assert.equal(observations[0].initialReportedTotal,1);assert.equal(observations[0].independentCompleteInventory,true);
});
test('still-incomplete first page, changed second total, or a second-page row stop without further reads',async()=>{
 for(const [later,n] of [[bad,2],[{total_count:1,workflow_runs:[]},3],[{total_count:0,workflow_runs:[{id:9}]},3]]){
  let calls=0;const read=completeActiveInventoryRead(async()=>{calls++;return calls===1?bad:calls===2&&n===3?empty:later});
  await assert.rejects(read(path),e=>e.message==='GITHUB_RUN_LIST_TRUNCATED'&&githubReadDiagnostic(e).endpoint.page===(n===2?1:2));assert.equal(calls,n);
 }
});
test('HTTP refusal and unknown outcomes in any read are never retried or replaced by prior empty data',async()=>{
 for(const stopAt of [1,2,3])for(const network of [false,true]){
  let calls=0;const unknown=Error('unknown');const read=authenticatedRead('private',{fetchRead:async()=>{
   calls++;if(calls===stopAt){if(network)throw unknown;return {status:403,ok:false,headers:new Headers(),json:async()=>assert.fail('body must not be read')};}
   return response(calls===1?bad:empty);
  }});await assert.rejects(read(path),e=>network?e===unknown:e.message==='GITHUB_RUN_READ_FAILED');assert.equal(calls,stopAt);
 }
});
test('complete, capped, malformed, unreviewed and overfull lists retain one-read behavior',async()=>{
 for(const value of [empty,{total_count:100,workflow_runs:[]},{total_count:'1',workflow_runs:[]},{total_count:1,workflow_runs:null},{total_count:0,workflow_runs:[{id:9}]}]){
  let calls=0;assert.equal(await completeActiveInventoryRead(async()=>{calls++;return value})(path),value);assert.equal(calls,1);
 }
 let calls=0;assert.equal(await completeActiveInventoryRead(async()=>{calls++;return bad})(path.replace('287113535qq-cmyk','other')),bad);assert.equal(calls,1);
});
test('a recovered list containing another active run is still rejected by the original boundary',async()=>{
 const other={total_count:1,workflow_runs:[{id:99}]};const current='123:1',commit='a'.repeat(40);let queried=[];
 const read=completeActiveInventoryRead(async p=>{queried.push(p);
  if(p===path)return bad;if(p===path+'&page=1')return other;if(p===path+'&page=2')return {...empty,total_count:1};
  return empty;
 });await assert.rejects(githubBoundary({read,run:current,commit,now:()=>original.expiresAt+300001})(),/OTHER_RUN_ACTIVE/);
 assert(queried.includes(path+'&page=1'));assert(queried.includes(path+'&page=2'));
});
test('contradictory initial representations are not cached for later 304 reuse',async()=>{
 const headers=[];let n=0;const read=authenticatedRead('private',{fetchRead:async(url,o)=>{headers.push(o.headers['If-None-Match']);return response(++n===1?bad:empty)}});
 await read(path);await read(path);assert.equal(headers[3],undefined);
});
