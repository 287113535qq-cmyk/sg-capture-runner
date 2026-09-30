import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';import {pilotCloseScene} from './demo-pilot-close.mjs';
import {activatePyramidsCount} from './pyramids-count-activation.mjs';import {receiptKey} from './durable-queue.mjs';
import {loadCountPermission,checkLedger,allocateCountBatch,auditAllocatedRecord,auditCountBatch} from './complete-count.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';
async function fixture(){
 const plans=JSON.parse(fs.readFileSync('config/round-one-plans.json')),base=plans[32721],original=JSON.parse(fs.readFileSync('config/demo-pilot-pyramids-20261001.json'));
 const commit='c'.repeat(40),generation=original.generation,from={...base,demoGeneration:generation},activation='a'.repeat(64),plan={...base,countAllocation:activation};
 const docs=new Map(),records=[],put=(c,k,v)=>docs.set(c+'/'+k,{value:structuredClone(v)}),trial=base.trialId,retirement='synthetic-retirement';
 const retired={schema:'sg-retired-demo-result-v1',trialId:trial};put('journal',retirement+':complete',retired);
 const parent={schema:'sg-demo-generation-v1',group:'secondary',workerOffset:20,generation,trialId:trial,planHash:hash(from),commit,run:'1:1',workers:20,perWorker:5,newBetAllowance:100,completePreserved:1262,firstBatchId:28,
  activationStage:{key:`next-demo-game:${trial}:${generation}`,profileHash:hash(original)},historicalBatches:{},retirement,retirementHash:hash(retired)};
 const pool={enabled:true,failure:null,confirmed:1262,nextBatchId:48,nextSequence:4701,workers:{},planHash:hash(from)};
 for(let i=1;i<=47;i++){
  const worker=i<28?20:20+i-28,sessionHash=String(i).padStart(64,'0'),start=(i-1)*100+1,n=i<27?47:i===27?40:5;
  const b={id:i,worker,start,end:start+99,journaled:start+n-1,checkpoint:start+n-1,pending:null,leaseUntil:0,sessionHash,...(i<28?{retiredDemo:retirement}:{})};
  put('state',`batch:${trial}:${i}`,b);if(i<28)parent.historicalBatches[i]=hash(b);else pool.workers[worker]={sessionHash,leaseUntil:0,activeBatch:null};
  for(let j=0;j<n;j++){const r={_id:String(start+j),trialId:trial,sequence:start+j,batchId:i,shardId:worker,sourceSessionHash:sessionHash,buy:0,fixtureOnly:false,raw:{synthetic:true},normalized:{bonus:i===28&&j===0?1:0}};
   records.push(r);put('journal',receiptKey(trial,r.sequence),r);}
 }
 pool.demoGeneration={id:generation,specHash:hash(parent)};put('state','pool:'+trial,pool);
 put('state','campaign',{group:'secondary',enabled:true,activeGame:32721,validationLimit:5,games:[{game_id:32721,baseline:150}],protocolValidation:{commit,generation,runKey:'capture-run:36774221164:1',demoFresh:hash(parent)}});
 const key=`demo-generation:${trial}:${generation}`;put('journal',key,parent);put('journal',key+':complete',{schema:'sg-demo-generation-complete-v1',specHash:hash(parent),commit,run:parent.run});
 put('journal',parent.activationStage.key+':complete',{schema:'sg-next-demo-game-complete-v1',profileHash:hash(original),commit,run:parent.run,generation,newBetAllowance:100,sourceRequests:0,completePreserved:1262});
 const store={get:async(c,k)=>structuredClone(docs.get(c+'/'+k)),getMany:async(c,ks)=>ks.map(k=>structuredClone(docs.get(c+'/'+k))),create:async(c,k,v)=>{assert(!docs.has(c+'/'+k));put(c,k,v);},update:async(c,k,fn)=>put(c,k,await fn(structuredClone(docs.get(c+'/'+k).value)))};
 const transport={request:async(op,p)=>structuredClone(op==='rounds_read'?records.filter(r=>p.ids.includes(r._id)):records.filter(r=>r.sequence>p.after).slice(0,100))};
 const profile={schema:'sg-formal-count-pyramids-v1',gameId:32721,group:'secondary',workerOffset:20,activation,basePlanHash:hash(base),planHash:hash(plan),completePreserved:1362,remainingComplete:298488,historicalBaseline:150,totalTarget:300000,maxSequence:600000,sessionRotation:'closed-batches-v1',sourceGeneration:generation,sourceProfileHash:hash(original),sourceSpecHash:hash(parent),sourceRunKey:'capture-run:36774221164:1',sourceCommit:commit,recordsHash:hash(records.map(hash).sort()),sceneHash:hash(await pilotCloseScene(store,from)),createdAt:1000,expiresAt:7201000};
 return {docs,records,base,plan,parent,args:{store,transport,parser:{call:async()=>({verified:true})},plans,profile,boundary:async()=>{},commit,run:'3:1',now:()=>2000}};
}
test('Pyramids preserves all old and pilot batches and allocates only the remaining complete count',async()=>{
 const f=await fixture(),before=new Map([...f.docs].filter(([k])=>k!=='state/campaign'&&k!=='state/pool:'+f.base.trialId).map(([k,v])=>[k,hash(v)]));
 assert.deepEqual(applyFormalCount(f.args.plans,f.args.profile)[32721],f.plan);
 const r=await activatePyramidsCount(f.args);assert.equal(r.remainingComplete,298488);assert.equal(r.sourceRequests,0);
 const pool=f.docs.get('state/pool:'+f.base.trialId).value,spec=await loadCountPermission({...f.args,plan:f.plan,pool}),cache=new Map();
 for(const record of f.records){assert(auditAllocatedRecord({pool,plan:f.plan,spec,record}));await auditCountBatch({store:f.args.store,pool,plan:f.plan,spec,record,cache});}
 for(const [k,h] of before)assert.equal(hash(f.docs.get(k)),h);
 for(let worker=20;worker<40;worker++){pool.workers[worker]={sessionHash:String(worker+100).padStart(64,'0')};allocateCountBatch({pool,plan:f.plan,spec,worker,now:2000});}
 assert.equal(checkLedger(pool,f.plan,spec).reserved,2000);assert.equal(pool.confirmed,1362);
 await assert.rejects(activatePyramidsCount(f.args));
});
test('Pyramids refuses unspent altered truncated stale or unverified evidence before writes',async()=>{
 for(const bad of ['profile','baseline','lease','pending','spent','mongo','python','page','extra','natural','expiry','partial','parent']){
  const f=await fixture(),pool=f.docs.get('state/pool:'+f.base.trialId).value,c=f.docs.get('state/campaign').value;
  if(bad==='profile')f.args.profile.remainingComplete++;
  if(bad==='baseline')c.games[0].baseline=100;
  if(bad==='lease')pool.workers[20].leaseUntil=99999;
  if(bad==='pending')f.docs.get('state/batch:'+f.base.trialId+':28').value.pending={};
  if(bad==='spent')f.docs.get('state/batch:'+f.base.trialId+':28').value.journaled--;
  if(bad==='mongo')f.records[0].normalized.changed=true;
  if(bad==='python')f.args.parser.call=async()=>({verified:false});
  if(bad==='page'){const req=f.args.transport.request;f.args.transport.request=async(op,p)=>op==='rounds_scan'&&p.after>0?[]:req(op,p);}
  if(bad==='extra')f.records.push({...f.records[0],_id:'extra',sequence:9999});
  if(bad==='natural'){for(const r of f.records){r.normalized.bonus=0;f.docs.get('journal/'+receiptKey(f.base.trialId,r.sequence)).value=structuredClone(r);}f.args.profile.recordsHash=hash(f.records.map(hash).sort());}
  if(bad==='expiry')f.args.now=()=>7201001;
  if(bad==='partial')f.docs.set('journal/complete-count:'+f.base.trialId+':'+f.args.profile.activation+':before',{value:{}});
  if(bad==='parent')f.docs.get('journal/demo-generation:'+f.base.trialId+':'+f.parent.generation+':complete').value.commit='f'.repeat(40);
  const before=hash([...f.docs]);await assert.rejects(activatePyramidsCount(f.args),undefined,bad);assert.equal(hash([...f.docs]),before,bad);
 }
});
test('Pyramids partial activation and CAS conflicts never create an admission receipt',async()=>{
 for(const bad of ['spec','pool','campaign']){
  const f=await fixture(),create=f.args.store.create,update=f.args.store.update;
  if(bad==='spec')f.args.store.create=async(c,k,v)=>{if(k.startsWith('complete-count:')&&!k.endsWith(':before'))throw Error('INJECTED');return create(c,k,v);};
  else f.args.store.update=async(c,k,fn)=>{if(k===(bad==='pool'?'pool:'+f.base.trialId:'campaign'))throw Error('INJECTED_CAS');return update(c,k,fn);};
  await assert.rejects(activatePyramidsCount(f.args));const pool=f.docs.get('state/pool:'+f.base.trialId).value;
  await assert.rejects(loadCountPermission({...f.args,plan:f.plan,pool}));
 }
});
