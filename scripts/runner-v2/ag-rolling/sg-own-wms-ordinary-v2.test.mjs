import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
const R=new URL('../../../',import.meta.url);
const {analyzer}=await import(new URL('scripts/runner-v2/analyzer.mjs',R));
const {stable}=await import(new URL('scripts/runner-v2/mongo-writer.mjs',R));
const {verifyOwnWmsBusinessPage}=await import(new URL('scripts/runner-v2/ag-rolling/sg-own-wms-business.mjs',R));
const {deliverPage}=await import(new URL('scripts/runner-v2/ag-rolling/sg-business-delivery.mjs',R));
const {verifyBusinessPage}=await import(new URL('scripts/runner-v2/ag-rolling/sg-business-document.mjs',R));
const {parseXml,one}=await import(new URL('scripts/trial/pearl-protocol.mjs',R));
const fixture=fs.readFileSync(new URL('config/ag-rolling-own-wms-ordinary-v2-fixtures.json.gz',R));
const data=JSON.parse(gunzipSync(fixture));
const reg=JSON.parse(fs.readFileSync(new URL('config/ag-rolling-plans.json',R)));
const mods={};for(const [id,n]of [['32752','acorn'],['32759','crystalforest']])mods[id]={codec:(await import(new URL(`scripts/runner-v2/ag-rolling/sg-${n}-ordinary-codec-v2.mjs`,R)))[n+'Codec'],old:await import(new URL(`scripts/runner-v2/ag-rolling/sg-${n}-base.mjs`,R)),newer:await import(new URL(`scripts/runner-v2/ag-rolling/sg-${n}-ordinary-v2.mjs`,R))};
const summary={schema:'sg-own-wms-ordinary-v2-real-codec-replay',games:{},actualPythonIPC:true,sourceRequests:0,databaseWrites:0,productionReady:false,naturalFaultTerminalObserved:false};
for(const [id,m]of Object.entries(mods))test(`Own ordinary v2 ${id}: actual IPC, 1000 exact legacy records, full new records and business page`,{timeout:180000},async()=>{
 const plan=reg.ordinarySemanticPlans[id],oldPlan=reg.plans[id],session={session:'offline',setSession(s){this.session=s;}};
 const parser=analyzer({python:process.env.SG_TEST_PYTHON??'python3'});let calls=0;const counted={...parser,call:async x=>{calls++;return parser.call(x);}};
 let sequence=1,recordsHash=createHash('sha256'),legacyHash=createHash('sha256');
 const codec=await m.codec({plan,session,sequence:()=>sequence++,worker:0,batchId:1,createAnalyzer:()=>counted});
 let records=0,routes=0,legacy=0,negative=0,repaired=0,unchangedRejects=0;const page=[];
 try{
  const init=data.init[id];session.session=one(parseXml(init.requestPayload),'Header').a.sessionID;
  await codec.bootstrap(async()=>init);
  await assert.rejects(()=>parser.call({op:'plan',plan:{...plan,betRaw:plan.betRaw+1}}));
  for(const c of data.cases.filter(c=>c.gameId===id)){
   const raw={...structuredClone(c.raw),sourceKey:plan.sourceKey};session.session=one(parseXml(raw.steps[0].requestPayload),'Header').a.sessionID;
   if(c.kind==='negative'){
    await assert.rejects(()=>codec.next(raw),undefined,c.id);await assert.rejects(()=>parser.call({op:'next',plan,raw}),undefined,c.id);negative++;continue;
   }
   if(c.kind==='natural-closed-prefix'){
    if(/PAYLINE_NOT_REVIEWED|CASCADE_MASK_NOT_REVIEWED/.test(c.id)){
     assert.equal((await codec.next(raw)).MSGID,'EndGame');await assert.rejects(()=>codec.prepare(raw,{attempt:'incomplete',sessionHash:'a'.repeat(64)}));repaired++;
    }else{await assert.rejects(()=>codec.next(raw));await assert.rejects(()=>parser.call({op:'next',plan,raw}));unchangedRejects++;}
    continue;
   }
   for(let n=0;n<=raw.steps.length;n++){const prefix={...raw,steps:raw.steps.slice(0,n)};const next=await codec.next(prefix);assert.equal(next?.MSGID??null,n<raw.steps.length?raw.steps[n].msgId:null);routes++;}
   const record=(await codec.prepare(raw,{attempt:c.id,sessionHash:'a'.repeat(64)})).record;
   recordsHash.update(stable(record)+'\n');records++;page.push(record);
   if(page.length===100){
    await verifyOwnWmsBusinessPage({plan,records:page,parser});
    if(records===100){
     const binding=JSON.parse(fs.readFileSync('config/ag-business-bindings.json')).bindings[id],pool=new Map(),audit=[];
     const campaignId='sg_'+id+'-'+binding.queueId;
     const sink={plan,read:async ids=>ids.filter(key=>pool.has(key)).map(key=>structuredClone(pool.get(key))),
      insert:async docs=>{for(const d of docs){assert(!pool.has(d._id));pool.set(d._id,structuredClone(d));}}};
     const delivered=await deliverPage({records:page,binding,campaignId,parser,sink,batchId:'0:100',
      audit:{begin:async(key,v)=>audit.push({key,v}),end:async(key,v)=>audit.push({key,v})}});
     assert.equal(delivered.count,100);assert.equal(pool.size,100);assert.equal(audit.length,2);assert(audit[1].v.readbackVerified);
     verifyBusinessPage(page,delivered.documents,binding,campaignId);
     const bad=structuredClone(delivered.documents);bad[0].data.money.totalWinRaw++;assert.throws(()=>verifyBusinessPage(page,bad,binding,campaignId));
    }
    page.length=0;
   }
   // Verify exact old raw/normalized/content hashes with the old decoder and new-plan resume path.
   const oldFields=await parser.call({op:'fields',plan:oldPlan,raw:c.raw});
   const old=await parser.call({op:'record',plan:oldPlan,raw:c.raw,normalized:oldFields,sequence:records,attempt:c.id,sessionHash:'b'.repeat(64),worker:0,batchId:1});
   assert.equal((await parser.call({op:'verify',plan,raw:old.raw,record:old})).verified,true);
   assert.deepEqual(await parser.call({op:'fields',plan,raw:old.raw}),oldFields);
   await verifyOwnWmsBusinessPage({plan,records:[old],parser});legacyHash.update(stable(old)+'\n');legacy++;
   if(records===1){
    const wrong=structuredClone(record);wrong.raw.sourceKey=m.old.SOURCE;await assert.rejects(()=>parser.call({op:'verify',plan,raw:wrong.raw,record:wrong}));
    const changed=structuredClone(record);changed.raw.steps[0].responseBalance++;await assert.rejects(()=>parser.call({op:'verify',plan,raw:changed.raw,record:changed}));
    await assert.rejects(()=>parser.call({op:'intent',plan,raw:{...old.raw,steps:[]},payload:old.raw.steps[0].requestPayload}),/NO_LEGACY_REPLAY/);
   }
  }
  if(page.length)await verifyOwnWmsBusinessPage({plan,records:page,parser});
 }finally{codec.close();assert.equal((await parser.closeAndWait()).childClosed,true);}
 const proof=JSON.parse(fs.readFileSync(new URL('config/ag-rolling-own-wms-ordinary-wiring-v2.json',R))).actualWiring.games[id];
 assert.equal(records,1000);assert.equal(legacy,1000);assert.equal(repaired,1);
 assert.equal(recordsHash.digest('hex'),proof.newRecordsHash);assert.equal(legacyHash.digest('hex'),proof.oldRecordsHash);
 assert.equal(negative,proof.negatives);assert.equal(unchangedRejects,proof.unchangedRejectedFeatures);
});

