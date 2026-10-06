import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {taskKey} from './sg-task-store.mjs';
import {stagingPrefix} from './sg-staging-store.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {mergeGameWithVerifiedPrefixes} from './sg-ag-native-merge.mjs';
import {preparedWorkerPosition} from './sg-ag-completed-prefix.mjs';
import {immutableBusinessAudit} from './sg-ag-ordinary-business.mjs';
import {createPrivateControlWriter} from './sg-ag-private-control.mjs';
import {createAdmittedStrictControl,strictEntryStatus} from './sg-ag-strict-entry.mjs';
import {createProductionSgIo} from './sg-ag-production-io.mjs';
import {cohortRepos} from './sg-federation.mjs';
const sha=v=>crypto.createHash('sha256').update(stable(v)).digest('hex');
function fixture({insufficient=false,unknown=false}={}){
 const queueId='queue',game={gameId:'32442',dbName:'sg_32442',campaignId:'sg_32442-queue',baseline:299980},plan={trialId:'synthetic-own-trial'},docs=new Map(),formal=new Map(),events=[];
 const store={async get(c,k){return structuredClone(docs.get(c+'/'+k)??null);},async getMany(c,keys){return Promise.all(keys.map(k=>this.get(c,k)));},async create(c,k,v){if(!docs.has(c+'/'+k))docs.set(c+'/'+k,{_id:'primary/'+k,value:structuredClone(v),version:0});return this.get(c,k);},async cas(c,k,b,v){const prior=docs.get(c+'/'+k);if(prior.version!==b.version)return null;docs.set(c+'/'+k,{...prior,value:structuredClone(v),version:prior.version+1});return {value:v};}};
 const proofs=[];
 for(let i=1;i<=22;i++){const index=i<=2?i:i-2,kind=i<=2?'canary':'worker',id=kind+':'+index,count=kind==='worker'&&index===1&&insufficient?0:1,owner='123-1:'+index+':'+id,task={_id:id,queueId,campaignId:game.campaignId,status:'failed',owner};docs.set('state/'+taskKey(queueId,game,id),{value:task,version:0});if(kind==='worker'){
  const record={_id:index.toString(16).padStart(64,'0'),contentHash:'a'.repeat(64),fixtureOnly:true,shardId:index-1,sequence:index};
  const prefix=stagingPrefix(queueId,game,kind,index);if(count)docs.set('journal/'+prefix+'0000000001',{_id:'primary/'+prefix+'0000000001',value:{queueId,gameId:game.gameId,campaignId:game.campaignId,taskId:id,owner,ordinal:1,record}});
  proofs.push({queueId,gameId:game.gameId,campaignId:game.campaignId,taskId:id,owner,taskHash:queueHash(task),count,recordsHash:crypto.createHash('sha256').update(count?stable(record)+'\n':'').digest('hex'),fullReadback:true,independentlyVerified:true,acceptedUnknownRequests:0,activeLeases:0});
 }}
 const transport={async request(op,fields){events.push(op);if(op==='rolling_stage_copy'){for(const ref of fields.records){formal.set(ref.id,(await store.get('journal',ref.key)).value.record);}if(unknown)throw Object.assign(Error('unknown-native-ack'),{outcomeUnknown:true});return {};}
  if(op==='rounds_read')return fields.ids.map(id=>formal.get(id)).filter(Boolean);if(op==='rounds_count')return {count:formal.size};assert.fail(op);}};
 return {game,store,proofs,docs,events,formal,args:{store,transport,game,queueId,plan,owner:'123:1:controller',verifiedPrefixes:proofs,guard:async()=>{},verifyRecords:async records=>({verified:true,count:records.length}),inspectBaseline:async()=>({verified:true,count:299980})}};
}
test('native I/O selects full terminal failed prefixes without rewriting SUCCESS and retains original copy/fullreceipt/CAS',async()=>{const f=fixture();const result=await mergeGameWithVerifiedPrefixes(f.args);assert.equal(result.count,300000);assert.equal(f.formal.size,20);assert.deepEqual(result.selected,Array(20).fill(1));assert([...f.docs.values()].filter(r=>r.value._id).every(r=>r.value.status==='failed'));assert(!f.events.includes('rolling_journal_delete'));});
test('insufficient terminal prefix blocks this game before any native copy',async()=>{const f=fixture({insufficient:true});const result=await mergeGameWithVerifiedPrefixes(f.args);assert.equal(result.status,'blocked');assert.equal(f.formal.size,0);});
test('changed audited task hash refuses native credit before the first copy',async()=>{const f=fixture();f.proofs[0].taskHash='f'.repeat(64);await assert.rejects(mergeGameWithVerifiedPrefixes(f.args),/EXACT_PREFIX/);assert.equal(f.formal.size,0);});
test('unknown native ACK remains merging and a second call never replays that copy',async()=>{const f=fixture({unknown:true});await assert.rejects(mergeGameWithVerifiedPrefixes(f.args),/unknown-native-ack/);const copies=f.events.filter(x=>x==='rolling_stage_copy').length;const result=await mergeGameWithVerifiedPrefixes(f.args);assert.equal(result.status,'merging');assert.equal(f.events.filter(x=>x==='rolling_stage_copy').length,copies);});
test('prepared sequence position validates normal and +7 identities without claiming their staging insertion order',()=>{for(let index=1;index<=20;index++){assert.equal(preparedWorkerPosition({shardId:index-1,sequence:(index-1)*15000+1},index),1);assert.equal(preparedWorkerPosition({shardId:index-1,sequence:index*15000},index),15000);assert.equal(preparedWorkerPosition({shardId:index-1,sequence:300000+(index-1)*7+7},index),15007);}assert.throws(()=>preparedWorkerPosition({shardId:1,sequence:1},1));assert.throws(()=>preparedWorkerPosition({shardId:0,sequence:15001},1));});
test('every immutable business backup/intent/ACK receives full-value readback and rejects an extra field',async()=>{let doc;const seal=immutableBusinessAudit({owner:'own',guard:async()=>{},audit:{findOne:async()=>doc?{...doc,extra:true}:null,insertOne:async d=>{doc=structuredClone(d);}}});await assert.rejects(seal('own-intent',{documents:[{money:1}]}),/FULL_READBACK/);assert.deepEqual(doc.documents,[{money:1}]);});
test('existing business intent and unknown audit ACK cannot be reinserted or receive an ACK',async()=>{for(const existing of [true,false]){let writes=0,reads=0;const seal=immutableBusinessAudit({owner:'own',guard:async()=>{},audit:{findOne:async()=>{reads++;return existing?{_id:'own'}:null;},insertOne:async()=>{writes++;throw Error('unknown-audit-ack');}}});await assert.rejects(seal('own',{money:1}));assert.equal(writes,existing?0:1);assert.equal(reads,1);}});
test('candidate entry remains disabled and checks preauth without clients, private input or production credit',()=>{assert(!strictEntryStatus.enabled&&!strictEntryStatus.ownExactLinuxVerified&&!strictEntryStatus.productionWalkthroughCompleted);assert.throws(()=>createAdmittedStrictControl({}),/PROTECTED_ENTRY/);const result=JSON.parse(execFileSync(process.execPath,['--no-experimental-strip-types','scripts/runner-v2/ag-rolling/sg-ag-strict-entry.mjs','--preauth'],{encoding:'utf8'}));assert.equal(result.newContinuationAllowed,false);assert.equal(result.protectedLauncherBound,false);});
test('private control persistence rejects a local non-Linux or unapproved directory before writing',()=>{assert.throws(()=>createPrivateControlWriter({directoryFd:-1,key:Buffer.alloc(32),context:{}}));});

