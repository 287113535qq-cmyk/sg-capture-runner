import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {loadCountPermission,checkLedger} from './complete-count.mjs';

export function formalRelayInputs(inputs){
 return Object.fromEntries(['role','allocation','round_one_limit','formal_profile','runtime_profile','formal_relay','relay_parent']
  .map(k=>[k,String(inputs?.[k]??'')]).filter(([k,v])=>v!==''||k==='runtime_profile'));
}

// AG's durable claim -> bounded work -> continue model. Reuse an applied
// allocation; never mint a profile, reset a quota, or replay a source request.
export async function relayFormalRun({store,plan,profile,inputs,source,jobs,commit,repository,boundary,createIntent,dispatch,now=Date.now}){
 assert(source?.repository?.full_name===repository&&source.head_sha===commit&&source.event==='workflow_dispatch'
  &&source.path==='.github/workflows/trial-300k.yml'&&source.run_attempt===1&&source.status==='in_progress'
  &&/^runtime-[a-z0-9-]+$/.test(source.head_branch??''),'FORMAL_RELAY_SOURCE');
 assert(inputs?.role==='formal-count'&&inputs.allocation==='round-one'&&inputs.round_one_limit==='0'&&inputs.formal_relay==='same-allocation-v1'
  &&(inputs.relay_parent===undefined||/^\d+:1$/.test(inputs.relay_parent)),'FORMAL_RELAY_INPUTS');
 assert(jobs?.total_count===jobs.jobs?.length&&jobs.total_count<100,'FORMAL_RELAY_JOBS');
 const captures=jobs.jobs.filter(j=>/^capture-\d+$/.test(j.name));
 if(captures.length!==20||captures.some(j=>j.status!=='completed'||j.conclusion!=='success'))return {continued:false,reason:'SOURCE_NOT_SUCCESSFULLY_FINISHED'};
 assert(Array.from({length:20},(_,i)=>`capture-${i}`).every(name=>captures.some(j=>j.name===name)),'FORMAL_RELAY_WORKERS');
 await boundary();
 const pool=(await store.get('state','pool:'+plan.trialId))?.value,c=(await store.get('state','campaign'))?.value;
 if(!pool?.enabled||pool.failure||!c?.enabled||c.activeGame!==plan.gameId||c.validationLimit||c.protocolValidation)return {continued:false,reason:'GAME_STOPPED_OR_COMPLETE'};
 const spec=await loadCountPermission({store,plan,pool,commit}),ledger=checkLedger(pool,plan,spec),parent=`${source.id}:1`;
 assert(spec.profileHash===hash(profile)&&c.formalCount?.activation===spec.activation,'FORMAL_RELAY_PROFILE');
 assert(spec.sessionRotation==='closed-batches-v1'&&!c.audit,'FORMAL_RELAY_SETTLEMENT_POLICY');
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${parent}`))?.value;
 assert(permit?.schema==='sg-count-run-v1'&&permit.activation===spec.activation&&permit.commit===commit&&permit.profileHash===hash(profile),'FORMAL_RELAY_RUN_PERMISSION');
 if(pool.confirmed>=plan.target)return {continued:false,reason:'TARGET_REACHED'};
 if(pool.confirmed<=permit.completeBefore)return {continued:false,reason:'NO_CONFIRMED_PROGRESS'};
 assert(ledger.reserved===0&&Object.values(pool.workers).every(w=>!w.activeBatch&&w.leaseUntil<=now()),'FORMAL_RELAY_NOT_IDLE');
 for(let start=spec.baselineBatchCount+1;start<pool.nextBatchId;start+=100){
  const items=Array.from({length:Math.min(100,pool.nextBatchId-start)},(_,i)=>pool.countAllocation.batches[start+i]);
  assert(items.every(b=>b.closed&&typeof b.settlementKey==='string'),'FORMAL_RELAY_UNSETTLED');
  const receipts=await store.getMany('journal',items.map(b=>b.settlementKey));
  assert(receipts.every((r,i)=>{
   const proof=r?.value,b=proof?.batch,item=items[i];
   return proof?.schema==='sg-count-batch-settlement-v1'&&proof.trialId===plan.trialId&&proof.fullReadback===true
    &&proof.activation===spec.activation&&hash(proof)===item.evidenceHash
    &&item.settlementKey===`count-settlement:${plan.trialId}:${spec.activation}:${item.id}`
    &&b?.id===item.id&&b.worker===item.worker&&b.sessionHash===item.sessionHash&&b.start===item.start&&b.end===item.end
    &&b.checkpoint===b.journaled&&b.journaled===item.start+item.complete-1&&b.pending===null&&!b.pendingOriginal&&!b.bootstrapAwaiting&&!b.failure&&b.leaseUntil===0;
  }),'FORMAL_RELAY_SETTLEMENT');
 }
 const next={...inputs,relay_parent:parent},key=`count-relay:${plan.trialId}:${parent}:intent`;
 const intent={schema:'sg-formal-relay-v1',repository,trialId:plan.trialId,activation:spec.activation,profileHash:hash(profile),
  parentRun:parent,commit,ref:source.head_branch,inputsHash:hash(next),completeBefore:pool.confirmed,remainingComplete:plan.target-pool.confirmed,
  requestedAt:now(),sourceRequests:0,newBetAllowance:0};
 await boundary();
 if(!await createIntent(key,intent))return {continued:false,reason:'DISPATCH_ALREADY_ATTEMPTED'};
 assert(hash((await store.get('journal',key))?.value)===hash(intent),'FORMAL_RELAY_READBACK');
 // A thrown/unknown acknowledgement leaves the intent permanent. No resend.
 await dispatch({ref:intent.ref,inputs:next});
 return {continued:true,parentRun:parent,completeBefore:pool.confirmed,remainingComplete:intent.remainingComplete,newBetAllowance:0};
}

export async function waitFormalRelayParent({store,read,plan,profile,repository,commit,parentRun,inputs,selfRun,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 assert(/^\d+:1$/.test(parentRun??'')&&parentRun!==selfRun,'FORMAL_RELAY_PARENT');
 const intent=(await store.get('journal',`count-relay:${plan.trialId}:${parentRun}:intent`))?.value;
 assert(intent?.schema==='sg-formal-relay-v1'&&intent.repository===repository&&intent.trialId===plan.trialId
  &&intent.parentRun===parentRun&&intent.commit===commit&&intent.profileHash===hash(profile)
  &&intent.activation===plan.countAllocation&&intent.inputsHash===hash(inputs)&&intent.sourceRequests===0&&intent.newBetAllowance===0,'FORMAL_RELAY_BINDING');
 const until=now()+120000;
 while(now()<until){
  const r=await read(`repos/${repository}/actions/runs/${parentRun.split(':')[0]}`);
  assert(`${r.id}:${r.run_attempt}`===parentRun&&r.repository?.full_name===repository&&r.head_sha===commit
   &&r.head_branch===intent.ref&&r.path==='.github/workflows/trial-300k.yml'&&r.event==='workflow_dispatch','FORMAL_RELAY_PARENT_CHANGED');
  if(r.status==='completed'){
   assert(r.conclusion==='success','FORMAL_RELAY_PARENT_FAILED');
   await store.create('journal',`count-relay:${plan.trialId}:${parentRun}:admit`,
    {schema:'sg-formal-relay-admit-v1',parentRun,run:selfRun,commit,activation:plan.countAllocation},{immutable:true});return;
  }
  assert(r.status==='in_progress','FORMAL_RELAY_PARENT_STATE');await sleep(2000);
 }
 throw Error('FORMAL_RELAY_PARENT_WAIT_EXPIRED');
}
