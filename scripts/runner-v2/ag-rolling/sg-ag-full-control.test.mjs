import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import test from 'node:test';
import {createSgAgFullControlAdapter} from './sg-ag-full-control-adapter.mjs';
import {taskKey} from './sg-task-store.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';
import {analyzer} from '../analyzer.mjs';
import {deliverPage} from './sg-business-delivery.mjs';
import {businessDocument} from './sg-business-document.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {COMPLETED_NATIVE_PROOF} from './sg-ag-completed-prefix.mjs';
import {readControlAppendCursor} from './sg-ag-control-journal-cursor.mjs';
const commit='a'.repeat(40),queueId='queue',cohortRun='123:1';
function fixture(options={}){
 const games=['32442','32529'].map(id=>({gameId:id,dbName:'sg_'+id,campaignId:'sg_'+id+'-'+queueId,baseline:0,phase:'ready'}));const state={version:1,queueId,runId:123,phase:'running',games};
 const docs=new Map(),counts=new Map(games.map(g=>[g.gameId,Array(20).fill(15000)])),events=[],receipts=new Map(),campaign=new Map(games.map(g=>[g.gameId,0]));let closed=0,finalized=0;
 const store={async get(c,k){return structuredClone(docs.get(c+'/'+k)??null);},async getMany(c,ks){return Promise.all(ks.map(k=>this.get(c,k)));},async cas(c,k,b,v){const old=docs.get(c+'/'+k);assert(old);if(old.version!==b.version)return false;docs.set(c+'/'+k,{version:b.version+1,value:structuredClone(v)});events.push({type:'cas',taskId:v._id,status:v.status});if(options.unknownCas)throw Object.assign(Error('unknown-cas'),{outcomeUnknown:true});return true;}};
 for(const g of games)for(const [kind,n] of [['canary',2],['worker',20]])for(let i=1;i<=n;i++)docs.set('state/'+taskKey(queueId,g,kind+':'+i),{version:0,value:{_id:kind+':'+i,queueId,campaignId:g.campaignId,status:'success',owner:'123-1:'+i+':'+kind+':'+i,proof:{fullReadback:true,independentlyVerified:true,count:kind==='worker'?15000:10,recordsHash:'b'.repeat(64)}}});
 const jobs=Array.from({length:20},(_,i)=>({name:'AG rolling lane '+(i+1),status:'in_progress',conclusion:null}));
 const io={async guard(operation,g){events.push({type:'guard',operation,gameId:g?.gameId});if(options.gateFails&&options.gateFails===g?.gameId)throw Error('protected-gate-stop');},
  async readJobs(){return {run:cohortRun,commit,at:Date.now(),total_count:20,jobs};},async readRun(){return {run:cohortRun,commit,at:Date.now(),status:options.workflowEnded?'completed':'in_progress'};},persist(file,value){events.push({type:'persist',file,value});return options.badDurability?{fullReadback:false}:{fullReadback:true};},
  async verifyPrefix(g,index){events.push({type:'validate',gameId:g.gameId,index});if(options.unknownPrefix===g.gameId)throw Object.assign(Error('unknown-prefix-read'),{outcomeUnknown:true});if(options.badPrefix===g.gameId)throw Error('prefix-invalid');return {queueId,gameId:g.gameId,campaignId:g.campaignId,taskId:'worker:'+index,count:counts.get(g.gameId)[index-1],recordsHash:'b'.repeat(64),fullReadback:true,independentlyVerified:true,acceptedUnknownRequests:options.prefixUnknown===g.gameId?1:0};},
  async inspectPriorOperation(g){return {canStartOnce:!receipts.has(g.gameId)&&options.existingIntent!==g.gameId};},
  async ensureNative(g,selection){events.push({type:'native',gameId:g.gameId,selection});return {count:selection.total,selected:selection.selected,fullReadback:true,independentlyVerified:true};},
  async deliverBusiness(g,native){events.push({type:'business',gameId:g.gameId});if(options.unknownBusiness===g.gameId)throw Object.assign(Error('unknown-business'),{outcomeUnknown:true});await options.business?.(g);const v={gameId:g.gameId,queueId,campaignCount:300000,originalCount:100,businessCount:300100,originalUnchanged:true,fullReadback:true,independentlyVerified:true};receipts.set(g.gameId,v);campaign.set(g.gameId,300000);return v;},
  async countBusiness(g){events.push({type:'count',gameId:g.gameId});return {captureBaseline:g.baseline,campaignCount:campaign.get(g.gameId)};},
  async inspectBusiness(g){events.push({type:'full-target-audit',gameId:g.gameId});return {captureBaseline:g.baseline,campaignCount:campaign.get(g.gameId),originalUnchanged:true,fullReadback:true,invalid:0};},async readBusinessReceipt(g){return receipts.get(g.gameId);},async finishGame(g){events.push({type:'finalize',gameId:g.gameId});return {fullReadback:true,originalEvidencePreserved:true};},async close(){closed++;},
  async assertResumeBoundary(){events.push({type:'resume-boundary'});assert(options.resumeEnded===true,'full-current-ended-federation-required');},async resetEndedTask(g,row){events.push({type:'reset',gameId:g.gameId,taskId:row._id});assert(!row.unknownRequests,'unknown-source-prefix-retained');const key=taskKey(queueId,g,row._id),before=await store.get('state',key);await store.cas('state',key,before,{...before.value,status:'pending',resume:{knownPrefixPreserved:true}});},async dispatchRemaining(s,remaining){events.push({type:'dispatch',games:remaining.map(g=>g.gameId)});},async finishCohort(){finalized++;},
  async sealSettlement(g,intent){events.push({type:'settle-intent',gameId:g.gameId,intent});return {fullReadback:true};},async ackSettlement(g){events.push({type:'settle-ack',gameId:g.gameId});},recordException(v){events.push({type:'exception',...v});}
 };
 const api=createSgAgFullControlAdapter({state,cohortRun,commit,queueId,store,io});
 function edit(gameIndex,index,delta){const g=games[gameIndex],r=docs.get('state/'+taskKey(queueId,g,'worker:'+index));Object.assign(r.value,delta);}
 return {api,state,games,docs,store,io,events,counts,jobs,edit,receipts,get closed(){return closed;},get finalized(){return finalized;}};
}
test('original AG controller reaches final business within its own per-game merge call while all other lanes remain live',async()=>{const f=fixture();await f.api.reconcile();assert(f.games.every(g=>g.phase==='complete'));for(const g of f.games){const sequence=f.events.filter(e=>e.gameId===g.gameId&&['native','business','finalize'].includes(e.type)).map(e=>e.type);assert.deepEqual(sequence,['native','business','finalize']);}assert.equal(f.state.phase,'running');assert.equal(f.finalized,0);});

