import test from 'node:test';import assert from 'node:assert/strict';
import {finalizeEndedSource} from './ended-source-finalize.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
function fixture(){
 const docs=new Map(),activation='a'.repeat(64),commit='b'.repeat(40),profile={activation};
 const plan={gameId:32721,trialId:'sg_r1_20260928_32721',phase:1,buy:0,target:299850,countAllocation:activation};
 const set=(c,k,value)=>docs.set(c+'/'+k,{value:structuredClone(value)});
 const spec={schema:'sg-complete-count-v1',activation,commit,planHash:hash(plan),gameId:32721,trialId:plan.trialId,
  profileHash:hash(profile),target:plan.target,maxSequence:600000,firstSequence:1,baselineBatchCount:0,baselineHash:hash([])};
 set('journal',`complete-count:${plan.trialId}:${activation}`,spec);
 set('journal',`complete-count:${plan.trialId}:${activation}:complete`,{schema:'sg-complete-count-activation-v1',specHash:hash(spec),trialId:plan.trialId,planHash:hash(plan),commit});
 set('journal',`count-run:${plan.trialId}:55:1`,{schema:'sg-count-run-v1',activation,commit,run:'55:1',profileHash:hash(profile)});
 set('state','capture-run:55:1',{gameId:32721});
 const pool={enabled:false,failure:'PROTOCOL_VALIDATION_FAILED',drainingProtocol:true,confirmed:0,nextBatchId:2,nextSequence:101,
  workers:{20:{activeBatch:{id:1},leaseUntil:0}},countAllocation:{specHash:hash(spec),reserved:100,batches:{1:{id:1,worker:20,start:1,end:100,closed:false,complete:0,evidenceHash:null,sessionHash:'c'.repeat(64)}}}};
 set('state','pool:'+plan.trialId,pool);set('state',`batch:${plan.trialId}:1`,{checkpoint:10,journaled:10,pending:null,pendingOriginal:null});
 set('state','campaign',{activeGame:32721,games:[{game_id:32721,status:'parking-protocol'}]});
 const store={get:async(c,k)=>structuredClone(docs.get(c+'/'+k)),getMany:async(c,keys)=>keys.map(k=>structuredClone(docs.get(c+'/'+k)))};
 let calls=0;
 const campaign={finalizeStoppedRun:async(key,options)=>{assert.equal(key,'capture-run:55:1');assert.equal(options.waitMs,300000);calls++;
  set('state','campaign',{activeGame:null,games:[{game_id:32721,status:'parked-protocol',repairKey:'fixture-repair'}]});}};
 const ended={id:55,run_attempt:1,head_sha:commit,status:'completed',conclusion:'failure',repository:{full_name:'287113535qq-cmyk/sg-capture-runner'},path:'.github/workflows/trial-300k.yml'};
 const jobs={total_count:20,jobs:Array.from({length:20},(_,i)=>({name:'capture-'+i,status:'completed'}))};
 return {docs,set,calls:()=>calls,args:{store,campaign,plan,profile,ended,jobs,boundary:async()=>{}}};
}
test('ended source parking preserves pool and never requests capture',async()=>{
 const f=fixture(),before=hash(f.docs.get('state/pool:'+f.args.plan.trialId));const r=await finalizeEndedSource(f.args);
 assert.equal(r.parked,true);assert.equal(r.sourceRequests,0);assert.equal(r.newBetAllowance,0);assert.equal(f.calls(),1);
 assert.equal(hash(f.docs.get('state/pool:'+f.args.plan.trialId)),before);
 assert.equal((await finalizeEndedSource(f.args)).alreadyParked,true);assert.equal(f.calls(),1);
});
for(const bad of ['running','other-game','missing-job','duplicate-job','pending','unflushed','wrong-permit','wrong-schema','scene-change'])
test('ended source parking rejects '+bad,async()=>{
 const f=fixture(),a=f.args;
 if(bad==='running')a.ended.status='in_progress';
 if(bad==='other-game')f.set('state','capture-run:55:1',{gameId:32795});
 if(bad==='missing-job')a.jobs.jobs.pop();
 if(bad==='duplicate-job')a.jobs.jobs[19].name='capture-0';
 if(bad==='pending')f.docs.get('state/batch:'+a.plan.trialId+':1').value.pending={awaiting:null};
 if(bad==='unflushed')f.docs.get('state/batch:'+a.plan.trialId+':1').value.checkpoint=9;
 if(bad==='wrong-permit')f.docs.get('journal/count-run:'+a.plan.trialId+':55:1').value.commit='d'.repeat(40);
 if(bad==='wrong-schema')f.docs.get('journal/count-run:'+a.plan.trialId+':55:1').value.schema='unreviewed';
 if(bad==='scene-change'){let n=0;a.boundary=async()=>{if(++n===2)f.docs.get('state/campaign').value.activeGame=null;};}
 await assert.rejects(finalizeEndedSource(a));assert.equal(f.calls(),0);
});
