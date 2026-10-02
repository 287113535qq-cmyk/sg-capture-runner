import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';import {activateFormalRepair} from './formal-repair-activation.mjs';
import {loadCountPermission,allocateCountBatch} from './complete-count.mjs';import {receiptKey} from './durable-queue.mjs';
function fixture(awards=false){
 const plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),base=plans[32795],oldActivation='a'.repeat(64),activation='b'.repeat(64),sourceCommit='c'.repeat(40),commit='d'.repeat(40);
 const feature=awards?'additive-free-awards-v2':'eight-free-retrigger-v1',preserved=awards?2596:961;
 const oldPlan={...base,countAllocation:oldActivation,...(awards?{maxSteps:1026,featureProfile:'eight-free-retrigger-v1'}:{})},plan={...base,countAllocation:activation,maxSteps:1026,featureProfile:feature},docs=new Map(),mongo=new Map(),records=[],baseline=[];
 const put=(c,k,v)=>docs.set(c+'/'+k,{value:structuredClone(v)}),poolKey='pool:'+base.trialId;
 for(let id=1;id<=(awards?66:40);id++){
  const complete=id<=20?5:id<=28?44: id===29?33:Math.floor(476/11)+(id===40?3:0),start=(id-1)*100+1;
  // Exact synthetic distribution: 100 pilot + 861 later complete records.
  const count=id<=20?5:id<40?43:id===40?44:id<66?62:85;
  const b={id,worker:(id-1)%20,start,end:start+99,sessionHash:hash(id),checkpoint:start+count-1,journaled:start+count-1,pending:null,leaseUntil:0};
  put('state',`batch:${base.trialId}:${id}`,b);baseline.push({id,worker:b.worker,start,end:b.end,sessionHash:b.sessionHash,closed:true,complete:count,evidenceHash:hash(b)});
  for(let i=0;i<count;i++){const r={_id:hash([id,i]),sequence:start+i,raw:{offline:true}};records.push(r);mongo.set(r._id,r);put('journal',receiptKey(base.trialId,r.sequence),r);}
 }
 assert.equal(records.length,preserved);
 const oldProfile={schema:awards?'sg-formal-repair-profile-v1':'sg-formal-count-profile-v1',...(awards?{featureProfile:'eight-free-retrigger-v1'}:{}),gameId:32795,basePlanHash:hash(base),activation:oldActivation,planHash:hash(oldPlan),completePreserved:awards?961:100,remainingComplete:awards?299039:299900,maxSequence:600000,sessionRotation:'closed-batches-v1'};
 const oldSpec={schema:'sg-complete-count-v1',activation:oldActivation,commit:sourceCommit,planHash:hash(oldPlan),trialId:base.trialId,gameId:32795,target:300000,maxSequence:600000,firstSequence:awards?4001:2001,baselineBatchCount:awards?40:20,baselineHash:hash(baseline.slice(0,awards?40:20)),profileHash:hash(oldProfile),sessionRotation:'closed-batches-v1'};
 const oldKey=`complete-count:${base.trialId}:${oldActivation}`;
 put('journal',oldKey,oldSpec);put('journal',oldKey+':complete',{schema:'sg-complete-count-activation-v1',specHash:hash(oldSpec),trialId:base.trialId,planHash:hash(oldPlan),commit:sourceCommit});
 const pool={enabled:false,failure:'PROTOCOL_VALIDATION_FAILED',confirmed:preserved,planHash:hash(oldPlan),nextBatchId:awards?67:41,nextSequence:awards?6601:4001,workers:{},countAllocation:{specHash:hash(oldSpec),reserved:0,batches:Object.fromEntries(baseline.map(b=>[b.id,b]))}};
 const repairKey='game-repair:'+base.trialId+':'+hash(pool),repair={status:'pending-adapter',sourceAllowance:0,requiresNewSession:true};
 const campaign={enabled:true,activeGame:null,games:[{game_id:32795,status:'parked-protocol',repairKey}],formalCount:{activation:oldActivation}};
 const retirementKey='formal-stopped-retire:'+base.trialId+':'+hash(oldSpec)+':complete',retired={schema:'sg-formal-stopped-retire-v1',completePreserved:preserved,recordsHash:hash(records),repairKey,sourceRequests:0,newBetAllowance:0,sourceCommit};
 put('state',poolKey,pool);put('state','campaign',campaign);put('state',repairKey,repair);put('journal',retirementKey,retired);
 const profile={schema:awards?'sg-formal-repair-profile-v2':'sg-formal-repair-profile-v1',gameId:32795,activation,basePlanHash:hash(base),planHash:hash(plan),completePreserved:preserved,remainingComplete:300000-preserved,maxSequence:600000,sessionRotation:'closed-batches-v1',featureProfile:feature,oldProfileHash:hash(oldProfile),createdAt:1000,expiresAt:7201000,poolHash:hash(pool),campaignHash:hash(campaign),repairKey,repairHash:hash(repair),retirementKey,retirementHash:hash(retired),recordsHash:hash(records),sourceCommit,oldSpecHash:hash(oldSpec)};
 const store={get:async(c,k)=>structuredClone(docs.get(c+'/'+k)),getMany:async(c,ks)=>ks.map(k=>structuredClone(docs.get(c+'/'+k))),create:async(c,k,v)=>{assert(!docs.has(c+'/'+k));put(c,k,v);},update:async(c,k,fn)=>put(c,k,fn(structuredClone(docs.get(c+'/'+k).value)))};
 const args={store,transport:{request:async(op,p)=>{assert.equal(op,'rounds_read');return p.ids.map(id=>mongo.get(id)).filter(Boolean);}},parser:{call:async r=>{assert.equal(r.op,'verify');assert.equal(r.plan.featureProfile,feature);return {verified:true};}},plans,profile,oldProfile,boundary:async()=>{},commit,run:'8:1',now:()=>2000};
 return {args,docs,mongo,poolKey,plan};
}
test('repair returns to normal queue preserving all 961 records/ranges and only remaining target',async()=>{
 const f=fixture(),before=new Map([...f.docs].filter(([k])=>k.startsWith('journal/')||k.startsWith('state/batch:')).map(([k,v])=>[k,hash(v)]));
 const out=await activateFormalRepair(f.args);assert.equal(out.remainingComplete,299039);for(const [k,h] of before)assert.equal(hash(f.docs.get(k)),h);
 const pool=f.docs.get('state/'+f.poolKey).value;assert.equal(pool.nextSequence,4001);assert.equal(pool.confirmed,961);assert.deepEqual(pool.workers,{});
 assert.equal(f.docs.get('state/campaign').value.activeGame,32795);assert.equal(f.docs.get('state/'+f.args.profile.repairKey).value.status,'repaired-returned');
 const spec=await loadCountPermission({store:f.args.store,plan:f.plan,pool,commit:f.args.commit});
 pool.workers['0']={sessionHash:hash('fresh'),activeBatch:null};const next=allocateCountBatch({pool,plan:f.plan,spec,worker:0,now:2000});assert.equal(next.batch.start,4001);
 await assert.rejects(activateFormalRepair(f.args));
});
for(const bad of ['expired','mongo','records','pending','retirement','repair-quota','active-game','pool-cas','campaign-cas'])test('repair rejects '+bad,async()=>{
 const f=fixture();if(bad==='expired')f.args.now=()=>7201001;
 if(bad==='mongo')f.mongo.clear();if(bad==='records')f.args.profile.recordsHash='0'.repeat(64);
 if(bad==='pending')f.docs.get('state/batch:'+f.plan.trialId+':40').value.pending={awaiting:'unknown'};
 if(bad==='retirement')f.args.profile.retirementHash='0'.repeat(64);
 if(bad==='repair-quota')f.docs.get('state/'+f.args.profile.repairKey).value.sourceAllowance=1;
 if(bad==='active-game')f.docs.get('state/campaign').value.activeGame=32714;
 if(bad==='pool-cas'||bad==='campaign-cas'){let n=0;f.args.boundary=async()=>{if(++n===2)f.docs.get('state/'+(bad==='pool-cas'?f.poolKey:'campaign')).value.changed=true;};}
 await assert.rejects(activateFormalRepair(f.args));
 assert(!f.docs.has('journal/complete-count:'+f.plan.trialId+':'+f.plan.countAllocation+':complete'));
});

