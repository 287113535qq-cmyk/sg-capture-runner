import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {activateSessionLayout} from './session-layout-activation.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';
import {loadCountPermission} from './complete-count.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
function fixture(){
 const docs=new Map(),fromCommit='a'.repeat(40),commit='b'.repeat(40),activation=JSON.parse(fs.readFileSync('config/formal-repair-pearl-awards-20261001.json','utf8')).activation;
 const plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'));
 const profile=JSON.parse(fs.readFileSync('config/formal-repair-pearl-awards-20261001.json','utf8'));
 const plan=applyFormalCount(plans,profile)[32795];
 const actualActivation=profile.activation;
 const set=(c,k,value)=>docs.set(c+'/'+k,{value:structuredClone(value)});
 const ledger={};
 for(let id=1;id<=121;id++){
  const b={id,worker:0,start:(id-1)*100+1,end:id*100,sessionHash:hash(id),checkpoint:id*100,journaled:id*100,pending:null,leaseUntil:0};
  set('state',`batch:${plan.trialId}:${id}`,b);
  const key=`count-settlement:${plan.trialId}:${activation}:${id}`;
  const receipt={schema:'sg-count-batch-settlement-v1',activation,trialId:plan.trialId,fullReadback:true,batch:b};
  set('journal',key,receipt);
  ledger[id]={id,worker:0,start:b.start,end:b.end,sessionHash:b.sessionHash,closed:true,complete:100,
   evidenceHash:id===1?hash(b):hash(receipt),...(id>1?{settlementKey:key}:{})};
 }
 const spec={schema:'sg-complete-count-v1',trialId:plan.trialId,gameId:plan.gameId,target:plan.target,
  activation,planHash:hash(plan),profileHash:hash(profile),commit:fromCommit,baselineBatchCount:1,
  baselineHash:hash([ledger[1]]),firstSequence:101,maxSequence:600000,sessionRotation:'closed-batches-v1'};
 const sk=`complete-count:${plan.trialId}:${activation}`;
 set('journal',sk,spec);set('journal',sk+':complete',{schema:'sg-complete-count-activation-v1',specHash:hash(spec),
  trialId:plan.trialId,planHash:hash(plan),commit:fromCommit});
 const pool={planHash:hash(plan),enabled:true,confirmed:12100,nextBatchId:122,nextSequence:12101,
  workers:{0:{activeBatch:null,leaseUntil:0}},countAllocation:{specHash:hash(spec),reserved:0,batches:ledger}};
 const campaign={enabled:true,activeGame:plan.gameId,formalCount:{activation}};
 set('state','pool:'+plan.trialId,pool);set('state','campaign',campaign);
 const permit={schema:'sg-count-run-v1',commit:fromCommit,run:'77:1',activation,profileHash:hash(profile),completeBefore:100};
 set('journal',`count-run:${plan.trialId}:77:1`,permit);
 const revision={schema:'sg-count-runtime-refresh-profile-v1',profileHash:hash(profile),activation,gameId:plan.gameId,
  planHash:hash(plan),poolHash:hash(pool),campaignHash:hash(campaign),fromCommit,sourceRun:'77:1',sourcePermitHash:hash(permit),
  completePreserved:pool.confirmed,createdAt:1,expiresAt:1000};
 const ended={id:77,run_attempt:1,status:'completed',conclusion:'success',head_sha:fromCommit,
  repository:{full_name:'zyzuoyang/sg-capture-runner'},path:'.github/workflows/trial-300k.yml'};
 const jobs={total_count:21,jobs:[{name:'formal-admit',status:'completed',conclusion:'success'},
  ...Array.from({length:20},(_,i)=>({name:'capture-'+i,status:'completed',conclusion:'success'}))]};
 const sizes=[];
 const store={get:async(c,k)=>structuredClone(docs.get(c+'/'+k)),getMany:async(c,ks)=>{
  sizes.push(ks.length);return ks.map(k=>structuredClone(docs.get(c+'/'+k)));},
  update:async(c,k,fn)=>{set(c,k,fn(structuredClone(docs.get(c+'/'+k).value)));},
  create:async(c,k,v,opts)=>{assert.equal(opts.immutable,true);assert(!docs.has(c+'/'+k));set(c,k,v);}};
 const candidate={schema:'sg-session-layout-profile-v1',gameId:32795,group:'primary',basePlanHash:hash(plans[32795]),
  activation:'d'.repeat(64),parentActivation:profile.activation,parentProfileHash:hash(profile),sourceSpecHash:hash(spec),
  poolHash:hash(pool),campaignHash:hash(campaign),sourcePermitHash:hash(permit),sourceRun:'77:1',sourceCommit:fromCommit,
  completePreserved:12100,remainingComplete:287900,newBetAllowance:0,maxSequence:600000,sessionRotation:'closed-batches-v1',
  featureProfile:'additive-free-awards-v2',previousLanesPerHost:1,comparisonHash:null,createdAt:1,expiresAt:1000,
  sessionLayout:{schema:'sg-independent-sessions-v1',group:'primary',hosts:20,lanesPerHost:2}};
 const nextPlan={...plan,countAllocation:candidate.activation,sessionLayout:candidate.sessionLayout};candidate.planHash=hash(nextPlan);
 return {docs,set,pool,sizes,plan:nextPlan,args:{store,plans,profile:candidate,parent:profile,ended,jobs,commit,run:'88:1',boundary:async()=>{},now:()=>100}};
}

