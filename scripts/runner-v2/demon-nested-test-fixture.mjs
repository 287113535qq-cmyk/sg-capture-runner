// Fabricated gameplay only. Historical metadata is limited to public hashes,
// counts, timestamps and run identifiers. The analyzer stub tests control flow;
// actual protocol and money validation have separate Python/Runner fixtures.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DemonNestedRecovery} from './demon-nested-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {stable} from './mongo-writer.mjs';
import {receiptKey} from './durable-queue.mjs';
import {ZERO} from './demon-nested-ancestor.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const samples=read('fixtures/demon-nested-synthetic.json');
const pendingSample=samples.find(x=>x.name==='inner reaction grows').raw;
const terminalSample=samples.find(x=>x.next===null&&!x.reject).raw;
export function fixture(){
 const plan=read('config/round-one-plans.json')[32739],docs=new Map(),rounds=new Map(),writes=[];
 const put=(c,k,value)=>docs.set(c+'/'+k,{_id:'primary/'+k,version:1,value:structuredClone(value)});
 const get=(c,k)=>structuredClone(docs.get(c+'/'+k));
 const history=read('scripts/runner-v2/demon-nested-history-fixture.json');
 for(const [k,v] of Object.entries(history))put('journal',k,v);
 for(const [prefix,name] of [['demon-queue:demon-two-36525403196','queue'],['demon-one:demon-one-36551698305','one'],[ZERO.prefix,'zero']])docs.get('journal/'+prefix+':proof').value.profile=read('config/demon-'+name+'-20260929.json');
 const now=Date.parse('2026-09-29T12:55:00Z');
 const layouts=[[3,28,28],[1,16,16],[14,17,12],[6,40,40],[0,39,33],[17,36,36],[16,13,13],[19,12,12],[13,15,15],[2,1,1],[15,2,2],[12,1,1],[11,1,1],[9,0,0],[10,20,20],[4,10,10],[5,1,1],[7,5,5],[18,10,10]];
 const pool={enabled:false,failure:'PROTOCOL_VALIDATION_FAILED',protocolRecovery:ZERO.proof,planHash:hash(plan),nextBatchId:20,nextSequence:1901,workers:Object.fromEntries(Array.from({length:20},(_,i)=>[i,{sessionHash:hash('synthetic-session-'+i),owner:null,leaseUntil:0,activeBatch:null}]))};
 const c={enabled:true,reason:null,audit:null,activeGame:32739,validationLimit:10,games:[{game_id:32739,status:'active'}],protocolValidation:{phase:'short',proofHash:ZERO.proof,commit:ZERO.commit,runKey:'capture-run:36562923330:1'}};
 const makeRecord=(b,sequence,raw=terminalSample,attempt='synthetic-new-'+sequence)=>({_id:hash(plan.trialId+':'+sequence),trialId:plan.trialId,sequence,batchId:b.id,shardId:b.worker,sourceSessionHash:b.sessionHash,attempt,fixtureOnly:false,buy:0,bonus:2,contentHash:hash('synthetic-record-'+sequence),raw:structuredClone(raw)});
 for(const [i,[worker,n,cp]] of layouts.entries()){
  const id=i+1,start=i*100+1,b={id,worker,start,end:start+99,journaled:start+n-1,checkpoint:start+cp-1,sessionHash:pool.workers[worker].sessionHash,owner:null,leaseUntil:0,epoch:1,failure:id===3?'PROTOCOL_VALIDATION_FAILED':null,pending:null,protocolResume:null,pendingOriginal:null};
  if(id===3||id===5){let raw=structuredClone(pendingSample);
   if(id===3)while(raw.steps.length<8)raw.steps.push(structuredClone(raw.steps.at(-1)));
   else raw.steps=raw.steps.slice(0,1);
   b.pending={sequence:b.journaled+1,attempt:'synthetic-pending-'+id,awaiting:null,raw};
  }
  pool.workers[worker].activeBatch=worker===13?null:{id};put('state','batch:'+plan.trialId+':'+id,b);
  for(let sequence=start;sequence<=b.journaled;sequence++){const r=makeRecord(b,sequence);r.raw.steps[0].ts=new Date(now+1000).toISOString();put('journal',receiptKey(plan.trialId,sequence),r);if(sequence<=b.checkpoint)rounds.set(r._id,structuredClone(r));}
 }
 put('state','campaign',c);put('state','pool:'+plan.trialId,pool);put('state','write-permits',{limit:1,slots:{}});
 const snapshots=()=>({campaign:get('state','campaign'),pool:get('state','pool:'+plan.trialId),batches:layouts.map((_,i)=>get('state','batch:'+plan.trialId+':'+(i+1)))});
 const digest=createHash('sha256');for(const {value:b} of snapshots().batches)for(let seq=b.start;seq<=b.journaled;seq++){const r=get('journal',receiptKey(plan.trialId,seq)).value;digest.update(stable([r._id,r.contentHash])+'\n');}
 const profile={schema:'sg-demon-nested-v1',id:'demon-nested-36562923330',group:'primary',gameId:32739,complete:267,checkpoint:256,pending:2,createdAt:now,planHash:hash(plan),campaignHash:hash(c),poolHash:hash(pool),recordsHash:digest.digest('hex'),archives:{},batches:snapshots().batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null}))};
 for(const [a,k] of [['ancestorReceiptHash','queued-supersession:36525403196'],['ancestorCompleteHash','queued-supersession:36525403196:complete'],['oneStageHash','demon-one-stage:36551698305'],['oneCompleteHash','demon-one-stage:36551698305:complete'],['zeroStageHash',ZERO.stage],['zeroCompleteHash',ZERO.stage+':complete']])profile[a]=hash(history[k]);
 for(const [seq,bid,prefix] of [[806,9,'demon-pending-session:demon-pending-session-36518623937'],[434,5,'demon-three:demon-three-36522161320'],[117,2,'demon-queue:demon-two-36525403196'],[902,10,'demon-one:demon-one-36551698305'],[1706,18,ZERO.prefix]]){
  const b=get('state','batch:'+plan.trialId+':'+bid).value,proof=history[prefix+':reconciled']?.proofHash||hash(prefix),a={worker:b.worker,sessionHash:b.sessionHash,proofHash:proof,disposition:'source-invalid-session/abandon_without_replay',pending:{sequence:seq,attempt:'synthetic-abandoned-'+seq}};
  put('journal',prefix+':abandoned:'+bid,a);if(!docs.has('journal/'+prefix+':reconciled'))put('journal',prefix+':reconciled',{proofHash:proof,at:now-1000});
  profile.archives[seq]={batch:bid,worker:b.worker,prefix,proof,archiveHash:hash(a),reconciledHash:hash(get('journal',prefix+':reconciled').value)};
 }
 let blocked=false,lease=false,failAt=null,hook=()=>{};
 const store={get:async(c,k)=>get(c,k),getMany:async(c,keys)=>keys.map(k=>get(c,k)),writable:async()=>{},create:async(c,k,v)=>{assert(!docs.has(c+'/'+k),'DUPLICATE');assert(k!==failAt,'INJECTED_FAILURE');put(c,k,v);writes.push(k);hook(k);return get(c,k);},update:async(c,k,fn)=>{assert(docs.has('journal/demon-nested:demon-nested-36562923330:backup-complete'),'BACKUP_REQUIRED');const row=get(c,k),value=fn(row.value);if(value===null)return row;docs.set(c+'/'+k,{...row,version:row.version+1,value});writes.push(k);hook(k);return get(c,k);}};
 const transport={request:async(type,p)=>{if(type==='global_holds')return ['primary','secondary'].map(g=>({_id:g+'/global-hold',value:{active:false}}));if(type==='rounds_read')return structuredClone([...rounds.values()].filter(r=>p.ids.includes(r._id)));if(type==='rounds_scan')return structuredClone([...rounds.values()].filter(r=>r.sequence>p.after).sort((a,b)=>a.sequence-b.sequence));if(type==='rounds_insert'){for(const r of p.records)rounds.set(r._id,structuredClone(r));return {inserted:p.records.length};}throw Error(type);}};
 const gate={status:()=>({allowed:true,maxBatchSize:100,metrics:{diskFreeBytes:100*1024**3}}),assertCanWrite(){}};
 const operator=new DemonNestedRecovery({store,transport,gate,parser:{call:async x=>x.op==='next'?{MSGID:'FREE_GAME'}:{}},plan,profile,run:'888888:1',commit:'e'.repeat(40),owner:'synthetic',now:()=>now+1000,githubIdle:async()=>assert(!blocked,'OLD_JOB_EXISTS'),checkLeases:async()=>assert(!lease,'LEASE_ACTIVE')});
 return {operator,docs,rounds,writes,get,plan,profile,close(){},block:()=>{blocked=true;},occupy:()=>{lease=true;},fail:k=>{failAt=k;},hook:fn=>{hook=fn;},makeRecord,put};
}
export async function finish(f){
 const c=f.docs.get('state/campaign').value;c.protocolValidation.runKey='capture-run:999999:1';
 const spec=f.get('journal','pending-first:'+c.protocolValidation.proofHash).value,p=f.docs.get('state/pool:'+f.plan.trialId).value;
 for(let worker=0;worker<20;worker++){
  let b=[...f.docs.entries()].find(([k,x])=>k.startsWith('state/batch:')&&x.value.worker===worker)?.[1].value;
  if(!b){b={id:p.nextBatchId++,worker,start:p.nextSequence,end:p.nextSequence+99,journaled:p.nextSequence-1,checkpoint:p.nextSequence-1,epoch:1,sessionHash:p.workers[worker].sessionHash};p.nextSequence+=100;f.put('state','batch:'+f.plan.trialId+':'+b.id,b);b=f.docs.get('state/batch:'+f.plan.trialId+':'+b.id).value;}
  for(let n=0;n<spec.remaining[worker];n++){
   const sequence=b.journaled+1,entry=spec.entries.find(e=>e.worker===worker&&e.pending.sequence===sequence);
   const r=f.makeRecord(b,sequence);r.raw.steps[0].ts=new Date(f.profile.createdAt+2000).toISOString();
   if(entry){r.attempt=entry.pending.attempt;r.raw=structuredClone(entry.pending.raw);r.raw.steps.push(...structuredClone(terminalSample.steps.slice(2)));}
   f.put('journal',receiptKey(f.plan.trialId,sequence),r);f.rounds.set(r._id,structuredClone(r));b.journaled++;b.checkpoint=b.journaled;
  }
  Object.assign(b,{pending:null,protocolResume:null,pendingOriginal:null,failure:null,owner:null,leaseUntil:0,epoch:b.epoch+1});Object.assign(p.workers[worker],{owner:null,leaseUntil:0,activeBatch:null});
 }
}
