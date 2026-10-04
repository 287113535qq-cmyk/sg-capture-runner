import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {mergeGame,cleanupMerged} from './sg-merge.mjs';
import {taskKey,prepareTasks} from './sg-task-store.mjs';
import {stagingPrefix,stagingLeaseKey} from './sg-staging-store.mjs';
import {sourceJournalKey} from './sg-source-journal.mjs';
import {activateQueue,sourcePermit} from './sg-queue-control.mjs';
import {queueHash,queueProfile} from './sg-queue-profile.mjs';
import {resetEndedTask} from './sg-resume.mjs';
import {createStagingStore} from './sg-staging-store.mjs';
function memory(){
 const docs=new Map(),formal=new Map(),calls=[];
 const store={docs,async writable(){},async get(c,k){return structuredClone(docs.get(c+'/'+k)??null);},
  async getMany(c,keys){return Promise.all(keys.map(k=>this.get(c,k)));},
  async create(c,k,v,{immutable=false}={}){const old=docs.get(c+'/'+k);
   if(old&&immutable)assert.equal(stable(old.value),stable(v));
   if(!old)docs.set(c+'/'+k,{_id:'primary/'+k,version:0,value:structuredClone(v)});return this.get(c,k);},
  async cas(c,k,b,v){const old=docs.get(c+'/'+k);if(old?.version!==b.version)return null;
   docs.set(c+'/'+k,{_id:'primary/'+k,version:b.version+1,value:structuredClone(v)});return this.get(c,k);}};
 const transport={calls,formal,async request(op,args){calls.push({op,args});
  if(op==='hello')return {group:'primary',database:'sg_capture_staging_v1',rollingJournalBatchEnabled:true,rollingCleanupEnabled:true,
   gatewaySha256:'a'.repeat(64),accessManifestHash:'b'.repeat(64)};
  if(op==='rolling_task_insert'){for(const r of args.records)await store.create('state',r.key,r.value);return {inserted:args.records.length};}
  if(op==='rolling_journal_insert'){for(const r of args.records)await store.create('journal',r.key,r.value);return {inserted:args.records.length};}
  if(op==='scan')return [...docs.values()].filter(d=>d._id>args.after&&d._id<'primary/'+args.key+'\uffff').sort((a,b)=>a._id.localeCompare(b._id)).slice(0,100).map(r=>structuredClone(r));
  if(op==='rolling_stage_copy'){for(const r of args.records){const record=(await store.get('journal',r.key)).value.record;
    if(!formal.has(r.id))formal.set(r.id,structuredClone(record));}return {acknowledged:true};}
  if(op==='rounds_read')return args.ids.map(id=>formal.get(id)).filter(Boolean).map(r=>structuredClone(r));
  if(op==='rounds_count')return {count:formal.size};
  if(op==='rolling_journal_delete'){let deleted=0;for(const k of args.keys)deleted+=Number(docs.delete('journal/'+k));return {deleted};}
  assert.fail(op);
 }};
 return {store,transport};
}
const game={gameId:'32723',dbName:'sg_32723',campaignId:'sg_32723-queue',baseline:299980,mongoUri:'sg-native://primary/sg_32723'};
const plan={trialId:'sg_ag_r1_20261004_32723'},guard=async()=>{};
async function ready(){
 const m=memory();await prepareTasks({...m,game,queueId:'queue',guard});
 for(let i=1;i<=20;i++){
  const owner='old:'+i,id='worker:'+i,prefix=stagingPrefix('queue',game,'worker',i),sessionHash=queueHash(['session',i]);
  const record={_id:queueHash(['round',i]),contentHash:queueHash(['content',i]),sequence:i,sourceSessionHash:sessionHash,
   raw:{steps:[{rollingSource:{sessionHash,requestNo:3}}]}};
  await m.store.create('journal',prefix+'0000000001',{queueId:'queue',gameId:game.gameId,campaignId:game.campaignId,
   taskId:id,owner,ordinal:1,record});
  for(const type of ['intent','response'])await m.store.create('journal',sourceJournalKey({queueId:'queue',game,kind:'worker',index:i,
   owner,sessionHash,requestNo:3,type}),{retained:true});
  const proof={queueId:'queue',gameId:game.gameId,campaignId:game.campaignId,taskId:id,owner,count:1,
   fullReadback:true,independentlyVerified:true,pending:0,unknownRequests:0,activeLeases:0,
   recordsHash:createHash('sha256').update(stable(record)+'\n').digest('hex')};
  const key=taskKey('queue',game,id),before=await m.store.get('state',key);
  await m.store.cas('state',key,before,{...before.value,status:'success',owner,count:1,proof});
 }
 return m;
}
const args=m=>({...m,game,queueId:'queue',plan,guard,owner:'controller',
 verifyRecords:async rows=>({verified:true,count:rows.length}),inspectBaseline:async()=>({verified:true,count:game.baseline})});