test('ready-game exception durably isolates its state before the suffix and does not retry on another pass',async()=>{
 const f=fixture({badPrefix:'32442'});await f.api.reconcile();
 const index=f.events.findIndex(e=>e.type==='exception'),saved=f.events[index-1];
 assert.equal(saved.type,'persist');assert.equal(saved.file,'own-control-state');
 const game=saved.value.games.find(g=>g.gameId==='32442');
 assert.equal(game.phase,'blocked');assert.equal(game.reason,f.events[index].error);
 assert.equal(f.games[1].phase,'complete');await f.api.reconcile();
 assert.equal(f.events.filter(e=>e.type==='validate'&&e.gameId==='32442').length,1);
});

test('newly failed state and trailing exception satisfy the existing strict restart cursor without weakening it',async()=>{
 const f=fixture({badPrefix:'32442'});f.games[1].phase='blocked';f.games[1].reason='SG_OWN_FEATURE_REPAIR_REQUIRED';
 const key='rolling-ag-control:'+queueHash([queueId,cohortRun,commit]),journals=new Map();let saved,sequence=0;
 const journal=(file,value)=>{const id=key+':'+(++sequence);journals.set(id,{_id:'primary/'+id,version:0,value:{file,value:structuredClone(value),cohortRun,commit}});return id;};
 f.io.persist=(file,value)=>{const id=journal(file,value);if(file==='own-control-state')saved={_id:'primary/'+key,version:sequence,value:{state:structuredClone(value),cohortRun,commit,sequence,journal:id}};return {fullReadback:true};};
 f.io.recordException=row=>journal('own-exception-state',row);
 await f.api.reconcile();const before=structuredClone([...journals]);
 const store={get:async(c,k)=>structuredClone(c==='state'?saved:journals.get(k)??null),getMany:async(c,keys)=>keys.map(k=>structuredClone(journals.get(k)??null))};
 const result=await readControlAppendCursor({store,key,saved,cohortRun,commit,maxTail:4});
 assert.equal(result.retainedExceptionCount,1);assert.equal(result.sequence,sequence);assert.deepEqual([...journals],before);
});

