import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {bindPreparedCountPlan,bindPreparedCountPlanAsync} from './prepared-count-plan-binding.mjs';
import {checkPrimaryLeases} from './lease-boundary.mjs';

function fixture(){
 const base=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))['32714'];
 const name='formal-prepared-count-32714-671f5512b92219003f11c4d49c55cf616b245386d2084618e4eb333ae57125c6.json';
 const profile=JSON.parse(fs.readFileSync('config/'+name,'utf8'));
 const registry=JSON.parse(fs.readFileSync('config/prepared-count-authorizations.json','utf8'));
 const spec={activation:profile.activation,profileHash:hash(profile),planHash:profile.planHash};
 const read=p=>structuredClone(p.endsWith('prepared-count-authorizations.json')?registry:profile);
 return {base,profile,registry,spec,read,name};
}
test('bound action plan is identical across capture, lease review and later repair; legacy needs no registry read',()=>{
 const f=fixture(),plan=bindPreparedCountPlan({...f,activation:f.profile.activation});
 assert.equal(hash(plan),f.spec.planHash);assert.equal(plan.featureProfile,'huff-action-v1');
 const legacy={...f.base,target:300000,countAllocation:f.profile.activation};
 assert.deepEqual(bindPreparedCountPlan({...f,activation:f.profile.activation,spec:{planHash:hash(legacy)},
  read(){throw Error('UNEXPECTED_READ');}}),legacy);
});
test('an unregistered, altered, duplicate, foreign or mismatched action binding cannot relax lease checks',()=>{
 for(const mode of ['missing','duplicate','profile','contract','foreign','spec','activation','registry']){
  const f=fixture();
  if(mode==='missing')delete f.registry.profiles[f.name];
  if(mode==='duplicate')f.registry.profiles['duplicate']=f.registry.profiles[f.name];
  if(mode==='profile')f.profile.createdAt++;
  if(mode==='contract')f.profile.actionContract.hash='f'.repeat(64);
  if(mode==='foreign')f.profile.group='secondary';
  if(mode==='spec')f.spec.planHash='f'.repeat(64);
  if(mode==='activation')f.spec.activation='f'.repeat(64);
  if(mode==='registry')f.registry.sourceAllowance=1;
  assert.throws(()=>bindPreparedCountPlan({...f,activation:f.profile.activation}),undefined,mode);
 }
});

test('asynchronous evidence resolves the registered plan before repair review and keeps rejection checks',async()=>{
 const f=fixture(),calls=[];
 const args={...f,activation:f.profile.activation,read:async file=>{calls.push(file);return f.read(file);}};
 assert.deepEqual(await bindPreparedCountPlanAsync(args),bindPreparedCountPlan({...f,activation:f.profile.activation}));
 assert.deepEqual(calls,['config/prepared-count-authorizations.json','config/'+f.name]);
 f.registry.sourceAllowance=1;
 await assert.rejects(bindPreparedCountPlanAsync(args),/LEASE_COUNT_SCOPE/);
 const legacy={...f.base,target:300000,countAllocation:f.profile.activation};
 assert.deepEqual(await bindPreparedCountPlanAsync({...args,spec:{planHash:hash(legacy)},
  read:async()=>{throw Error('UNEXPECTED_READ');}}),legacy);
});
test('lease boundary inspects action-bound native batches and still rejects a live lease',async()=>{
 const f=fixture(),plan=bindPreparedCountPlan({...f,activation:f.profile.activation});
 const spec={...f.spec,schema:'sg-complete-count-v1',firstSequence:1,gameId:32714,trialId:plan.trialId,target:300000,maxSequence:600000,
  baselineBatchCount:0,baselineHash:hash([])};
 const pool={workers:{},nextBatchId:1,nextSequence:1,confirmed:0,
  countAllocation:{specHash:hash(spec),reserved:0,batches:{}}};
 const campaign={formalCount:{trialId:plan.trialId,activation:spec.activation},games:[{game_id:32714,status:'ready'}]};
 const store={getMany:async(c,keys)=>keys.map(k=>k.startsWith('pool:')?{_id:'primary/'+k,value:pool}:null),
  get:async(c,k)=>({value:k==='campaign'?campaign:k.endsWith(':complete')?
   {schema:'sg-complete-count-activation-v1',specHash:hash(spec)}:spec})};
 const args={store,plans:{32714:f.base},read:f.read,now:()=>100};
 assert.deepEqual(await checkPrimaryLeases(args),{pools:1,workers:0,batches:0});
 pool.workers['0']={leaseUntil:101};
 await assert.rejects(checkPrimaryLeases(args),/WORKER_LEASE_ACTIVE/);
});
