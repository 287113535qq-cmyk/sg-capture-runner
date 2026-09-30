import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {rebindPyramidsUnstarted,pyramidsUnstartedScene} from './pyramids-zero-source.mjs';
import {demoRuntimeCommit} from './demo-runtime.mjs';
import {DemoFresh} from './demo-fresh.mjs';
const original=JSON.parse(fs.readFileSync('config/demo-pilot-pyramids-20261001.json','utf8'));
const old='f0a531912a963acb6ad72cf695d4a60e605c73fa',commit='e'.repeat(40);
async function fixture(){
 const basePlan=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))[32721],plan={...basePlan,demoGeneration:original.generation},trial=plan.trialId,docs=new Map();
 const spec={schema:'sg-demo-generation-v1',group:'secondary',workerOffset:20,commit:old,run:'36772084996:1',trialId:trial,gameId:32721,generation:plan.demoGeneration,planHash:hash(plan),newBetAllowance:100,completePreserved:1262,workers:20,perWorker:5,firstBatchId:13,oldSessions:['old-session'],createdAt:original.createdAt,expiresAt:original.expiresAt,activationStage:{key:`next-demo-game:${trial}:${plan.demoGeneration}`,profileHash:hash(original)}};
 const campaign={group:'secondary',enabled:true,activeGame:32721,validationLimit:5,games:[{game_id:32721,status:'active'}],protocolValidation:{phase:'short',commit:old,runKey:null,generation:plan.demoGeneration,demoFresh:hash(spec)}};
 const pool={enabled:true,confirmed:1262,nextBatchId:13,workers:{},planHash:hash(plan),demoGeneration:{specHash:hash(spec)}};
 const set=(c,k,v)=>docs.set(c+'/'+k,{value:structuredClone(v)}),store={get:async(c,k)=>docs.get(c+'/'+k),getMany:async(c,ks)=>ks.map(k=>docs.get(c+'/'+k)),create:async(c,k,v)=>{assert(!docs.has(c+'/'+k));set(c,k,v);},update:async(c,k,fn)=>set(c,k,await fn(structuredClone(docs.get(c+'/'+k).value)))};
 set('state','campaign',campaign);set('state','pool:'+trial,pool);
 for(let i=1;i<=12;i++)set('state',`batch:${trial}:${i}`,{id:i,worker:20,checkpoint:i,journaled:i,leaseUntil:0});
 set('journal',`demo-generation:${trial}:${plan.demoGeneration}`,spec);set('journal',`demo-generation:${trial}:${plan.demoGeneration}:complete`,{schema:'sg-demo-generation-complete-v1',specHash:hash(spec),commit:old,run:spec.run});
 set('journal',spec.activationStage.key+':complete',{schema:'sg-next-demo-game-complete-v1',profileHash:hash(original),generation:plan.demoGeneration,commit:old,run:spec.run,newBetAllowance:100,sourceRequests:0,completePreserved:1262});
 const records=Array.from({length:1262},(_,i)=>({trialId:trial,sequence:i+1,raw:{synthetic:true}})),transport={request:async(op,{after})=>{assert.equal(op,'rounds_scan');return structuredClone(records.filter(r=>r.sequence>after).slice(0,100));}},parser={call:async()=>({verified:true})};
 const profile={schema:'sg-secondary-unstarted-runtime-v1',gameId:32721,group:'secondary',sourceRunKey:null,sourceActivationRun:'36772084996:1',originalCommit:old,sourceProfileHash:hash(original),generation:plan.demoGeneration,planHash:hash(plan),createdAt:original.createdAt+1,expiresAt:original.expiresAt,newBetAllowance:0,retainedBetAllowance:100,completePreserved:1262};
 profile.sceneHash=hash(await pyramidsUnstartedScene({store,transport,plan}));
 return {docs,records,args:{store,transport,parser,basePlan,plan,original,profile,boundary:async()=>{},commit,run:'999:1',now:()=>original.createdAt+1000},spec};
}
test('zero-source dependency repair preserves 1262 records generation and 100 original allowance then admits fresh secondary',async()=>{
 const f=await fixture(),r=await rebindPyramidsUnstarted(f.args);assert.equal(r.newBetAllowance,0);assert.equal(r.retainedBetAllowance,100);
 const c=f.docs.get('state/campaign').value;assert.equal(await demoRuntimeCommit({...f.args,campaign:c,spec:f.spec}),commit);
 c.protocolValidation.runKey='capture-run:999:1';const fresh=new DemoFresh({...f.args,stage:'fresh',runKey:'capture-run:999:1'});
 assert.equal((await fresh.admit({commitSha:commit,shardId:20,sessionHash:'new-session'},20)).limit,5);
 await assert.rejects(fresh.admit({commitSha:commit,shardId:20,sessionHash:'old-session'},20),/OLD_SESSION/);
 assert.equal(f.records.length,1262);assert.equal(f.docs.get('journal/'+`demo-generation:${f.args.plan.trialId}:${original.generation}`).value.commit,old);
 await assert.rejects(rebindPyramidsUnstarted(f.args));
});
test('consumed changed partial expired or unverified scene rejects runtime repair',async()=>{
 for(const reason of ['bound','worker','batch','records','expiry','python','partial','profile']){
  const f=await fixture(),c=f.docs.get('state/campaign').value,p=f.docs.get('state/pool:'+f.args.plan.trialId).value;
  if(reason==='bound')c.protocolValidation.runKey='capture-run:36764738887:1';if(reason==='worker')p.workers[20]={};
  if(reason==='batch')p.nextBatchId=14;if(reason==='records')f.records.push({trialId:f.args.plan.trialId,sequence:1263});if(reason==='expiry')f.args.now=()=>original.expiresAt;
  if(reason==='python')f.args.parser.call=async()=>({verified:false});if(reason==='profile')f.args.profile.retainedBetAllowance=101;
  if(reason==='partial')f.docs.set('journal/'+`demo-zero-source-rebind:${f.args.plan.trialId}:${original.generation}:before`,{value:{}});
  const before=hash([...f.docs]);await assert.rejects(rebindPyramidsUnstarted(f.args));assert.equal(hash([...f.docs]),before,reason);
 }
});
test('paged records reject truncation and nonadvancing cursor',async()=>{
 for(const kind of ['truncate','repeat']){const f=await fixture(),request=f.args.transport.request;
 f.args.transport.request=async(op,args)=>{const rows=await request(op,args);return kind==='truncate'&&args.after===100?[]:kind==='repeat'&&args.after>0?f.records.slice(0,100):rows;};
 await assert.rejects(pyramidsUnstartedScene(f.args));}
});
