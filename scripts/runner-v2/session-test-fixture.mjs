import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {ProtocolRecovery} from './protocol-recovery.mjs';
import {RunnerState} from './state-store.mjs';
import {receiptKey} from './durable-queue.mjs';
function fixture(gameId=32739){
  const now=100000,commit='d'.repeat(40),plan={gameId:32739,trialId:'sg_r1_20260928_32739',target:299850,buy:0,phase:1};
  const progress=[8,14,12,32,31,36,9,12,5,1,2,1,1,0,0],workers=[3,1,14,6,0,17,16,19,13,2,15,12,11,9,10];
  const pendingIds=[1,2,4,5,9,10],pool={enabled:false,failure:'PROTOCOL_VALIDATION_FAILED',planHash:hash(plan),
    nextSequence:1501,nextBatchId:16,confirmed:0,workers:{}};
  const batches=progress.map((n,i)=>{
    const id=i+1,worker=workers[i],start=i*100+1,end=start+99,sessionHash=String(worker).padStart(64,'0');
    pool.workers[worker]={sessionHash,owner:'old',epoch:1,leaseUntil:0,resumeSafe:false,activeBatch:{id,worker,start,end}};
    const pending=pendingIds.includes(id)?{sequence:start+n,attempt:'original-'+id,awaiting:null,
      raw:{startBalanceRaw:10000,steps:[{msgId:'BET',requestPayload:'MSGID=BET&PID=fixture',responsePayload:'NFG=1'}]}}:null;
    return {_id:`primary/batch:${plan.trialId}:${id}`,version:1,value:{id,worker,start,end,sessionHash,owner:'old',epoch:1,
      leaseUntil:100,journaled:start+n-1,checkpoint:start-1,pending,failure:id===5?'PROTOCOL_VALIDATION_FAILED':null}};
  });
  const campaign={enabled:true,reason:null,activeGame:null,validationLimit:0,audit:null,
    games:[{game_id:32739,status:'parked-protocol',baseline:150},{game_id:32745,status:'complete',baseline:150}]};
  const holds=['primary','secondary'].map(g=>({_id:g+'/global-hold',value:{active:false}}));
  const parked={pool:structuredClone(pool),evidence:batches.map(d=>({key:`parked:${plan.trialId}:${d.value.id}`,hash:hash(d.value)}))};
  const profile={schema:'sg-parked-protocol-profile-v1',id:'demon-32739-20260929',group:'primary',gameId:32739,
    planHash:hash(plan),poolHash:hash(pool),complete:164,checkpoint:0,pending:6,adapterHash:'a'.repeat(64),
    batches:batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null}))};
  if(gameId===32836){
    plan.gameId=32836;plan.trialId='sg_r1_20260928_32836';plan.target=299900;
    campaign.games=[{game_id:32836,status:'parked-protocol',baseline:100},{game_id:32833,status:'complete',baseline:100}];
    const counts=[12,12,10,8];batches.splice(4);pool.workers={};pool.nextSequence=401;pool.nextBatchId=5;
    for(const [i,d] of batches.entries()){
      const b=d.value;Object.assign(b,{worker:20+i,sessionHash:String(20+i).padStart(64,'0'),journaled:b.start+counts[i]-1,
        pending:i===1?{sequence:113,attempt:'original-2',awaiting:null,raw:{startBalanceRaw:10000,steps:[{msgId:'BET',responsePayload:'FID=2|'}]}}:null,
        failure:i===1?'PROTOCOL_VALIDATION_FAILED':null});
      d._id=`secondary/batch:${plan.trialId}:${b.id}`;
      pool.workers[b.worker]={sessionHash:b.sessionHash,owner:'old',epoch:1,leaseUntil:0,resumeSafe:false,activeBatch:{id:b.id,worker:b.worker,start:b.start,end:b.end}};
    }
    pool.planHash=hash(plan);parked.pool=structuredClone(pool);parked.evidence=batches.map(d=>({key:`parked:${plan.trialId}:${d.value.id}`,hash:hash(d.value)}));
    Object.assign(profile,{id:'quarterback-32836-20260929',group:'secondary',gameId:32836,planHash:hash(plan),poolHash:hash(pool),complete:42,pending:1,
      batches:batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null}))});
  }
  return {now,commit,plan,campaign,pool,batches,parked,holds,profile};
}
async function operatorFixture(gameId=32739){
  const f=fixture(gameId),docs=new Map(),rounds=new Map(),events=[];let idle=true;
  const put=(c,k,v)=>docs.set(c+'/'+k,{_id:f.profile.group+'/'+k,version:1,value:structuredClone(v)});
  put('state','campaign',f.campaign);put('state','pool:'+f.plan.trialId,f.pool);put('state','write-permits',{limit:1,slots:{}});
  put('journal','parked-pool:'+f.plan.trialId,f.parked);
  for(const {value:b} of f.batches){
    put('state',`batch:${f.plan.trialId}:${b.id}`,b);
    put('journal',`parked:${f.plan.trialId}:${b.id}`,{batch:b,poolPlanHash:f.profile.planHash});
    for(let sequence=b.start;sequence<=b.journaled;sequence++)put('journal',receiptKey(f.plan.trialId,sequence),{
      _id:hash({fixture:sequence}),trialId:f.plan.trialId,sequence,batchId:b.id,shardId:b.worker,sourceSessionHash:b.sessionHash,
      fixtureOnly:false,buy:0,contentHash:hash({sequence}),raw:{steps:[{msgId:'BET'}]},normalized:{bonus:0},bonus:0});
  }
  const transport={async request(op,r){
    if(op==='resources')return {};
    if(op==='global_holds')return structuredClone(f.holds);
    if(op==='read')return structuredClone(docs.get(r.collection+'/'+r.key)||null);
    if(op==='read_many')return r.keys.map(k=>docs.get(r.collection+'/'+k)).filter(Boolean).map(x=>structuredClone(x));
    if(op==='create'){assert(r.value && typeof r.value==='object' && !Array.isArray(r.value),'DOCUMENT_REQUIRED');const k=r.collection+'/'+r.key;if(docs.has(k))return {created:false};put(r.collection,r.key,r.value);events.push(k);return {created:true};}
    if(op==='cas'){
      const k=r.collection+'/'+r.key,old=docs.get(k);if(old.version!==r.version)return {replaced:false};
      // Verify durable backup was completed BEFORE the first target mutation.
      if(k.startsWith('state/batch:'))assert(docs.has('journal/protocol:'+f.profile.id+':backup-complete'));
      docs.set(k,{...old,version:r.version+1,value:structuredClone(r.value)});events.push(k);return {replaced:true,version:r.version+1};
    }
    if(op==='rounds_read')return r.ids.filter(id=>rounds.has(id)).map(id=>structuredClone(rounds.get(id)));
    if(op==='rounds_insert'){for(const x of r.records)rounds.set(x._id,structuredClone(x));events.push('rounds-write');return {};}
    if(op==='rounds_scan')return [...rounds.values()].filter(x=>x.sequence>r.after).sort((a,b)=>a.sequence-b.sequence).slice(0,100);
    throw Error('UNEXPECTED_TRANSPORT');
  }};
  const gate={observe(){},status:()=>({allowed:true,maxBatchSize:100,metrics:{diskFreeBytes:100*1024**3}})};
  const store=new RunnerState({transport,gate,now:()=>f.now,sleep:async()=>{}});
  const parser={async call(r){if(r.op==='next')return f.plan.gameId===32836?{MSGID:'FEATURE_START',CFG:'2'}:{MSGID:'FREE_GAME'};assert.equal(r.op,'verify');return {verified:true};}};
  const operator=new ProtocolRecovery({store,transport,gate,parser,plan:f.plan,profile:f.profile,
    githubIdle:async()=>assert(idle,'OTHER_RUN_ACTIVE'),commit:f.commit,owner:'maintenance',now:()=>f.now,sleep:async()=>{}});
  return {...f,docs,rounds,events,operator,store,block(){idle=false;}};
}
async function finishShort(f){
  const pool=f.docs.get('state/pool:'+f.plan.trialId).value;
  const offset=f.profile.group==='primary'?0:20;
  for(let worker=offset;worker<offset+20;worker++){
    let w=pool.workers[worker];
    if(!w){
      const id=pool.nextBatchId++,start=pool.nextSequence,end=start+99;pool.nextSequence=end+1;
      w=pool.workers[worker]={sessionHash:String(worker).padStart(64,'0'),activeBatch:{id,worker,start,end},epoch:1};
      f.docs.set('state/batch:'+f.plan.trialId+':'+id,{_id:f.profile.group+'/batch:'+f.plan.trialId+':'+id,version:1,
        value:{id,worker,start,end,sessionHash:w.sessionHash,journaled:start-1,checkpoint:start-1,pending:null,failure:null,epoch:1}});
    }
    const b=f.docs.get('state/batch:'+f.plan.trialId+':'+w.activeBatch.id).value,pending=b.pending;
    for(let n=0;n<10;n++){
      const sequence=b.journaled+1,raw=n===0 && pending?structuredClone(pending.raw):{startBalanceRaw:10000,steps:[]};
      if(f.plan.gameId===32836 && pending && n===0)raw.steps.push(...['FEATURE_START','FEATURE_PICK','FEATURE_END'].map(msgId=>({msgId,responsePayload:msgId})));
      else raw.steps.push({msgId:pending && n===0?'FREE_GAME':'BET',responsePayload:'NFG=0'});
      const r={_id:hash({fixture:sequence}),contentHash:hash({complete:sequence}),trialId:f.plan.trialId,
        sequence,attempt:pending && n===0?pending.attempt:'new-'+sequence,batchId:b.id,shardId:worker,
        sourceSessionHash:w.sessionHash,fixtureOnly:false,buy:0,bonus:b.id===(f.plan.gameId===32836?2:5) && pending && n===0?2:0,raw};
      f.docs.set('journal/'+receiptKey(f.plan.trialId,sequence),{_id:f.profile.group+'/'+receiptKey(f.plan.trialId,sequence),version:1,value:r});
      f.rounds.set(r._id,structuredClone(r));b.journaled=sequence;b.checkpoint=sequence;
    }
    Object.assign(b,{pending:null,protocolResume:null,leaseUntil:0,owner:'short'});
    Object.assign(w,{owner:'short',epoch:b.epoch,leaseUntil:0,resumeSafe:true});
  }
  f.docs.get('state/campaign').value.protocolValidation.runKey='capture-run:999:1';
}
export {fixture,operatorFixture,finishShort};
