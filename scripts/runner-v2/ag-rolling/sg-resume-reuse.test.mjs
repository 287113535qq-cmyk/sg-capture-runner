import assert from 'node:assert/strict';
import test from 'node:test';
import {resetEndedTask} from './sg-resume.mjs';
import {createStagingStore,stagingPrefix,stagingLeaseKey} from './sg-staging-store.mjs';
import {taskKey} from './sg-task-store.mjs';
import {sourceJournalKey} from './sg-source-journal.mjs';
import {queueHash} from './sg-queue-profile.mjs';

const game={gameId:'32723',dbName:'sg_32723',campaignId:'sg_32723-queue',baseline:0};
const queueId='queue',kind='worker',index=1,id='worker:1';
const ended={status:'completed',sourceJobsEnded:true,queueId,run:'123:1',proofHash:'a'.repeat(64)};
const key=taskKey(queueId,game,id),leaseKey=stagingLeaseKey(queueId,game,kind,index);
const prefix=stagingPrefix(queueId,game,kind,index),copy=v=>structuredClone(v);
async function fixture(){
 const docs=new Map(),events=[],owner='123-1:1:worker:1',sessionHash=queueHash(['session']);
 const store={
  async get(collection,name){events.push(['get',collection,name]);return copy(docs.get(collection+'/'+name)??null);},
  async getMany(collection,names){return Promise.all(names.map(name=>this.get(collection,name)));},
  async create(collection,name,value){events.push(['create',collection,name]);assert(!docs.has(collection+'/'+name));
   docs.set(collection+'/'+name,{_id:'primary/'+name,version:0,value:copy(value)});return this.get(collection,name);},
  async cas(collection,name,before,value){events.push(['cas',collection,name]);const current=docs.get(collection+'/'+name);
   if(current?.version!==before.version)return null;docs.set(collection+'/'+name,{_id:'primary/'+name,version:before.version+1,value:copy(value)});return this.get(collection,name);}
 };
 const transport={async request(op,args){events.push([op]);assert.equal(op,'scan');return [...docs.values()]
  .filter(row=>row._id>args.after&&row._id<'primary/'+args.key+'\uffff')
  .sort((a,b)=>a._id.localeCompare(b._id)).slice(0,100).map(copy);}};
 await store.create('state',key,{_id:id,queueId,campaignId:game.campaignId,status:'failed',owner});
 for(let n=1;n<=5;n++){
  const step={msgId:'BET',requestPayload:'fixture',rollingSource:{sessionHash,requestNo:n}};
  const intent={queueId,gameId:game.gameId,kind,index,owner,sessionHash,requestNo:n,msgId:'BET',requestPayload:'fixture'};
  for(const type of ['intent','response'])await store.create('journal',sourceJournalKey({queueId,game,kind,index,owner,sessionHash,requestNo:n,type}),type==='intent'?intent:{...intent,step});
  const record={_id:queueHash(['row',n]),contentHash:queueHash(['content',n]),fixtureOnly:false,buy:0,gameId:Number(game.gameId),
   sequence:n,sourceSessionHash:sessionHash,raw:{steps:[step]}};
  await store.create('journal',prefix+String(n).padStart(10,'0'),{queueId,gameId:game.gameId,campaignId:game.campaignId,taskId:id,owner,ordinal:n,record});
 }
 const args={store,transport,game,queueId,kind,index,ended,guard:async()=>{events.push(['guard']);},
  verifyRecords:async rows=>{events.push(['verify',rows.length]);return {verified:true,count:rows.length};}};
 const pending=await resetEndedTask(args);events.length=0;
 return {docs,events,store,transport,args:{...args,revalidateSuccess:false},pending};
}
function rewriteReceipt(f,edit){
 const task=f.docs.get('state/'+key).value,old=task.resume.receiptKey,receipt=copy(f.docs.get('journal/'+old).value);
 edit(receipt,task.resume);const hash=queueHash(receipt),name='rolling-resume:'+hash;
 f.docs.delete('journal/'+old);f.docs.set('journal/'+name,{_id:'primary/'+name,version:0,value:receipt});
 task.resume.receiptKey=name;task.resume.receiptHash=hash;
}

test('unchanged exact ended pending proof uses bounded metadata reads with no scan, parser call or write',async()=>{
 const f=await fixture(),before=queueHash([...f.docs]);
 assert.deepEqual(await resetEndedTask(f.args),f.pending);
 assert.equal(queueHash([...f.docs]),before);
 assert.deepEqual(f.events.map(e=>e[0]),['get','get','get','guard','get','get']);
});

test('changed adapter and older ending keep full independent validation',async()=>{
 for(const change of ['adapter','older-ending','changed-ending-hash']){
  const f=await fixture();
  if(change==='adapter')f.args.revalidateSuccess=true;
  else if(change==='older-ending')f.args.ended={...ended,run:'124:1'};
  else f.args.ended={...ended,proofHash:'b'.repeat(64)};
  assert.deepEqual(await resetEndedTask(f.args),f.pending);
  assert.equal(f.events.filter(e=>e[0]==='scan').length,2);
  assert.equal(f.events.filter(e=>e[0]==='verify').reduce((n,e)=>n+e[1],0),5);
 }
 const f=await fixture();f.args.revalidateSuccess=true;f.args.verifyRecords=async()=>({verified:false,count:5});
 await assert.rejects(()=>resetEndedTask(f.args),/INDEPENDENT_VALIDATION/);
});