test('second repair inherits2596 and66 retired ranges without reclaiming old attempts',async()=>{
 const f=fixture(true),before=new Map([...f.docs].filter(([k])=>k.startsWith('journal/')||k.startsWith('state/batch:')).map(([k,v])=>[k,hash(v)]));
 const result=await activateFormalRepair(f.args);assert.equal(result.completePreserved,2596);assert.equal(result.remainingComplete,297404);for(const [k,h] of before)assert.equal(hash(f.docs.get(k)),h);
 const pool=f.docs.get('state/'+f.poolKey).value;assert.equal(pool.nextSequence,6601);assert.equal(pool.confirmed,2596);assert.deepEqual(pool.workers,{});
 await assert.rejects(activateFormalRepair(f.args));
});
test('bounded Python verification preserves serial activation results and never rewrites retained records',async()=>{
 const serial=fixture(),paged=fixture();let pages=0,verified=0;
 paged.args.parser.verifyPage=async(plan,records)=>{
  assert(records.length>0&&records.length<=100);assert.equal(plan.featureProfile,paged.plan.featureProfile);
  pages++;verified+=records.length;return {verified:true,count:records.length};
 };
 paged.args.parser.call=async()=>{throw Error('UNEXPECTED_SERIAL_VERIFICATION');};
 assert.deepEqual(await activateFormalRepair(paged.args),await activateFormalRepair(serial.args));
 assert.equal(hash([...paged.docs]),hash([...serial.docs]));assert.equal(verified,961);assert.equal(pages,40);
});
test('missing or partial batch verification cannot produce an activation or modify the closed pool',async()=>{
 for(const result of [{verified:false,count:5},{verified:true,count:4},null]){
  const f=fixture(),before=hash([...f.docs]);f.args.parser.verifyPage=async()=>result;
  await assert.rejects(activateFormalRepair(f.args),/FORMAL_REPAIR_PYTHON/);
  assert.equal(hash([...f.docs]),before);
 }
});