test('natural healthy handoff validates all pages and keeps every old batch and receipt immutable',async()=>{
 const f=fixture(),old=new Map([...f.docs].filter(([k])=>!['state/campaign','state/pool:'+f.plan.trialId].includes(k)).map(([k,v])=>[k,hash(v)]));
 const r=await activateSessionLayout(f.args);assert.equal(r.completePreserved,12100);assert.equal(r.newBetAllowance,0);
 assert.equal(r.remainingComplete,287900);assert(Math.max(...f.sizes)<=100);
 for(const[k,h]of old)assert.equal(hash(f.docs.get(k)),h);
 const pool=f.docs.get('state/pool:'+f.plan.trialId).value;
 const spec=await loadCountPermission({store:f.args.store,plan:f.plan,pool,commit:f.args.commit});
 assert.equal(spec.sessionLayout.lanesPerHost,2);assert.equal(pool.nextSequence,12101);assert.deepEqual(pool.workers,{});
 await assert.rejects(activateSessionLayout(f.args),/ALREADY_STARTED/);
});
for(const bad of ['source-failure','source-running','missing-worker','duplicate-worker','expired','changed-pool','reserved','pending','proof-change','missing-proof','wrong-permit','concurrent-change','direct-four','target-reset','parent-change','active-lease','partial-before'])
test('session handoff rejects '+bad+' before any write',async()=>{
 const f=fixture(),a=f.args,p=a.profile;
 if(bad==='source-failure')a.ended.conclusion='failure';
 if(bad==='source-running')a.ended.status='in_progress';
 if(bad==='missing-worker')a.jobs.jobs.pop();
 if(bad==='duplicate-worker')a.jobs.jobs[20].name='capture-0';
 if(bad==='expired')a.now=()=>1001;
 if(bad==='changed-pool')f.pool.confirmed++; // change the stored snapshot below
 if(bad==='changed-pool')f.docs.get('state/pool:'+f.plan.trialId).value.confirmed++;
 if(bad==='reserved'){const v=f.docs.get('state/pool:'+f.plan.trialId).value;v.countAllocation.reserved=1;p.poolHash=hash(v);}
 if(bad==='active-lease'){const v=f.docs.get('state/pool:'+f.plan.trialId).value;v.workers[0].leaseUntil=999;p.poolHash=hash(v);}
 if(bad==='pending')f.docs.get(`state/batch:${f.plan.trialId}:120`).value.pending={};
 const proof=`journal/count-settlement:${f.plan.trialId}:${a.parent.activation}:120`;
 if(bad==='proof-change')f.docs.get(proof).value.fullReadback=false;
 if(bad==='missing-proof')f.docs.delete(proof);
 if(bad==='wrong-permit')p.sourcePermitHash='0'.repeat(64);
 if(bad==='parent-change')p.parentProfileHash='0'.repeat(64);
 if(bad==='direct-four')p.sessionLayout.lanesPerHost=4;
 if(bad==='target-reset')p.remainingComplete=300000;
 if(bad==='partial-before')f.set('journal',`complete-count:${f.plan.trialId}:${p.activation}:before`,{});
 if(bad==='concurrent-change'){let n=0;a.boundary=async()=>{if(++n===2)f.docs.get('state/campaign').value.enabled=false;};}
 const count=f.docs.size;await assert.rejects(activateSessionLayout(a));assert.equal(f.docs.size,count);
});

