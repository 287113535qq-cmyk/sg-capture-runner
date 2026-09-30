import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {activateFormalRepair} from './formal-repair-activation.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
function fixture(){
 const plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'));
 const oldProfile=JSON.parse(fs.readFileSync('config/formal-count-pyramids-20261001.json','utf8'));
 const oldPlan=applyFormalCount(plans,oldProfile)[32721],base=plans[32721],docs=new Map(),records=[],ledger=[];
 const put=(c,k,value)=>docs.set(c+'/'+k,{value:structuredClone(value)});
 for(let id=1;id<=24;id++){
  const count=id<=19?68:id===20?70:74,start=(id-1)*100+1;
  const b={id,worker:20+(id-1)%20,start,end:start+99,sessionHash:hash(id),pending:null,leaseUntil:0,
   journaled:start+count-1,checkpoint:start+count-1,...(id===1?{failure:'LEGACY_IMPORT_REQUIRES_RETIREMENT'}:{})};
  put('state',`batch:${base.trialId}:${id}`,b);
  ledger.push({id,worker:b.worker,start,end:b.end,sessionHash:b.sessionHash,closed:true,complete:count,evidenceHash:hash(b)});
  for(let i=0;i<count;i++){const r={_id:hash([id,i]),sequence:start+i,raw:{synthetic:true}};records.push(r);put('journal',receiptKey(base.trialId,r.sequence),r);}
 }
 assert.equal(records.length,1658);
 const sourceCommit='c3e172c9712084034ddd34d69ab51071d78cb1a4';
 const spec={schema:'sg-complete-count-v1',activation:oldProfile.activation,commit:sourceCommit,planHash:hash(oldPlan),
  trialId:base.trialId,gameId:32721,target:299850,maxSequence:600000,firstSequence:2001,baselineBatchCount:20,
  baselineHash:hash(ledger.slice(0,20)),profileHash:hash(oldProfile),sessionRotation:'closed-batches-v1'};
 const key=`complete-count:${base.trialId}:${oldProfile.activation}`;
 put('journal',key,spec);put('journal',key+':complete',{schema:'sg-complete-count-activation-v1',specHash:hash(spec),trialId:base.trialId,planHash:hash(oldPlan),commit:sourceCommit});
 const pool={enabled:false,failure:'PROTOCOL_VALIDATION_FAILED',confirmed:1658,planHash:hash(oldPlan),nextBatchId:25,nextSequence:2401,
  workers:{},countAllocation:{specHash:hash(spec),reserved:0,batches:Object.fromEntries(ledger.map(b=>[b.id,b]))}};
 const repairKey='game-repair:'+base.trialId+':synthetic',repair={sourceAllowance:0,requiresNewSession:true,status:'pending-adapter'};
 const campaign={group:'secondary',activeGame:null,games:[{game_id:32721,status:'parked-protocol',repairKey}]};
 const retirementKey='synthetic-retirement',retired={schema:'sg-formal-stopped-retire-v1',completePreserved:1658,
  recordsHash:hash(records),repairKey,sourceRequests:0,newBetAllowance:0,sourceCommit};
 put('state','pool:'+base.trialId,pool);put('state','campaign',campaign);put('state',repairKey,repair);put('journal',retirementKey,retired);
 const plan={...base,countAllocation:hash('new-synthetic')};
 const profile={schema:'sg-formal-repair-pyramids-v1',gameId:32721,group:'secondary',workerOffset:20,historicalBaseline:150,totalTarget:300000,
  completePreserved:1658,remainingComplete:298192,maxSequence:600000,sessionRotation:'closed-batches-v1',oldProfileHash:hash(oldProfile),
  sourceRun:'36778619850:1',sourceCommit,basePlanHash:hash(base),activation:plan.countAllocation,planHash:hash(plan),createdAt:1000,expiresAt:7201000,
  oldSpecHash:hash(spec),poolHash:hash(pool),campaignHash:hash(campaign),repairKey,repairHash:hash(repair),retirementKey,retirementHash:hash(retired),recordsHash:hash(records)};
 const store={get:async(c,k)=>structuredClone(docs.get(c+'/'+k)),getMany:async(c,ks)=>ks.map(k=>structuredClone(docs.get(c+'/'+k))),
  create:async(c,k,v)=>{assert(!docs.has(c+'/'+k));put(c,k,v);},update:async(c,k,fn)=>put(c,k,fn(structuredClone(docs.get(c+'/'+k).value)))};
 const args={plans,profile,oldProfile,store,transport:{request:async(op,p)=>{assert.equal(op,'rounds_read');return records.filter(r=>p.ids.includes(r._id));}},
  parser:{call:async()=>({verified:true})},boundary:async()=>{},commit:'a'.repeat(40),run:'1:1',now:()=>2000};
 return {args,docs,plan};
}
test('secondary repair preserves frozen legacy markers,1658 records and discarded sequences',async()=>{
 const f=fixture(),before=new Map([...f.docs].map(([k,v])=>[k,hash(v)]));const out=await activateFormalRepair(f.args);
 assert.equal(out.completePreserved,1658);assert.equal(out.remainingComplete,298192);
 for(const [k,v]of before)if(k.startsWith('journal/')||k.startsWith('state/batch:'))assert.equal(hash(f.docs.get(k)),v);
 assert.equal(f.docs.get('state/pool:'+f.plan.trialId).value.nextSequence,2401);
 assert.equal(f.docs.get('state/campaign').value.activeGame,32721);
 assert.equal(f.docs.get('state/'+f.args.profile.repairKey).value.status,'repaired-returned');
 await assert.rejects(activateFormalRepair(f.args));
});
for(const bad of ['legacy-changed','new-failure','other-failure','target','remaining','group'])test('Pyramids repair rejects '+bad,async()=>{
 const f=fixture();
 if(bad==='legacy-changed')f.docs.get('state/batch:'+f.plan.trialId+':1').value.extra=null;
 if(bad==='new-failure')f.docs.get('state/batch:'+f.plan.trialId+':21').value.failure='LEGACY_IMPORT_REQUIRES_RETIREMENT';
 if(bad==='other-failure')f.docs.get('state/batch:'+f.plan.trialId+':1').value.failure='PROTOCOL_VALIDATION_FAILED';
 if(bad==='target')f.args.profile.totalTarget=300150;
 if(bad==='remaining')f.args.profile.remainingComplete=299850;
 if(bad==='group')f.args.profile.group='primary';
 const before=hash([...f.docs]);await assert.rejects(activateFormalRepair(f.args));assert.equal(hash([...f.docs]),before);
});