test('exception persistence uncertainty produces no orphan exception and stops before the next game',async()=>{
 const f=fixture({badPrefix:'32442'});f.io.persist=()=>{throw Object.assign(Error('retained-state-write-unknown'),{outcomeUnknown:true});};
 await assert.rejects(f.api.reconcile(),/retained-state-write-unknown/);
 assert(!f.events.some(e=>e.type==='exception'||e.type==='business'));
 assert.equal(f.games[1].phase,'ready');
});

function completedFixture(change){
 const f=fixture(),ordinary=f.io.verifyPrefix,native={count:300000,selected:Array(20).fill(15000),recordsHash:'d'.repeat(64),fullReadback:true,independentlyVerified:true};
 f.io.verifyPrefix=async(g,index)=>{const p=await ordinary(g,index);if(g.gameId!=='32442')return p;
  const row=(await f.store.get('state',taskKey(queueId,g,'worker:'+index))).value;
  const proof={...p,proofKind:COMPLETED_NATIVE_PROOF,recordsHash:'e'.repeat(64),recordsOrder:'record-id-ascending',taskHash:queueHash(row),
   originalTaskProofHash:queueHash(row.proof),originalPrefixRecordsHash:row.proof.recordsHash,originalPrefixHashRecomputed:false,
   selectedNativeCount:15000,retainedExcessCount:0,nativeSelectedCount:300000,nativeRecordsHash:native.recordsHash,nativeReceiptHash:queueHash(native)};
  change?.(proof,index);return proof;
 };
 const ensure=f.io.ensureNative;f.io.ensureNative=async(g,s)=>{const result=await ensure(g,s);return g.gameId==='32442'?native:result;};return f;
}
test('completed native selection reaches final business with a distinct fresh hash and immutable historical task binding',async()=>{
 const f=completedFixture();await f.api.reconcile();assert(f.games.every(g=>g.phase==='complete'));
 const proofs=f.events.find(e=>e.type==='native'&&e.gameId==='32442').selection.proofs;
 assert(proofs.every(p=>p.recordsHash!==p.originalPrefixRecordsHash&&p.originalPrefixHashRecomputed===false));
});
test('completed native proof cannot bypass historical identity, quotas, whole receipt or honest hash provenance',async()=>{
 for(const change of [p=>p.taskHash='f'.repeat(64),p=>p.originalTaskProofHash='f'.repeat(64),p=>p.originalPrefixRecordsHash='f'.repeat(64),
  p=>p.originalPrefixHashRecomputed=true,p=>p.selectedNativeCount=14999,p=>p.nativeSelectedCount=299999,
  p=>p.nativeReceiptHash='f'.repeat(64),p=>p.nativeRecordsHash='f'.repeat(64),p=>delete p.proofKind]){
  const f=completedFixture(change);await f.api.reconcile();assert.notEqual(f.games[0].phase,'complete');assert.equal(f.games[1].phase,'complete');
  assert(!f.events.some(e=>e.type==='business'&&e.gameId==='32442'));
 }
});
test('AG count operations do not repeat the final full audit, and fresh counts still gate cleanup',async()=>{
 for(const changed of [false,true]){const f=fixture(),count=f.io.countBusiness.bind(f.io);let reads=0;
  f.io.countBusiness=async g=>{const result=await count(g);if(g.gameId==='32442'&&++reads===2&&changed)result.campaignCount--;return result;};
  await f.api.reconcile();
  for(const g of f.games)assert.equal(f.events.filter(e=>e.gameId===g.gameId&&e.type==='full-target-audit').length,1);
  assert.equal(f.events.filter(e=>e.gameId==='32442'&&e.type==='count').length,2);
  assert.equal(f.games[0].phase,changed?'blocked':'complete');assert.equal(f.games[1].phase,'complete');
  assert.equal(f.events.some(e=>e.gameId==='32442'&&e.type==='finalize'),!changed);
 }
});
test('full target validation remains mandatory even when both AG counts match',async()=>{const f=fixture();f.io.inspectBusiness=async g=>({captureBaseline:0,campaignCount:300000,fullReadback:g.gameId!=='32442',originalUnchanged:true,invalid:0});await f.api.reconcile();assert.equal(f.games[0].phase,'blocked');assert.equal(f.games[0].sgFailedGamePhase,'merging');assert.equal(f.games[1].phase,'complete');assert(!f.events.some(e=>e.gameId==='32442'&&e.type==='finalize'));});
test('a live canary lease in the batched inventory blocks merge and a short reply fails closed',async()=>{
 for(const short of [false,true]){const f=fixture(),getMany=f.store.getMany.bind(f.store);let leasePages=0;
  if(!short)f.docs.set('state/'+stagingLeaseKey(queueId,f.games[0],'canary',2),{value:{expiresAt:Date.now()+60000}});
  f.store.getMany=async(c,keys)=>{const result=await getMany(c,keys);if(keys[0]===stagingLeaseKey(queueId,f.games[0],'canary',1)){leasePages++;if(short)result.pop();}return result;};
  await f.api.reconcile();assert.equal(leasePages,1);assert.equal(f.games[0].phase,short?'blocked':'ready');assert.equal(f.games[1].phase,'complete');assert(!f.events.some(e=>e.gameId==='32442'&&e.type==='native'));
 }
});
test('failed terminal worker with independently validated full quota follows original AG selection without rewriting status success',async()=>{const f=fixture();f.edit(0,1,{status:'failed'});await f.api.reconcile();assert.equal(f.games[0].phase,'complete');assert.equal((await f.store.get('state',taskKey(queueId,f.games[0],'worker:1'))).value.status,'failed');assert.deepEqual(f.events.find(e=>e.type==='native').selection.selected,Array(20).fill(15000));});
test('insufficient failed game is blocked and retained; next game reaches its final business target',async()=>{const f=fixture();f.edit(0,1,{status:'failed'});f.counts.get('32442')[0]=0;await f.api.reconcile();assert.equal(f.games[0].phase,'blocked');assert.equal(f.games[1].phase,'complete');assert(!f.events.some(e=>e.gameId==='32442'&&e.type==='native'));});
test('actual ended-node owner projection seals only the exact owning task before per-game merge',async()=>{const f=fixture();f.edit(0,1,{status:'running'});f.jobs[0]={...f.jobs[0],status:'completed',conclusion:'failure'};f.counts.get('32442')[0]=0;await f.api.reconcile();assert.equal((await f.store.get('state',taskKey(queueId,f.games[0],'worker:1'))).value.status,'failed');assert.equal(f.games[1].phase,'complete');assert.equal(f.events.filter(e=>e.type==='settle-intent').length,1);assert(f.events.findIndex(e=>e.type==='settle-ack')<f.events.findIndex(e=>e.type==='validate'));});
test('normal-success ended lane keeps its not-started share pending and other games continue',async()=>{const f=fixture();f.edit(0,20,{status:'pending',owner:undefined});f.jobs[19]={...f.jobs[19],status:'completed',conclusion:'success'};await f.api.reconcile();assert.equal((await f.store.get('state',taskKey(queueId,f.games[0],'worker:20'))).value.status,'pending');assert.equal(f.games[1].phase,'complete');assert(!f.events.some(e=>e.type==='settle-intent'));});
test('abnormal ended lane marks its pending share blocked without resetting other tasks',async()=>{const f=fixture();f.edit(0,20,{status:'pending',owner:undefined});f.jobs[19]={...f.jobs[19],status:'completed',conclusion:'failure'};f.counts.get('32442')[19]=0;await f.api.reconcile();assert.equal((await f.store.get('state',taskKey(queueId,f.games[0],'worker:20'))).value.status,'blocked');assert.equal(f.games[0].phase,'blocked');assert.equal(f.games[1].phase,'complete');});
test('foreign source owner and own live lease cannot be settled',async()=>{for(const withLease of [false,true]){const f=fixture();f.edit(0,1,{status:'running',owner:withLease?'123-1:1:worker:1':'foreign:1:worker:1'});f.jobs[0]={...f.jobs[0],status:'completed',conclusion:'failure'};if(withLease)f.docs.set('state/'+stagingLeaseKey(queueId,f.games[0],'worker',1),{value:{expiresAt:Date.now()+60000}});await f.api.reconcile();assert.equal(f.games[0].phase,'ready');assert.equal(f.games[1].phase,'complete');assert(!f.events.some(e=>e.type==='settle-intent'));}});
test('live shared-controller lane20 cannot be inferred ended from terminal task counts',async()=>{const f=fixture();f.edit(0,20,{status:'running'});await f.api.reconcile();assert.equal(f.games[0].phase,'ready');assert(!f.events.some(e=>e.type==='settle-intent'));assert.equal(f.games[1].phase,'complete');});
test('own validation/protected admission exception retains its game and permits independently qualified next game',async()=>{for(const option of ['badPrefix','gateFails']){const f=fixture({[option]:'32442'});await f.api.reconcile();assert.equal(f.games[0].phase,'blocked');assert.equal(f.games[1].phase,'complete');assert(!f.events.some(e=>e.type==='business'&&e.gameId==='32442'));}});
test('unknown selected-prefix data cannot get native or business credit',async()=>{const f=fixture({prefixUnknown:'32442'});await f.api.reconcile();assert.equal(f.games[0].phase,'blocked');assert.equal(f.games[1].phase,'complete');assert(!f.events.some(e=>e.type==='native'&&e.gameId==='32442'));});
test('an unknown full-prefix read is sealed and is never issued again on the next controller pass',async()=>{const f=fixture({unknownPrefix:'32442'});await f.api.reconcile();await f.api.reconcile();assert.equal(f.games[0].sgOutcomeUnknownRetained,true);assert.equal(f.events.filter(e=>e.type==='validate'&&e.gameId==='32442').length,1);assert.equal(f.games[1].phase,'complete');});
test('unknown business ACK retains its merging phase and is isolated, is never replayed on the next reconcile, and does not stop the other game',async()=>{const f=fixture({unknownBusiness:'32442'});await f.api.reconcile();assert.equal(f.games[0].phase,'blocked');assert.equal(f.games[0].sgFailedGamePhase,'merging');assert.equal(f.games[0].sgOutcomeUnknownRetained,true);assert.equal(f.games[1].phase,'complete');await f.api.reconcile();assert.equal(f.events.filter(e=>e.type==='business'&&e.gameId==='32442').length,1);assert(!f.events.some(e=>e.type==='finalize'&&e.gameId==='32442'));});
test('existing durable delivery intent is isolated once without rescanning or blocking the next game',async()=>{const f=fixture({existingIntent:'32442'});await f.api.reconcile();assert.equal(f.games[0].phase,'blocked');assert.equal(f.games[0].sgExistingOperationRetained,true);assert.equal(f.games[1].phase,'complete');const scans=f.events.filter(e=>e.type==='validate'&&e.gameId==='32442').length;await f.api.reconcile();assert.equal(scans,0);assert.equal(f.events.filter(e=>e.type==='validate'&&e.gameId==='32442').length,scans);assert(!f.events.some(e=>e.type==='business'&&e.gameId==='32442'));assert(f.events.some(e=>e.type==='exception'&&e.error==='SG_AG_CONTROL_EXISTING_OPERATION_NO_REPLAY'));});
test('an intent appearing during prefix validation is checked again before any final write',async()=>{
 const f=fixture();let checks=0;
 f.io.inspectPriorOperation=async g=>({canStartOnce:g.gameId!=='32442'||++checks===1});
 await f.api.reconcile();assert.equal(checks,2);assert.equal(f.games[0].phase,'blocked');assert.equal(f.games[1].phase,'complete');
 assert.equal(f.events.filter(e=>e.type==='validate'&&e.gameId==='32442').length,20);
 assert(!f.events.some(e=>['native','business','finalize'].includes(e.type)&&e.gameId==='32442'));
});
test('unknown node settlement CAS keeps the task evidence and stops the shared control pass without another CAS',async()=>{const f=fixture({unknownCas:true});f.edit(0,1,{status:'running'});f.jobs[0]={...f.jobs[0],status:'completed',conclusion:'failure'};await assert.rejects(f.api.reconcile(),/unknown-cas/);assert.equal(f.events.filter(e=>e.type==='cas').length,1);assert.equal(f.events.filter(e=>e.type==='settle-ack').length,0);assert.equal(f.closed,1);});
test('original complete and blocked games are skipped and exceptions leave an ended queue paused',async()=>{const f=fixture({workflowEnded:true});f.games[0].phase='complete';f.games[1].phase='blocked';await f.api.reconcile();assert(!f.events.some(e=>e.type==='native'||e.type==='business'));assert.equal(f.state.phase,'paused');assert.equal(f.finalized,1);});
test('resume waits for current actual ending and full boundary, preserves successes, and selects only original ready games',async()=>{const f=fixture({workflowEnded:true,resumeEnded:true});f.games[1].phase='blocked';f.edit(0,1,{status:'failed'});await f.api.resume();assert.equal(f.events.filter(e=>e.type==='reset').length,1);assert.equal((await f.store.get('state',taskKey(queueId,f.games[0],'worker:2'))).value.status,'success');assert.deepEqual(f.events.find(e=>e.type==='dispatch').games,['32442']);});
test('live workflow or missing global ending blocks resume; per-game merge never requires that ending',async()=>{for(const options of [{resumeEnded:true},{workflowEnded:true}]){const f=fixture(options);await assert.rejects(f.api.resume());assert(!f.events.some(e=>e.type==='dispatch'||e.type==='reset'));}});
test('resume cannot replay an unknown source prefix or dispatch after its failed validation',async()=>{const f=fixture({workflowEnded:true,resumeEnded:true});f.edit(0,1,{status:'failed',unknownRequests:1});await assert.rejects(f.api.resume(),/unknown-source/);assert(!f.events.some(e=>e.type==='dispatch'));});
test('missing private durable state ACK prevents final target writes',async()=>{const f=fixture({badDurability:true});await assert.rejects(f.api.reconcile(),/SYNC_DURABLE_STATE/);assert(!f.events.some(e=>e.type==='native'||e.type==='business'||e.type==='exception'));});
test('portable controller preserves the four original declarations and all twelve reference hashes',()=>{
 const root=path.resolve('.'),receipt=JSON.parse(fs.readFileSync(root+'/scripts/ag-reference/source.json')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 for(const f of receipt.files)assert.equal(sha(fs.readFileSync(root+'/scripts/ag-reference/'+f.path)),f.sha256);
 const generated=fs.readFileSync(new URL('./ag-original-full-control.mjs',import.meta.url),'utf8');assert(!generated.includes('file:///'));assert(generated.includes('async function mergeGame(')&&generated.includes('async function reconcile(')&&generated.includes('async function settleEndedNodes(')&&generated.includes('async function resume('));
});
test('full AG control callback writes SG final replay bytes using the existing JS core and actual independent Python IPC',async()=>{const root=process.cwd(),previous=process.cwd();process.chdir(root);const parser=analyzer({python:process.env.PYTHON??'python3',env:{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,PYTHONUTF8:'1'}});try{
 const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32442'],binding=JSON.parse(fs.readFileSync('config/ag-business-bindings.json')).bindings['32442'],campaignId='sg_32442-'+binding.queueId;
 const response='MSGID=BET&B=99980&AB=99980&TW=0&NFG=0&IFG=0&FID=0|',raw={fixtureOnly:false,protocol:'nextgen',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:100000,steps:[{ts:'2026-01-01T00:00:00Z',msgId:'BET',methodName:'processGameMessage',requestPayload:Object.entries({...plan.requestParams,PID:'gdmgcmSyntheticAGControl',MSGID:'BET'}).map(([k,v])=>k+'='+v).join('&'),responsePayload:response,responseBalance:99980,responseXml:'<GDMRESPONSE><OGS_RC>0</OGS_RC><SUCCESS>true</SUCCESS><PAYLOAD>'+response.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>',elapsedMs:1,httpStatus:200}]};
 const normalized=await parser.call({op:'fields',plan,raw}),record=await parser.call({op:'record',plan,raw,normalized,sequence:1,attempt:1,sessionHash:'a'.repeat(64),worker:0,batchId:1});const events=[],saved=[];
 const f=fixture({business:async g=>{if(g.gameId!=='32442')return;await deliverPage({records:[record],binding,campaignId,parser,batchId:'one',sink:{plan,read:async()=>structuredClone(saved),insert:async docs=>{events.push('insert');saved.push(...structuredClone(docs));}},audit:{begin:async()=>events.push('intent'),end:async()=>events.push('ack')}});}});
 await f.api.reconcile();assert.equal(f.games[0].phase,'complete');assert.deepEqual(events,['intent','insert','ack']);assert.deepEqual(saved,[businessDocument(record,binding,campaignId)]);
 }finally{parser.close();process.chdir(previous);}});
