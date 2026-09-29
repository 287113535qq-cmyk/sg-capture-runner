import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {PendingFirst,pendingFirstPlan} from './pending-first.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
const out=spawnSync(process.env.PYTHON||'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_demon_fields import sample,PLAN;print(json.dumps(dict(raw=sample(),plan=PLAN)))"],{encoding:'utf8'});
assert.equal(out.status,0,out.stderr);const source=JSON.parse(out.stdout);
function fixture(stage='capture') {
  const plan=source.plan,commit='c'.repeat(40),proofHash='d'.repeat(64),identity={commitSha:commit,sessionHash:'e'.repeat(64)},docs=new Map(),mongo=new Map();let now=1000;
  const pending={sequence:1,attempt:'original',awaiting:null,raw:{...structuredClone(source.raw),steps:structuredClone(source.raw.steps.slice(0,1))}};
  const batch={id:1,worker:0,sessionHash:identity.sessionHash,start:1,end:100,journaled:0,checkpoint:0,pending,protocolResume:{proofHash}};
  const spec=pendingFirstPlan({plan,batches:[{value:batch}],proofHash,commit,createdAt:now,expiresAt:now+7200000});
  const put=(c,k,value)=>docs.set(c+'/'+k,{value:structuredClone(value)}),get=(c,k)=>docs.get(c+'/'+k)?.value;
  put('state','campaign',{enabled:true,activeGame:32739,validationLimit:10,protocolValidation:{phase:'short',gameId:32739,proofHash,commit,runKey:'capture-run:1:1',pendingFirst:hash(spec)}});
  put('state','pool:'+plan.trialId,{nextBatchId:2});put('state',`batch:${plan.trialId}:1`,batch);put('journal','pending-first:'+proofHash,spec);
  let verified=0;
  const gate=new PendingFirst({plan,stage,runKey:'capture-run:1:1',now:()=>now,
    store:{get:async(c,k)=>docs.get(c+'/'+k),getMany:async(c,ks)=>ks.map(k=>docs.get(c+'/'+k))},
    transport:{request:async(op,r)=>{assert.equal(op,'rounds_read');return r.ids.filter(id=>mongo.has(id)).map(id=>mongo.get(id));}},
    analyzer:{call:async r=>{assert.equal(r.op,'verify');verified++;}}});
  function finish(){
    const r={_id:'receipt',trialId:plan.trialId,batchId:1,shardId:0,sourceSessionHash:identity.sessionHash,attempt:'original',sequence:1,fixtureOnly:false,buy:0,bonus:2,raw:structuredClone(source.raw)};
    put('journal',receiptKey(plan.trialId,1),r);mongo.set(r._id,structuredClone(r));Object.assign(get('state',`batch:${plan.trialId}:1`),{journaled:1,checkpoint:1,pending:null,protocolResume:null});return r;
  }
  return {gate,plan,identity,spec,put,get,mongo,finish,verified:()=>verified,advance:ms=>{now+=ms;}};
}
test('capture remains closed until original identity, terminal protocol and Mongo readback all agree',async()=>{
  const f=fixture();await assert.rejects(f.gate.admit(f.identity,0),/UNSETTLED/);
  f.finish();const a=await f.gate.admit(f.identity,0);assert.equal(a.limit,9);assert.equal(f.verified(),1);
  assert.equal((await f.gate.admit({...f.identity,sessionHash:'f'.repeat(64)},1)).limit,10);
});
test('wrong original attempt/prefix, absent readback and unfinished terminal never open new BET',async()=>{
  for(const mode of ['attempt','prefix','mongo','checkpoint','terminal']){
    const f=fixture();f.finish();const r=f.get('journal',receiptKey(f.plan.trialId,1));
    if(mode==='attempt')r.attempt='replacement';
    if(mode==='prefix')r.raw.steps[0].responsePayload+='&changed=1';
    if(mode==='mongo')f.mongo.clear();
    if(mode==='checkpoint')f.get('state',`batch:${f.plan.trialId}:1`).checkpoint=0;
    if(mode==='terminal')r.raw.steps.pop();
    await assert.rejects(f.gate.admit(f.identity,1));
  }
});
test('resume owner can join alone but cannot authorize INIT or new BET',async()=>{
  const f=fixture('resume');assert.equal((await f.gate.admit(f.identity,0)).limit,1);
  assert.throws(()=>f.gate.beforeNewRequest(),/NEW_REQUEST_FORBIDDEN/);
  assert.throws(()=>f.gate.checkLease({id:2,worker:0}),/BATCH_CHANGED/);
  await assert.rejects(f.gate.admit(f.identity,1),/WRONG_WORKER/);
  f.finish();await assert.rejects(f.gate.admit(f.identity,0),/ORIGINAL_CHANGED/);
});
test('new run, changed code, stale proof, omitted stage and changed private evidence reject before source work',async()=>{
  for(const mode of ['run','code','expiry','stage','proof']){
    const f=fixture('resume');
    if(mode==='run')f.gate.runKey='capture-run:1:2';
    if(mode==='code')f.identity.commitSha='a'.repeat(40);
    if(mode==='expiry')f.advance(7200000);
    if(mode==='stage')f.gate.stage=undefined;
    if(mode==='proof')f.get('journal','pending-first:'+f.spec.proofHash).entries[0].worker=1;
    await assert.rejects(f.gate.admit(f.identity,0));
  }
});
test('already completed staged rounds count toward the original worker quota; overruns refuse',async()=>{
  const f=fixture();f.finish();const b=f.get('state',`batch:${f.plan.trialId}:1`);
  b.journaled=10;assert.equal((await f.gate.admit(f.identity,0)).limit,0);
  b.journaled=11;await assert.rejects(f.gate.admit(f.identity,0),/QUOTA_CHANGED/);
});
test('ordinary campaigns need no staged barrier; stage alone grants no authority',async()=>{
  const f=fixture();f.get('state','campaign').protocolValidation=null;f.gate.stage=undefined;
  assert.equal(await f.gate.admit(f.identity,0),null);
  f.gate.stage='resume';await assert.rejects(f.gate.admit(f.identity,0),/NOT_AUTHORIZED/);
});
test('workflow uses a finite two-owner stage before the twenty-worker capture matrix, without occupying waiting runners',()=>{
  const yaml=createRequire(import.meta.url)('../../collector/node_modules/js-yaml');
  const w=yaml.load(fs.readFileSync('.github/workflows/trial-300k.yml','utf8'));
  const resume=w.jobs['pending-resume'],capture=w.jobs['pending-capture'];
  assert.deepEqual(resume.strategy.matrix.shard,[0,14]);assert.equal(resume.strategy['max-parallel'],2);
  assert.equal(resume.env.SG_PENDING_FIRST_STAGE,'resume');assert.equal(capture.env.SG_PENDING_FIRST_STAGE,'capture');
  assert.equal(capture.needs,'pending-resume');assert.match(capture.if,/needs.pending-resume.result == 'success'/);
  assert.equal(capture.strategy['max-parallel'],20);assert.match(resume.if,/inputs.round_one_limit == '10'/);
  assert.match(resume.if,/inputs.role == 'pending-first-short'/);assert(!w.jobs.trial.env.SG_PENDING_FIRST_STAGE);
  assert(w.jobs.verify.needs.includes('pending-capture'));assert(w.jobs.verify.needs.includes('pending-resume'));
});