test('missing, altered, noncanonical or misbound immutable receipts cannot authorize proof reuse',async()=>{
 const changes={
  missing:f=>f.docs.delete('journal/'+f.pending.resume.receiptKey),
  changed:f=>{f.docs.get('journal/'+f.pending.resume.receiptKey).value.endedProofHash='b'.repeat(64);},
  key:f=>{f.docs.get('state/'+key).value.resume.receiptKey='foreign:'+f.pending.resume.receiptHash;},
  document:f=>{f.docs.get('journal/'+f.pending.resume.receiptKey)._id='secondary/'+f.pending.resume.receiptKey;},
  queue:f=>rewriteReceipt(f,r=>{r.queueId='foreign';}),
  game:f=>rewriteReceipt(f,r=>{r.gameId='32588';}),
  campaign:f=>rewriteReceipt(f,r=>{r.campaignId='foreign';}),
  task:f=>rewriteReceipt(f,r=>{r.taskId='worker:2';}),
  count:f=>rewriteReceipt(f,r=>{r.count++;}),
  hash:f=>rewriteReceipt(f,r=>{r.recordsHash='f'.repeat(64);}),
  unverified:f=>rewriteReceipt(f,r=>{r.independentlyVerified=false;}),
  noReadback:f=>rewriteReceipt(f,r=>{r.fullReadback=false;}),
  previousTask:f=>rewriteReceipt(f,r=>{r.previousTaskHash='missing';}),
  source:f=>rewriteReceipt(f,r=>{r.sourceRequests=1;}),
  unknown:f=>rewriteReceipt(f,r=>{r.unknownOrUnfinishedSource='accepted';}),
  segments:f=>rewriteReceipt(f,(r,p)=>{r.segments[0].first=2;p.segments=copy(r.segments);}),
  segmentGap:f=>rewriteReceipt(f,(r,p)=>{r.segments=[{first:1,last:2,owner:'one'},{first:4,last:5,owner:'two'}];p.segments=copy(r.segments);}),
  segmentOwner:f=>rewriteReceipt(f,(r,p)=>{r.segments[0].owner='';p.segments=copy(r.segments);}),
  overQuota:f=>rewriteReceipt(f,(r,p)=>{r.count=15008;p.count=r.count;r.segments[0].last=r.count;p.segments=copy(r.segments);}),
  flags:f=>{f.docs.get('state/'+key).value.resume.fullReadback=false;}
 };
 for(const [name,change] of Object.entries(changes)){
  const f=await fixture();change(f);
  await assert.rejects(()=>resetEndedTask(f.args),/PENDING_RECEIPT/,name);
  assert(!f.events.some(e=>['scan','verify','create','cas'].includes(e[0])),name);
 }
});

test('current ended source, leases and unchanged task version remain required for metadata reuse',async()=>{
 for(const mutation of ['active-source','source-jobs','live-lease','lease-race','task-race','version-race']){
  const f=await fixture();let pattern;
  if(mutation==='active-source'){f.args.ended={...ended,status:'in_progress'};pattern=/ENDED_SOURCE/;}
  if(mutation==='source-jobs'){f.args.ended={...ended,sourceJobsEnded:false};pattern=/ENDED_SOURCE/;}
  if(mutation==='live-lease'){await f.store.create('state',leaseKey,{expiresAt:Date.now()+60000});pattern=/LIVE_LEASE/;}
  if(mutation==='lease-race'){f.args.guard=async()=>{await f.store.create('state',leaseKey,{expiresAt:Date.now()+60000});};pattern=/LIVE_LEASE/;}
  if(mutation==='task-race'){f.args.guard=async()=>{f.docs.get('state/'+key).value.status='running';};pattern=/TASK_CHANGED/;}
  if(mutation==='version-race'){f.args.guard=async()=>{f.docs.get('state/'+key).version++;};pattern=/TASK_CHANGED/;}
  await assert.rejects(()=>resetEndedTask(f.args),pattern,mutation);
 }
});

test('metadata reuse retains the startup full-readback barrier against changed bytes and suffixes',async()=>{
 for(const mutation of ['record','source','suffix']){
  const f=await fixture();
  const pending=await resetEndedTask(f.args),owner='124-1:1:worker:1';
  const before=await f.store.get('state',key);await f.store.cas('state',key,before,{...before.value,status:'running',owner});
  if(mutation==='record')f.docs.get('journal/'+prefix+'0000000003').value.record.contentHash='f'.repeat(64);
  if(mutation==='source'){
   const response=[...f.docs.keys()].find(k=>k.endsWith(':0000000003:response'));f.docs.get(response).value.step.msgId='changed';
  }
  if(mutation==='suffix'){
   const next=copy(f.docs.get('journal/'+prefix+'0000000005'));next._id='primary/'+prefix+'0000000006';next.value.ordinal=6;
   next.value.record._id=queueHash(['suffix']);next.value.record.sequence=6;f.docs.set('journal/'+prefix+'0000000006',next);
  }
  const storage=createStagingStore({...f.args,quota:15000,owner,resume:pending.resume,assertDurable:async()=>{},inspectSource:async()=>{}});
  try{await assert.rejects(()=>storage.getCounts(game.dbName),/RESUME_CHANGED|SOURCE_CHANGED/);}
  finally{await storage.close();}
 }
});