for(const bad of [null,'missing','foreign-run','slower','errors','unknown','tail-regression','unequal-window','unverified'])
test('two to four sessions requires stored matched comparison: '+(bad??'valid'),async()=>{
 const f=fixture();await activateSessionLayout(f.args);
 const parent=f.args.profile,pool=f.docs.get('state/pool:'+f.plan.trialId).value,c=f.docs.get('state/campaign').value;
 const spec=f.docs.get(`journal/complete-count:${f.plan.trialId}:${parent.activation}`).value;
 const permit={schema:'sg-count-run-v1',activation:parent.activation,commit:f.args.commit,run:'88:1',profileHash:hash(parent),completeBefore:12100};
 f.set('journal',`count-run:${f.plan.trialId}:88:1`,permit);
 const comparison={schema:'sg-session-comparison-v1',trialId:f.plan.trialId,profileHash:hash(parent),activation:parent.activation,
  run:'88:1',commit:f.args.commit,fullReadback:true,
  baseline:{lanesPerHost:1,durationMs:60000,complete:100,errors:0,unknown:0,resourceHolds:0,recordsHash:hash('baseline'),requestP95Ms:500},
  candidate:{lanesPerHost:2,durationMs:60000,complete:180,errors:0,unknown:0,resourceHolds:0,recordsHash:hash('candidate'),requestP95Ms:450}};
 if(bad==='foreign-run')comparison.run='89:1';
 if(bad==='slower')comparison.candidate.complete=90;
 if(bad==='errors')comparison.candidate.errors=1;
 if(bad==='unknown')comparison.candidate.unknown=1;
 if(bad==='tail-regression')comparison.candidate.requestP95Ms=501;
 if(bad==='unequal-window')comparison.candidate.durationMs=120000;
 if(bad==='unverified')comparison.fullReadback=false;
 const p={...parent,activation:'e'.repeat(64),parentActivation:parent.activation,parentProfileHash:hash(parent),sourceSpecHash:hash(spec),
  poolHash:hash(pool),campaignHash:hash(c),sourcePermitHash:hash(permit),sourceRun:'88:1',sourceCommit:f.args.commit,
  previousLanesPerHost:2,comparisonHash:hash(comparison),sessionLayout:{...parent.sessionLayout,lanesPerHost:4}};
 p.planHash=hash({...f.plan,countAllocation:p.activation,sessionLayout:p.sessionLayout});
 if(bad!=='missing')f.set('journal',`session-comparison:${f.plan.trialId}:${p.comparisonHash}`,comparison);
 const a={...f.args,parent,profile:p,commit:'c'.repeat(40),run:'99:1',ended:{...f.args.ended,id:88,head_sha:f.args.commit}};
 const before=f.docs.size;
 if(bad){await assert.rejects(activateSessionLayout(a),/SESSION_COMPARISON/);assert.equal(f.docs.size,before);}
 else{const result=await activateSessionLayout(a);assert.equal(result.newBetAllowance,0);assert.equal(result.completePreserved,12100);}
});