test('completed-native production admission rejects a live or pending canary even when every worker is terminal',async()=>{
 for(const status of ['running','pending']){
  const f=fixture(),{game,store,docs}=f,{queueId}=f.args,commit='a'.repeat(40),profile={payload:{queueId,games:[game]},nativeGatewayHash:'b'.repeat(64),nativeManifestHash:'c'.repeat(64)};
  docs.get('state/'+taskKey(queueId,game,'canary:1')).value.status=status;
  docs.set('state/rolling-source',{value:{status:'ended'}});
  docs.set('state/rolling-merge:'+queueHash([queueId,game.gameId,game.campaignId]),{value:{status:'complete'}});
  store.writable=async()=>{};let businessReads=0;
  const io=createProductionSgIo({profile,cohortRun:'123:1',coordinatorRun:'123:1',commit,repository:cohortRepos.primary,store,
   transport:{request:async op=>op==='global_holds'?[{value:{active:false}},{value:{active:false}}]:{group:'primary',database:'sg_capture_staging_v1',gatewaySha256:profile.nativeGatewayHash,accessManifestHash:profile.nativeManifestHash,rollingNamespace:'primary'}},
   parser:{},businessClient:{db(){businessReads++;throw Error('UNEXPECTED_BUSINESS_READ');}},ObjectId:class{},bindings:{},plans:{},githubRead:async()=>{},
   admission:Object.fromEntries(['guard','assertCapturedEnding','assertResumeBoundary','dispatchRemaining','finishCohort','originalCount','originalDocuments'].map(k=>[k,async()=>{}])),
   privateControlPersist:()=>({fullReadback:true}),currentRtp:async()=>{}});
  await assert.rejects(io.verifyPrefix(game,1,{}),/SG_AG_PRODUCTION_ACTIVE_WORKER/);assert.equal(businessReads,0);
 }
});
