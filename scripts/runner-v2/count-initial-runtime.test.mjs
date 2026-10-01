import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {authorizeInitialCountRuntime,countMeasurementMinutes} from './count-initial-runtime.mjs';
import {countControlPolicy} from './count-control-policy.mjs';
test('real control policy admits only bound Rhino measurement refresh and admission',()=>{
 const profile={schema:'sg-formal-count-rhino-v2'},runtime='count-runtime-rhino-measurement-20261001.json';
 for(const mode of ['refresh','admit'])assert.equal(countControlPolicy(mode,profile,runtime).initialWindow,true);
 for(const mode of ['repair','amend','sessions','activate'])assert.throws(()=>countControlPolicy(mode,profile,runtime));
 for(const schema of ['sg-formal-count-rhino-v1','sg-formal-repair-profile-v2','sg-formal-count-profile-v1'])assert.throws(()=>countControlPolicy('refresh',{schema},runtime));
 assert.throws(()=>countControlPolicy('refresh',profile,undefined));
 assert.throws(()=>countControlPolicy('refresh',profile,'count-runtime-pearl-observation-20261001.json'));
 assert.equal(countControlPolicy('refresh',{schema:'sg-formal-repair-profile-v2'},'count-runtime-pearl-observation-20261001.json').isRepair,true);
});
test('measurement maintenance selects formal profile while old refresh keeps repair profile',()=>{
 const workflow=fs.readFileSync('.github/workflows/demo-maintenance.yml','utf8');
 const step=workflow.slice(workflow.indexOf('      - name: Preserve healthy count allocation'),workflow.indexOf('      - name: Isolate interrupted pilot'));
 assert(step.includes("(inputs.runtime_profile == 'count-runtime-rhino-measurement-20261001.json' || inputs.runtime_profile == 'count-runtime-rhino-two-observation-20261001.json' || inputs.runtime_profile == 'count-runtime-rhino-continuous-20261001.json' || inputs.runtime_profile == 'count-runtime-rhino-ag-continuation-20261001.json' || inputs.runtime_profile == 'count-runtime-rhino-ag-continuation-entryfix-20261001.json' || inputs.runtime_profile == 'count-runtime-rhino-ag-dispatchfix-20261001.json') && inputs.formal_profile || inputs.repair_profile"));
 assert(step.includes("SG_COUNT_RUNTIME_PROFILE: ${{ inputs.runtime_profile != 'none' && inputs.runtime_profile || '' }}"));
});

function fixture(){
 const docs=new Map(),commit='b'.repeat(40),fromCommit='a'.repeat(40),activation='c'.repeat(64);
 const plan={gameId:32799,trialId:'sg_r1_20261001_32799',adapter:'rhino-wms-v1',target:300000,buy:0,phase:1,countAllocation:activation};
 const profile={schema:'sg-formal-count-rhino-v2',activation};
 const set=(c,k,v)=>docs.set(c+'/'+k,{value:structuredClone(v)}),batches={};
 for(let id=1;id<=36;id++){
  const count=id===36?11:4,b={id,worker:0,start:(id-1)*100+1,end:id*100,sessionHash:hash(id),
   journaled:(id-1)*100+count,checkpoint:(id-1)*100+count,pending:null,leaseUntil:0,
   ...(id===1?{failure:'PROTOCOL_VALIDATION_FAILED'}:{})};
  set('state',`batch:${plan.trialId}:${id}`,b);batches[id]={id,worker:0,start:b.start,end:b.end,
   sessionHash:b.sessionHash,closed:true,complete:count,evidenceHash:hash(b)};
 }
 const spec={schema:'sg-complete-count-v1',activation,planHash:hash(plan),gameId:32799,trialId:plan.trialId,
  target:300000,maxSequence:600000,firstSequence:3601,baselineBatchCount:36,baselineHash:hash(Object.values(batches)),
  profileHash:hash(profile),commit:fromCommit};
 set('journal',`complete-count:${plan.trialId}:${activation}`,spec);
 set('journal',`complete-count:${plan.trialId}:${activation}:complete`,{schema:'sg-complete-count-activation-v1',
  specHash:hash(spec),trialId:plan.trialId,planHash:hash(plan),commit:fromCommit,run:'77:1'});
 const pool={enabled:true,confirmed:151,nextBatchId:37,nextSequence:3601,workers:{},
  countAllocation:{specHash:hash(spec),reserved:0,batches}},campaign={enabled:true,activeGame:32799,
  formalCount:{activation},validationLimit:0};
 set('state','pool:'+plan.trialId,pool);set('state','campaign',campaign);
 const revision={schema:'sg-count-initial-runtime-v1',profileHash:hash(profile),activation,planHash:hash(plan),
  completePreserved:151,remainingComplete:299849,captureMinutes:20,newBetAllowance:0,createdAt:1,expiresAt:1000,
  sourceRun:'77:1',fromCommit,poolHash:hash(pool),campaignHash:hash(campaign)};
 const store={get:async(c,k)=>structuredClone(docs.get(c+'/'+k)),getMany:async(c,ks)=>ks.map(k=>structuredClone(docs.get(c+'/'+k))),
  create:async(c,k,v,opts)=>{assert(opts.immutable);assert(!docs.has(c+'/'+k));set(c,k,v);}};
 const ended={id:77,run_attempt:1,status:'completed',conclusion:'success',head_sha:fromCommit,
  repository:{full_name:'zyzuoyang/sg-capture-runner'},path:'.github/workflows/demo-maintenance.yml'};
 return {docs,pool,campaign,revision,args:{store,plan,profile,revision,ended,jobs:{total_count:1,jobs:[{status:'completed',conclusion:'success'}]},commit,run:'88:1',boundary:async()=>{},now:()=>100}};
}
test('initial measurement runtime adds only permission and preserves old failed batch',async()=>{
 const f=fixture(),before=new Map([...f.docs].map(([k,v])=>[k,hash(v)]));
 const r=await authorizeInitialCountRuntime(f.args);assert.equal(countMeasurementMinutes(f.revision,r),20);
 assert.equal(r.newBetAllowance,0);assert.equal(f.docs.size,before.size+1);
 for(const[k,h]of before)assert.equal(hash(f.docs.get(k)),h);
});
for(const bad of ['failed-run','borrowed-run','missing-job','expired','target-reset','long-window','batch-changed','source-started','concurrent-change'])
test('initial measurement refuses '+bad,async()=>{
 const f=fixture(),a=f.args;
 if(bad==='failed-run')a.ended.conclusion='failure';
 if(bad==='borrowed-run')a.ended.id=78;
 if(bad==='missing-job')a.jobs.jobs=[];
 if(bad==='expired')a.now=()=>1001;
 if(bad==='target-reset')a.revision.remainingComplete=300000;
 if(bad==='long-window')a.revision.captureMinutes=240;
 if(bad==='batch-changed')f.docs.get(`state/batch:${a.plan.trialId}:1`).value.failure=null;
 if(bad==='source-started'){f.docs.get('state/pool:'+a.plan.trialId).value.workers={0:{}};a.revision.poolHash=hash(f.docs.get('state/pool:'+a.plan.trialId).value);}
 if(bad==='concurrent-change'){let n=0;a.boundary=async()=>{if(++n===2)f.docs.get('state/campaign').value.enabled=false;};}
 const size=f.docs.size;await assert.rejects(authorizeInitialCountRuntime(a));assert.equal(f.docs.size,size);
});
