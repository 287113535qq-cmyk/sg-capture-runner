import assert from 'node:assert/strict';
import test from 'node:test';
import {authenticatedRead,githubBoundary} from '../github-boundary.mjs';
import {githubReadDiagnostic,withGithubHttpDiagnostic,withGithubListDiagnostic} from '../github-read-diagnostic.mjs';
import {protocolStopReport} from './sg-fault-code.mjs';
import {original} from '../expired-run-review.mjs';
const primary='repos/zyzuoyang/sg-capture-runner/actions/runs?status=queued&per_page=100';
const secret='PRIVATE_SESSION_TOKEN';
async function withFetch(mock,operation){
 const previous=globalThis.fetch;globalThis.fetch=mock;
 try{return await operation();}finally{globalThis.fetch=previous;}
}
for(const status of [401,403,404,429,500])test(`HTTP ${status} stays rejected once and reaches the actual stop report`,async()=>{
 let calls=0,bodyReads=0;
 await withFetch(async(url,options)=>{
  calls++;assert.equal(url,'https://api.github.com/'+primary);
  assert.equal(options.headers.Authorization,'Bearer '+secret);
  assert.equal(options.redirect,'error');assert(options.signal instanceof AbortSignal);
  return {ok:false,status,headers:new Headers({'x-ratelimit-limit':'1000','x-ratelimit-remaining':'0',
   'x-ratelimit-used':'1000','x-ratelimit-reset':'1791157000','x-ratelimit-resource':'core',
   'retry-after':'60','x-github-request-id':'ABCD:1234:EF01:5678','authorization':secret,'set-cookie':secret}),
   json(){bodyReads++;throw Error(secret);},text(){bodyReads++;throw Error(secret);}};
 },async()=>{
  await assert.rejects(authenticatedRead(secret)(primary),error=>{
   assert.equal(error.message,'GITHUB_RUN_READ_FAILED');assert.equal(error.code,'ERR_ASSERTION');
   const result=protocolStopReport(error);assert.equal(result.code,'GITHUB_RUN_READ_FAILED');
   assert.equal(result.githubRead.httpStatus,status);
   assert.deepEqual(result.githubRead.endpoint,{repository:'zyzuoyang/sg-capture-runner',kind:'active-run-list',status:'queued'});
   assert.equal(result.githubRead.headers['x-ratelimit-remaining'],'0');
   assert.equal(result.githubRead.headers['retry-after'],'60');
   assert(!JSON.stringify(result).includes(secret));assert(!('stack' in result));return true;
  });
 });
 assert.equal(calls,1);assert.equal(bodyReads,0);
});
test('successful reads retain their exact JSON result and perform one request',async()=>{
 let calls=0,reads=0;const expected={total_count:0,workflow_runs:[]};
 await withFetch(async()=>{calls++;return {ok:true,json:async()=>{reads++;return expected;}};},async()=>{
  assert.equal(await authenticatedRead(secret)(primary),expected);
 });assert.equal(calls,1);assert.equal(reads,1);
});
test('network rejection remains unknown, is never retried, and publishes no invented HTTP status',async()=>{
 let calls=0;const failure=Error('raw '+secret);
 await withFetch(async()=>{calls++;throw failure;},async()=>{
  await assert.rejects(authenticatedRead(secret)(primary),error=>{
   assert.equal(error,failure);assert.deepEqual(protocolStopReport(error),{outcome:'stopped',code:'SG_PROTOCOL_STOPPED'});return true;
  });
 });assert.equal(calls,1);
});
test('credentials and invalid paths still fail before any request',async()=>{
 let calls=0;await withFetch(async()=>{calls++;},async()=>{
  assert.throws(()=>authenticatedRead(''),/GITHUB_AUTH_REQUIRED/);
  await assert.rejects(authenticatedRead(secret)('repos/../private'),/INVALID_GITHUB_PATH/);
 });assert.equal(calls,0);
});
test('unreviewed paths, arbitrary header values and forged error metadata never enter logs',()=>{
 const error=Error('GITHUB_RUN_READ_FAILED');
 withGithubHttpDiagnostic(error,'repos/private/'+secret,{status:403,headers:new Headers({
  'x-ratelimit-limit':secret,'x-ratelimit-remaining':'-1','x-ratelimit-used':'1.5',
  'x-ratelimit-reset':'9'.repeat(17),'retry-after':'date '+secret,
  'x-ratelimit-resource':secret,'x-github-request-id':secret})});
 assert.deepEqual(protocolStopReport(error).githubRead.endpoint,{kind:'unclassified-repository-read'});
 assert.deepEqual(protocolStopReport(error).githubRead.headers,{});
 const forged=Object.assign(Error('GITHUB_RUN_READ_FAILED'),{githubReadDiagnostic:{body:secret}});
 assert.deepEqual(protocolStopReport(forged),{outcome:'stopped',code:'GITHUB_RUN_READ_FAILED'});
 assert(!JSON.stringify(protocolStopReport(error)).includes(secret));
});
test('known run and full jobs endpoints retain only the reviewed repository and numeric run ID',()=>{
 for(const [suffix,kind] of [['/37241550681','run'],['/37241550681/jobs?filter=all&per_page=100','run-jobs']]){
  const error=Error('GITHUB_RUN_READ_FAILED');withGithubHttpDiagnostic(error,
   'repos/287113535qq-cmyk/sg-capture-runner/actions/runs'+suffix,{status:404});
  assert.deepEqual(githubReadDiagnostic(error).endpoint,{repository:'287113535qq-cmyk/sg-capture-runner',kind,runId:'37241550681'});
 }
});
for(const [name,result,expected] of [
 ['page at cap',{total_count:100,workflow_runs:[]},{reportedTotal:100,returnedRows:0}],
 ['count mismatch',{total_count:2,workflow_runs:[{payload:secret}]},{reportedTotal:2,returnedRows:1}],
 ['missing list',{total_count:0},{reportedTotal:0}],
 ['noninteger total',{total_count:secret,workflow_runs:[]},{returnedRows:0}],
])test(`list rejection retains the original gate and bounded inventory evidence: ${name}`,async()=>{
 let calls=0;await assert.rejects(githubBoundary({read:async()=>{calls++;return result;},run:'999:1',
  commit:'b'.repeat(40),now:()=>original.expiresAt+600000})(),error=>{
   assert.equal(error.message,'GITHUB_RUN_LIST_TRUNCATED');
   const report=protocolStopReport(error);assert.equal(report.code,'GITHUB_RUN_LIST_TRUNCATED');
   assert.equal(report.githubRead.schema,'github-run-list-diagnostic-v1');
   for(const [key,value] of Object.entries(expected))assert.equal(report.githubRead[key],value);
   assert(!JSON.stringify(report).includes(secret));return true;
  });assert.equal(calls,10);
});
test('diagnostic parsing errors cannot replace the original rejection',()=>{
 const error=Error('GITHUB_RUN_READ_FAILED');
 assert.equal(withGithubHttpDiagnostic(error,primary,{get status(){throw Error(secret);}}),error);
 assert.equal(withGithubListDiagnostic(error,primary,null),error);
 assert.deepEqual(protocolStopReport(error),{outcome:'stopped',code:'GITHUB_RUN_READ_FAILED'});
});