test('AG per-game merge copies only selected quotas, reads every native byte, and preserves a complete receipt after cleanup',async()=>{
 const m=await ready();await m.store.create('journal','unrelated',{preserve:true});
 const result=await mergeGame({...args(m),cleanup:true});assert.equal(result.count,300000);assert.equal(m.transport.formal.size,20);
 assert.equal(m.transport.calls.filter(c=>c.op==='rolling_stage_copy').length,20);
 assert.equal([...m.store.docs.keys()].filter(k=>k.includes('rolling-stage:')).length,0);
 assert.deepEqual((await m.store.get('journal','unrelated')).value,{preserve:true});
 const writes=m.transport.calls.length;assert.deepEqual(await mergeGame(args(m)),result);
 assert.equal(m.transport.calls.length,writes,'completed proof is checked without re-copying deleted staging');
});
test('one live lease or changed task evidence blocks formal merge before any native write',async()=>{
 const m=await ready();await m.store.create('state',stagingLeaseKey('queue',game,'worker',7),{owner:'still-live',expiresAt:Date.now()+60000});
 assert.equal((await mergeGame(args(m))).status,'active');assert.equal(m.transport.formal.size,0);
 const lease=await m.store.get('state',stagingLeaseKey('queue',game,'worker',7));
 await m.store.cas('state',stagingLeaseKey('queue',game,'worker',7),lease,{expiresAt:0});
 const key=stagingPrefix('queue',game,'worker',7)+'0000000001';m.store.docs.get('journal/'+key).value.record.sequence=99;
 await assert.rejects(()=>mergeGame(args(m)),/STAGE_CHANGED/);assert.equal(m.transport.formal.size,0);
});
test('unknown copy acknowledgement is issued once, retains staging, and does not authorize cleanup or another copy',async()=>{
 const m=await ready(),request=m.transport.request.bind(m.transport);let writes=0;
 m.transport.request=async(op,a)=>{if(op==='rolling_stage_copy'){writes++;await request(op,a);throw Object.assign(new Error('MONGO_OPERATION_OUTCOME_UNKNOWN'),{outcomeUnknown:true});}return request(op,a);};
 await assert.rejects(()=>mergeGame({...args(m),cleanup:true}));assert.equal(writes,1);
 assert.equal([...m.store.docs.keys()].filter(k=>k.includes('rolling-stage:')).length,20);
 assert.equal((await mergeGame(args(m))).status,'merging');assert.equal(writes,1);
});
test('ended merge actor can settle an unknown Mongo ACK only after fresh readback, issuing only definitely missing rows',async()=>{
 const m=await ready(),request=m.transport.request.bind(m.transport);let failed=false;
 m.transport.request=async(op,a)=>{const result=await request(op,a);
  if(op==='rolling_stage_copy'&&!failed){failed=true;throw Object.assign(new Error('MONGO_OPERATION_OUTCOME_UNKNOWN'),{outcomeUnknown:true});}
  return result;};
 await assert.rejects(()=>mergeGame(args(m)));assert.equal(m.transport.formal.size,1);
 await assert.rejects(()=>mergeGame({...args(m),recoverMerging:async p=>({actorEnded:false,owner:p.owner,sourceRequests:0})}),/ENDED_ACTOR/);
 const result=await mergeGame({...args(m),owner:'ended-review-controller',recoverMerging:async p=>({actorEnded:true,owner:p.owner,sourceRequests:0})});
 assert.equal(result.count,300000);assert.equal(m.transport.formal.size,20);
 const issued=m.transport.calls.filter(c=>c.op==='rolling_stage_copy').flatMap(c=>c.args.records.map(r=>r.id));
 assert.equal(issued.length,20);assert.equal(new Set(issued).size,20,'unknown first insert is never reissued');
});
test('missing independent row count and extra native formal records fail closed with all staging retained',async()=>{
 const first=await ready();await assert.rejects(()=>mergeGame({...args(first),verifyRecords:async()=>({verified:true,count:0})}),/INDEPENDENT/);
 assert.equal(first.transport.formal.size,0);
 const second=await ready();second.transport.formal.set('foreign',{unexpected:true});
 await assert.rejects(()=>mergeGame({...args(second),cleanup:true}),/FORMAL_COUNT/);
 assert.equal([...second.store.docs.keys()].filter(k=>k.includes('rolling-stage:')).length,20);
});
test('queue activation provisions all 22 tasks in batches before source permission and rejects concurrent admission',async()=>{
 const m=memory(),profile={activation:'a'.repeat(64),codeCommit:'b'.repeat(40),linuxRun:123,
  nativeGatewayHash:'a'.repeat(64),nativeManifestHash:'b'.repeat(64),payload:{queueId:'queue',games:[game]}};
 const common={...m,profile,run:'456:1',commit:'c'.repeat(40),boundary:guard,checkBaselines:guard,
  checkNewGame:guard,
  readLinux:async()=>({status:'completed',conclusion:'success',head_sha:profile.codeCommit,path:'.github/workflows/preflight.yml'})};
 await assert.rejects(()=>sourcePermit(common),/PERMISSION/);
 const result=await activateQueue(common);assert.equal(result.games,1);assert.equal(result.sourceRequests,0);
 assert.equal(m.transport.calls.filter(c=>c.op==='rolling_task_insert').length,1);
 assert.equal([...m.store.docs.keys()].filter(k=>k.includes('rolling-task:')).length,22);
 await sourcePermit(common);await assert.rejects(()=>activateQueue(common),/ALREADY_ACTIVATED/);
 await assert.rejects(()=>sourcePermit({...common,commit:'d'.repeat(40)}),/PERMISSION/);
});
test('negative Linux receipt never writes a source fence or tasks',async()=>{
 const m=memory();await assert.rejects(()=>activateQueue({...m,profile:{linuxRun:1,codeCommit:'a'.repeat(40)},
  run:'456:1',commit:'c'.repeat(40),boundary:guard,checkBaselines:guard,readLinux:async()=>({conclusion:'failure'})}),/LINUX/);
 assert.equal(m.store.docs.size,0);
});
test('registered queue binds unchanged AG payload, exact code bytes, plan history and installed native adapter',()=>{
 const g={...game,baseline:0},plan={gameId:32723,buy:0,target:300000};
 const proof={planHash:queueHash(plan),acceptedBaseRounds:10,formalAdmission:'requires-two-AG-live-canaries'};
 const plans={schema:'sg-ag-rolling-plan-registry-v1',sourceAllowance:0,plans:{32723:plan},proofs:{32723:proof},alreadyComplete:[]};
 const bytes=Buffer.from('fixed\n'),files=Object.fromEntries(Array.from({length:301},(_,i)=>['scripts/fixture/file-'+i+'.mjs',createHash('sha256').update(bytes).digest('hex')]));
 const unsigned={schema:'sg-ag-rolling-queue-v1',group:'primary',target:300000,lanes:20,sessionsPerLane:8,canaries:2,canaryRounds:10,
  stagingOveragePerLane:7,codeCommit:'a'.repeat(40),linuxRun:123,planRegistryHash:queueHash(plans),files,
  nativeGatewayHash:'a'.repeat(64),nativeManifestHash:'b'.repeat(64),payload:{version:1,queueId:'queue',games:[g]},
  manifest:[{...g,phase:'ready',planHash:queueHash(plan),adapterProofHash:queueHash(proof)}]};
 const profile={...unsigned,activation:queueHash(unsigned)},name=`ag-rolling-queue-${profile.activation}.json`;
 const authorization={schema:'sg-ag-rolling-authorizations-v1',sourceAllowance:0,profiles:{[name]:{profileHash:queueHash(profile)}}};
 const options={name,profile,authorization,plans,readBytes:()=>bytes};assert.equal(queueProfile(options),profile);
 awaitReject(()=>queueProfile({...options,readBytes:()=>Buffer.from('changed')}),/RUNTIME_CHANGED/);
 const changed=structuredClone(profile);changed.payload.games[0].baseline=5;awaitReject(()=>queueProfile({...options,profile:changed}),/AUTHORIZATION/);
 awaitReject(()=>queueProfile({...options,plans:{...plans,alreadyComplete:[32723]}}),/CODE_PROOF/);
});
function awaitReject(call,pattern){assert.throws(call,pattern);}
async function partialCanary(){
 const m=memory(),owner='previous:1:canary:1',sessionHash=queueHash(['partial-session']);
 await prepareTasks({...m,game,queueId:'queue',guard});
 const key=taskKey('queue',game,'canary:1'),before=await m.store.get('state',key);
 await m.store.cas('state',key,before,{...before.value,owner,status:'failed'});
 for(let n=1;n<=5;n++){
  const requestPayload='GN=fixture&MSGID=BET',step={requestPayload,msgId:'BET',rollingSource:{sessionHash,requestNo:n}};
  const intent={queueId:'queue',gameId:game.gameId,kind:'canary',index:1,owner,sessionHash,requestNo:n,msgId:'BET',requestPayload};
  for(const type of ['intent','response'])await m.store.create('journal',sourceJournalKey({queueId:'queue',game,kind:'canary',index:1,owner,sessionHash,requestNo:n,type}),
   type==='response'?{...intent,step}:intent);
  const record={_id:queueHash(['old',n]),contentHash:queueHash(['old-content',n]),fixtureOnly:false,buy:0,gameId:32723,
   sourceSessionHash:sessionHash,sequence:n,raw:{steps:[step]}};
  await m.store.create('journal',stagingPrefix('queue',game,'canary',1)+String(n).padStart(10,'0'),
   {queueId:'queue',gameId:game.gameId,campaignId:game.campaignId,taskId:'canary:1',owner,ordinal:n,record});
 }
 const unresolved=sourceJournalKey({queueId:'queue',game,kind:'canary',index:1,owner,sessionHash,requestNo:6,type:'intent'});
 await m.store.create('journal',unresolved,{unresolved:true});return {...m,key,unresolved};
}
const ended={status:'completed',sourceJobsEnded:true,queueId:'queue',run:'123:1',proofHash:'a'.repeat(64)};
test('ended AG task resumes only native verified complete prefix; unknown final intent is preserved without replay',async()=>{
 const m=await partialCanary(),verifyRecords=async rows=>({verified:true,count:rows.length});
 const task=await resetEndedTask({...m,game,queueId:'queue',kind:'canary',index:1,guard,verifyRecords,ended});
 assert.equal(task.status,'pending');assert.equal(task.resume.count,5);assert.equal(m.transport.formal.size,0);
 const row=await m.store.get('state',m.key),owner='next:1:canary:1';
 await m.store.cas('state',m.key,row,{...row.value,status:'running',owner});let resumed;
 const source={queueId:'queue',gameId:game.gameId,taskId:'canary:1',owner,pending:0,unknownRequests:0,protocolFaults:0,activeLeases:0,sourcesClosed:true};
 const storage=createStagingStore({...m,game,queueId:'queue',kind:'canary',index:1,quota:10,owner,guard,verifyRecords,
  resume:task.resume,onResume:n=>{resumed=n;},assertDurable:async()=>{},inspectSource:async()=>source});
 try{
  assert.equal((await storage.getCounts(game.dbName)).base,5);assert.equal(resumed,5);
  for(let n=6;n<=10;n++)await storage.insertRound(game.dbName,{data:{sgRecord:{_id:queueHash(['new',n]),contentHash:queueHash(['new-content',n]),
   fixtureOnly:false,buy:0,gameId:32723,sequence:n}}});
  const proof=await storage.verify();assert.equal(proof.count,10);assert.deepEqual(proof.segments,
   [{first:1,last:5,owner:'previous:1:canary:1'},{first:6,last:10,owner}]);
  assert((await m.store.get('journal',m.unresolved)).value.unresolved);
  assert.equal(m.transport.calls.filter(c=>c.op==='rolling_stage_copy').length,0);
 }finally{await storage.close();}
});
test('resume requires ended actor and no live lease, and refuses missing response or changed accepted source bytes',async()=>{
 const m=await partialCanary(),common={...m,game,queueId:'queue',kind:'canary',index:1,guard,verifyRecords:async rows=>({verified:true,count:rows.length}),ended};
 await assert.rejects(()=>resetEndedTask({...common,ended:{...ended,status:'in_progress'}}),/ENDED_SOURCE/);
 const leaseKey=stagingLeaseKey('queue',game,'canary',1);await m.store.create('state',leaseKey,{owner:'previous',expiresAt:Date.now()+60000});
 await assert.rejects(()=>resetEndedTask(common),/LIVE_LEASE/);
 const lease=await m.store.get('state',leaseKey);await m.store.cas('state',leaseKey,lease,{owner:'previous',expiresAt:0});
 const responseKey=[...m.store.docs.keys()].find(k=>k.endsWith(':0000000003:response'));
 m.store.docs.get(responseKey).value.step.msgId='CHANGED';
 await assert.rejects(()=>resetEndedTask(common),/SOURCE_CHANGED/);
 assert.equal((await m.store.get('state',m.key)).value.status,'failed');
 m.store.docs.delete(responseKey);await assert.rejects(()=>resetEndedTask(common),/SOURCE_MISSING/);
});
async function successfulCanary(){
 const m=await partialCanary();m.store.docs.delete('journal/'+m.unresolved);
 const prefix=stagingPrefix('queue',game,'canary',1),first=(await m.store.get('journal',prefix+'0000000001')).value;
 const owner=first.owner,sessionHash=first.record.sourceSessionHash;
 for(let n=6;n<=10;n++){
  const row=structuredClone(first),step=row.record.raw.steps[0];step.rollingSource.requestNo=n;
  row.ordinal=n;row.record._id=queueHash(['old',n]);row.record.contentHash=queueHash(['old-content',n]);row.record.sequence=n;
  const intent={queueId:'queue',gameId:game.gameId,kind:'canary',index:1,owner,sessionHash,requestNo:n,msgId:'BET',requestPayload:step.requestPayload};
  for(const type of ['intent','response'])await m.store.create('journal',sourceJournalKey({queueId:'queue',game,kind:'canary',index:1,
   owner,sessionHash,requestNo:n,type}),type==='response'?{...intent,step}:intent);
  await m.store.create('journal',prefix+String(n).padStart(10,'0'),row);
 }
 const hash=createHash('sha256');for(let n=1;n<=10;n++)hash.update(stable((await m.store.get('journal',prefix+String(n).padStart(10,'0'))).value.record)+'\n');
 const before=await m.store.get('state',m.key),proof={queueId:'queue',gameId:game.gameId,campaignId:game.campaignId,
  taskId:'canary:1',owner,count:10,recordsHash:hash.digest('hex'),segments:[{first:1,last:10,owner}],
  fullReadback:true,independentlyVerified:true,pending:0,unknownRequests:0,activeLeases:0};
 await m.store.cas('state',m.key,before,{...before.value,status:'success',exitCode:0,owner,count:10,proof});return m;
}
test('a revised adapter revalidates successful native rounds and source bytes without resetting or writing the task',async()=>{
 const m=await successfulCanary(),before=queueHash([...m.store.docs]);m.transport.calls.length=0;let verified=0;
 const task=await resetEndedTask({...m,game,queueId:'queue',kind:'canary',index:1,guard,ended,
  verifyRecords:async rows=>{verified+=rows.length;return {verified:true,count:rows.length};}});
 assert.equal(verified,10);assert.equal(task.status,'success');assert.equal(task.count,10);
 assert.equal(queueHash([...m.store.docs]),before);assert.equal(m.transport.formal.size,0);
 assert.ok(m.transport.calls.every(c=>c.op==='scan'));
});
test('changed normalization, native prefix, durable response or live owner blocks successful task reuse',async()=>{
 for(const type of ['normalizer','prefix','response','lease','task-race','active-source']){
  const m=await successfulCanary(),common={...m,game,queueId:'queue',kind:'canary',index:1,guard,ended,
   verifyRecords:async rows=>({verified:true,count:rows.length})};
  let pattern;
  if(type==='normalizer'){common.verifyRecords=async()=>({verified:false,count:10});pattern=/INDEPENDENT/;}
  if(type==='prefix'){m.store.docs.get('journal/'+stagingPrefix('queue',game,'canary',1)+'0000000003').value.record.contentHash='c'.repeat(64);pattern=/PREFIX_CHANGED/;}
  if(type==='response'){const key=[...m.store.docs.keys()].find(k=>k.endsWith(':0000000003:response'));
   m.store.docs.get(key).value.step.msgId='CHANGED';pattern=/SOURCE_CHANGED/;}
  if(type==='lease'){await m.store.create('state',stagingLeaseKey('queue',game,'canary',1),{expiresAt:Date.now()+60000});pattern=/LIVE_LEASE/;}
  if(type==='task-race'){let checks=0;common.guard=async()=>{if(++checks===3)m.store.docs.get('state/'+m.key).value.owner='foreign';};pattern=/TASK_CHANGED/;}
  if(type==='active-source'){common.ended={...ended,status:'in_progress'};pattern=/ENDED_SOURCE/;}
  await assert.rejects(()=>resetEndedTask(common),pattern);assert.equal((await m.store.get('state',m.key)).value.status,'success');
 }
});
test('a pending resumed prefix is checked again and cannot cross windows with an altered immutable receipt',async()=>{
 const m=await partialCanary(),common={...m,game,queueId:'queue',kind:'canary',index:1,guard,ended,
  verifyRecords:async rows=>({verified:true,count:rows.length})};
 const task=await resetEndedTask(common),before=queueHash([...m.store.docs]);
 assert.deepEqual(await resetEndedTask(common),task);assert.equal(queueHash([...m.store.docs]),before);
 m.store.docs.get('journal/'+task.resume.receiptKey).value.endedProofHash='b'.repeat(64);
 await assert.rejects(()=>resetEndedTask(common),/PENDING_RECEIPT/);assert.equal((await m.store.get('state',m.key)).value.resume.count,5);
});
