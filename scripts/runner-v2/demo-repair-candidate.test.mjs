import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {reviewRepairCandidate,prepareRepairCandidate} from './demo-repair-candidate.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';import {receiptKey} from './durable-queue.mjs';
import {fixture as sourceFixture} from './fixtures/demo-next-game.mjs';
import {nextDemoGame,nextDemoScene} from './demo-next-game.mjs';
import {DemoFresh} from './demo-fresh.mjs';

function fixture(){
 const basePlan=JSON.parse(fs.readFileSync('config/round-one-plans.json'))['32718'],registry=JSON.parse(fs.readFileSync('service/round_types.json'));
 const oldGeneration='a'.repeat(64),generation='b'.repeat(64),plan={...basePlan,demoGeneration:oldGeneration},trial=plan.trialId,
  key=`closed-demo-pilot:${trial}:${oldGeneration}`,rk=`game-repair:${trial}:${oldGeneration}`,docs=new Map();
 const record={_id:'fixture-record',trialId:trial,sequence:1,batchId:1,shardId:0,sourceSessionHash:'s',fixtureOnly:false,buy:0,raw:{steps:[{msgId:'BET'}]}};
 const pending={sequence:2,awaiting:null,raw:{steps:[{msgId:'BET',responseXml:'<fixture/>',responsePayload:'FID=2'}]}},ak=`abandoned-demo:${trial}:1:${hash(pending)}`,
  archive={schema:'sg-abandoned-demo-v1',trialId:trial,batchId:1,disposition:'interrupted-abandoned-without-replay',sourceRequests:0,pending,pendingOriginal:null};
 const batch={id:1,worker:0,start:1,end:5,journaled:1,checkpoint:1,sessionHash:'s',leaseUntil:0,pending:null,pendingOriginal:null,bootstrapAwaiting:null,abandonedDemo:ak};
 const evidence=[{key:ak,hash:hash(archive),batchId:1,worker:0,sequence:2,rawHash:hash(pending.raw)}];
 const repair={schema:'sg-game-repair-v1',gameId:32718,trialId:trial,status:'pending-adapter',archiveKey:key+':before',evidence,sourceAllowance:0,requiresNewSession:true};
 const pool={enabled:false,planHash:hash(plan),nextBatchId:2,nextSequence:101,workers:{0:{sessionHash:'s',leaseUntil:0}},demoGeneration:{id:oldGeneration},demoPilotClosed:{key,profileHash:'p',repairKey:rk},legacyImport:{old:'fixed'}};
 const oldCampaign={activeGame:32718,games:[]},campaign={activeGame:32795,games:[{game_id:32718,status:'parked-protocol',repairKey:rk},{game_id:32795,status:'active'}]};
 const before={schema:'sg-demo-pilot-close-before-v2',profileHash:'p',commit:'c'.repeat(40),run:'1:1',scene:{campaign:oldCampaign}};
 const used=Array(20).fill(0),complete=Array(20).fill(0),abandoned=Array(20).fill(0);used[0]=2;complete[0]=1;abandoned[0]=1;
 const closed={schema:'sg-demo-pilot-closed-v2',trialId:trial,generation:oldGeneration,planHash:hash(plan),specHash:'spec',sourceRunKey:'capture-run:2:1',sourceCommit:'c'.repeat(40),sourceProfileHash:'source',profileHash:'p',beforeHash:hash(before),commit:before.commit,run:before.run,
  afterPoolHash:hash(pool),campaignHash:hash(oldCampaign),batchesHash:hash([batch]),repairKey:rk,repairHash:hash(repair),evidence,usedByWorker:used,completeByWorker:complete,abandonedByWorker:abandoned,foregoneByWorker:used.map(n=>5-n),used:2,newComplete:1,abandoned:1,foregone:98,newBetAllowance:0,sourceRequests:0,completePreserved:1,recordsHash:hash([record])};
 for(const [col,k,v] of [['state','campaign',campaign],['state','pool:'+trial,pool],['state',rk,repair],['state','batch:'+trial+':1',batch],['journal',key+':before',before],['journal',key+':complete',closed],['journal',ak,archive],['journal',receiptKey(trial,1),record]])docs.set(col+'/'+k,{value:v});
 const store={async get(c,k){return structuredClone(docs.get(c+'/'+k)??null);},async getMany(c,ks){return Promise.all(ks.map(k=>this.get(c,k)));},async create(c,k,v){assert(!docs.has(c+'/'+k));docs.set(c+'/'+k,{value:structuredClone(v)});},async update(c,k,fn){const next=fn(structuredClone(docs.get(c+'/'+k).value));docs.set(c+'/'+k,{value:next});}};
 const extension='huffnmorepuffhighlimit96-round-one-base-v1-wheel-megahat-single-v1';
 const profile={schema:'sg-demo-next-game-v1',gameId:32718,fromGameId:32795,generation,oldPlanHash:hash(basePlan),planHash:hash({...basePlan,demoGeneration:generation}),workers:20,perWorker:5,newBetAllowance:100,completePreserved:1,abandonedAttempts:0,createdAt:0,expiresAt:7200000,
  repairedCandidate:{schema:'sg-repaired-demo-candidate-v1',oldGeneration,basePlanHash:hash(basePlan),oldPlanHash:hash(plan),closureKey:key,closureHash:hash(closed),repairKey:rk,repairHash:hash(repair),poolHash:hash(pool),campaignHash:hash(campaign),batchesHash:hash([batch]),recordsHash:closed.recordsHash,completePreserved:1,extension,mappingHash:hash(registry.profiles[extension])}};
 const args={store,transport:{request:async()=>[structuredClone(record)]},parser:{call:async()=>({verified:true})},basePlan,profile,registry,boundary:async()=>{},commit:'f'.repeat(40),run:'9:1',now:()=>1000};
 return {args,docs,pool,closed,repair,batch,record,key,rk};
}
test('closed repair preparation grants zero source, preserves old closure/receipts and cannot replay',async()=>{
 const f=fixture(),old=new Map([...f.docs].map(([k,v])=>[k,hash(v.value)]));const r=await prepareRepairCandidate(f.args);
 assert.equal(r.newBetAllowance,0);assert.equal(r.sourceRequests,0);assert.equal(r.foregonePreserved,98);assert.equal(r.completePreserved,1);
 const pool=f.docs.get('state/pool:'+f.args.basePlan.trialId).value;assert.equal(pool.enabled,false);assert.equal(pool.demoGeneration,undefined);assert.equal(pool.nextSequence,101);
 for(const [k,h] of old)if(!k.startsWith('state/pool:'))assert.equal(hash(f.docs.get(k).value),h);
 await assert.rejects(prepareRepairCandidate(f.args),/ALREADY_STARTED/);
});
for(const cause of ['mapping','lease','pending','mongo','closure','budget','session','stale','same-generation'])test('repair candidate refuses '+cause+' before any write',async()=>{
 const f=fixture();
 if(cause==='mapping')f.args.profile.repairedCandidate.mappingHash='0'.repeat(64);
 if(cause==='lease')f.pool.workers[0].leaseUntil=9999;
 if(cause==='pending')f.batch.pending={awaiting:{}};
 if(cause==='mongo')f.args.transport.request=async()=>[];
 if(cause==='closure')f.closed.completePreserved=2;
 if(cause==='budget')f.args.profile.newBetAllowance=200;
 if(cause==='session')f.record.sourceSessionHash='other';
 if(cause==='stale')f.args.now=()=>7200000;
 if(cause==='same-generation')f.args.profile.generation=f.args.profile.repairedCandidate.oldGeneration;
 const before=hash([...f.docs]);await assert.rejects(prepareRepairCandidate(f.args));assert.equal(hash([...f.docs]),before);
});
test('partial preparation cannot be used or reissued as an applied generation',async()=>{
 const f=fixture(),create=f.args.store.create.bind(f.args.store);f.args.store.create=async(c,k,v)=>{if(k.endsWith(':complete'))throw Error('INJECTED_COMPLETE');return create(c,k,v);};
 await assert.rejects(prepareRepairCandidate(f.args),/INJECTED_COMPLETE/);assert.equal(f.docs.get('state/pool:'+f.args.basePlan.trialId).value.enabled,false);
 await assert.rejects(prepareRepairCandidate(f.args),/ALREADY_STARTED/);await assert.rejects(reviewRepairCandidate(f.args));
});