test('Own ordinary v2 source factory keeps exact plan/binding, unknown record rejection and no legacy request replay',async()=>{
 const {createTaskRuntime}=await import('./sg-task-runtime.mjs');
 const {ownOrdinaryV2Plan,ownOrdinaryBinding,ownOrdinaryDecoder,policy}=await import('./sg-own-wms-ordinary-wiring-v2.mjs');
 const {ownWmsBusinessPlan}=await import('./sg-own-wms-business.mjs');
 const bindings=JSON.parse(fs.readFileSync('config/ag-business-bindings.json')).bindings;
 for(const id of ['32752','32759']){
  const plan=reg.ordinarySemanticPlans[id];assert(ownOrdinaryV2Plan(plan));assert(ownWmsBusinessPlan(plan));assert(ownWmsBusinessPlan(reg.plans[id]));
  assert(ownOrdinaryBinding(plan,bindings[id]));assert(!ownOrdinaryV2Plan({...plan,betRaw:plan.betRaw+1}));
  assert.throws(()=>ownOrdinaryBinding(plan,bindings[id==='32752'?'32759':'32752']));
  assert.throws(()=>ownOrdinaryDecoder(plan,{sourceKey:'unknown'}));
  const runtime=createTaskRuntime({store:{},transport:{},game:{gameId:id,baseline:0},queueId:'offline',kind:'canary',index:1,quota:10,owner:'offline-owner',plan,base:{mode:'demo',sessionId:'Free:offline',operatorId:'offline'},guard:async()=>{}});
  await assert.rejects(()=>runtime.protocol.open(),/SG_GITHUB_SOURCE_REQUIRED/);await runtime.close();
  const parser=analyzer({python:process.env.SG_TEST_PYTHON??'python3'});
  try{
   for(const bad of [{...plan,gameId:32764},{...plan,ordinarySemanticContract:'f'.repeat(64)},{...plan,sourceKey:reg.plans[id].sourceKey},{...plan,extra:1}])await assert.rejects(()=>parser.call({op:'plan',plan:bad}));
   assert.equal((await parser.call({op:'plan',plan})).validated,true);
  }finally{await parser.closeAndWait();}
 }
});

test('Own ordinary v2 resume binds both unchanged predecessor documents and its real codec proof',async()=>{
 const {rebaseResumeManifest}=await import('./sg-resume-manifest.mjs');
 const {queueHash}=await import('./sg-queue-profile.mjs');
 const {assertBusinessGameScope,ORIGINAL_BUSINESS_IDS,WMS_FIVE_PINS,assertOwnWmsBinding}=await import('./sg-own-wms-business.mjs');
 const bindings=JSON.parse(fs.readFileSync('config/ag-business-bindings.json')).bindings;
 const next=structuredClone(reg);
 for(const id of ['32752','32759']){next.plans[id]=reg.ordinarySemanticPlans[id];next.proofs[id]=reg.ordinarySemanticProofs[id];}
 for(const id of ['32752','32759']){
  const entry={gameId:id,dbName:'sg_'+id,campaignId:'offline',baseline:0,planHash:queueHash(reg.plans[id]),adapterProofHash:queueHash(reg.proofs[id])};
  const context={previous:{manifest:[entry]},previousPlans:reg,plans:next};
  const result=rebaseResumeManifest(context)[0];assert.equal(result.planHash,queueHash(next.plans[id]));assert.equal(result.adapterProofHash,queueHash(next.proofs[id]));
  for(const k of ['gameId','dbName','campaignId','baseline'])assert.equal(result[k],entry[k]);
  assert.throws(()=>rebaseResumeManifest({...context,completedGameIds:[id]}),/COMPLETED/);
  for(const part of ['previousPlans','plans'])for(const key of ['plans','proofs']){
   const bad=structuredClone(context);bad[part][key][id].unexpected='tampered';assert.throws(()=>rebaseResumeManifest(bad));
  }
  assertOwnWmsBinding(next.plans[id],bindings[id]);
 }
 assert.equal(assertBusinessGameScope([...ORIGINAL_BUSINESS_IDS,...Object.keys(WMS_FIVE_PINS)].map(gameId=>({gameId})),next.plans),86);
});