async function transitionFixture(){
 const f=fixture(),s=await sourceFixture(true),base=f.args.basePlan,p=f.args.profile,sourceBase=s.args.plans[32820];
 for(const [k,v] of s.docs)if(k.includes('synthetic-source')||k==='state/write-permits')f.docs.set(k,structuredClone(v));
 const campaign={enabled:true,activeGame:32820,games:[{game_id:32820,status:'active'},{game_id:32718,status:'parked-protocol',repairKey:f.rk}],protocolValidation:{runKey:s.args.profile.sourceRunKey}};
 f.docs.set('state/campaign',{value:campaign});p.fromGameId=32820;p.repairedCandidate.campaignHash=hash(campaign);
 for(const k of ['sourceGeneration','sourcePlanHash','sourceSpecHash','sourceRunKey'])p[k]=s.args.profile[k];
 const candidateKey=`repaired-demo-candidate:${base.trialId}:${p.generation}`;
 const prepared={...f.pool,enabled:false,planHash:hash(base),confirmed:1,repairedCandidate:{key:candidateKey,specHash:hash(p.repairedCandidate),closureKey:f.key,closureHash:p.repairedCandidate.closureHash,repairKey:f.rk}};
 for(const k of ['demoGeneration','demoPilotClosed','legacyImport','retiredDemo','drainingProtocol'])delete prepared[k];
 const sourcePlan={...sourceBase,demoGeneration:p.sourceGeneration};
 const scene=await nextDemoScene(f.args.store,base,sourcePlan);scene.pool=prepared;p.sceneHash=hash(scene);
 Object.assign(f.args,{plans:{32718:base,32820:sourceBase},gate:{status:()=>({allowed:true,maxBatchSize:100}),hold(){},observe(){}},transport:{request:async(op,payload)=>{assert.equal(op,'rounds_read');return payload.ids.includes(f.record._id)?[structuredClone(f.record)]:[];}}});
 f.args.store.writable=async()=>{};
 const plan={...base,demoGeneration:p.generation},top=`next-demo-game:${base.trialId}:${p.generation}`;
 const admit=async()=>{f.docs.get('state/campaign').value.protocolValidation.runKey='capture-run:12:1';return new DemoFresh({store:f.args.store,plan,stage:'fresh',runKey:'capture-run:12:1',now:f.args.now}).admit({shardId:0,sessionHash:'brand-new-session',commitSha:f.args.commit},0);};
 return {...f,admit,top};
}
test('closed repair takes preparation retirement rollover and new-session admission without restoring foregone',async()=>{
 const f=await transitionFixture(),oldClosure=hash(f.closed),oldBatch=hash(f.batch);
 await prepareRepairCandidate(f.args);const r=await nextDemoGame(f.args);
 assert.equal(r.completePreserved,1);assert.equal(r.abandonedAttempts,0);assert.equal(r.newBetAllowance,100);
 assert.equal(r.sourceRequests,0);assert.equal((await f.admit()).limit,5);
 assert.equal(f.docs.get('state/'+f.rk).value.status,'repaired-returned');
 assert.equal(hash(f.docs.get('journal/'+f.key+':complete').value),oldClosure);
 assert.equal(hash(f.docs.get('state/batch:'+f.args.basePlan.trialId+':1').value),oldBatch);
 assert.equal(f.closed.foregone,98);assert.equal(f.closed.newBetAllowance,0);
});
for(const failure of ['repair-cas','top-complete'])test('repair transition '+failure+' leaves source admission closed',async()=>{
 const f=await transitionFixture();await prepareRepairCandidate(f.args);
 const update=f.args.store.update.bind(f.args.store),create=f.args.store.create.bind(f.args.store);
 f.args.store.update=async(c,k,fn)=>{if(failure==='repair-cas'&&k===f.rk)throw Error('INJECTED_REPAIR');return update(c,k,fn);};
 f.args.store.create=async(c,k,v)=>{if(failure==='top-complete'&&k===f.top+':complete')throw Error('INJECTED_COMPLETE');return create(c,k,v);};
 await assert.rejects(nextDemoGame(f.args),/INJECTED/);await assert.rejects(f.admit(),/NEXT_GAME_NOT_COMPLETE/);
});
