import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';
import {demoRuntimeCommit} from './demo-runtime.mjs';
export class DemoFresh{
 constructor({store,plan,stage,runKey,now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){Object.assign(this,{store,plan,stage,runKey,now,sleep});}
 async admit(identity,worker){
  const get=async(c,k)=>(await this.store.get(c,k))?.value,c=await get('state','campaign'),p=c?.protocolValidation;
  const secondary=c?.group==='secondary',offset=secondary?20:0;
  assert(this.stage==='fresh'&&Number.isInteger(worker)&&worker>=offset&&worker<offset+20&&identity.shardId===worker
   &&c?.enabled&&c.activeGame===this.plan.gameId&&c.games.find(g=>g.game_id===this.plan.gameId)?.status==='active'&&c.validationLimit===5
   &&p?.phase==='short'&&p.generation===this.plan.demoGeneration&&p.commit===identity.commitSha&&p.runKey===this.runKey&&/^capture-run:\d+:1$/.test(this.runKey||''),'DEMO_FRESH_RUN_CHANGED');
  const key=`demo-generation:${this.plan.trialId}:${this.plan.demoGeneration}`,s=await get('journal',key),done=await get('journal',key+':complete');
  const residual=s?.schema==='sg-demo-generation-residual-v1';
  assert((s?.schema==='sg-demo-generation-v1'||residual)&&hash(s)===p.demoFresh&&s.planHash===hash(this.plan)&&s.trialId===this.plan.trialId&&s.gameId===this.plan.gameId&&s.generation===this.plan.demoGeneration&&(await demoRuntimeCommit({store:this.store,plan:this.plan,spec:s,campaign:c}))===p.commit
   &&s.perWorker===5&&s.workers===20&&done?.schema==='sg-demo-generation-complete-v1'&&done.specHash===hash(s)&&done.commit===s.commit&&done.run===s.run,'DEMO_FRESH_NOT_COMPLETE');
  assert(secondary?(s.group==='secondary'&&s.workerOffset===20&&this.plan.gameId===32719&&s.activationStage):(!s.group&&!s.workerOffset),'DEMO_FRESH_GROUP_CHANGED');
  if(s.activationStage){
   const a=s.activationStage,expected=`next-demo-game:${this.plan.trialId}:${this.plan.demoGeneration}`,completed=await get('journal',expected+':complete');
   assert(a.key===expected&&/^[a-f0-9]{64}$/.test(a.profileHash)&&completed?.schema==='sg-next-demo-game-complete-v1'
    &&completed.profileHash===a.profileHash&&completed.generation===s.generation&&completed.commit===s.commit&&completed.run===s.run
    &&completed.newBetAllowance===100&&completed.sourceRequests===0,'DEMO_NEXT_GAME_NOT_COMPLETE');
  }
  if(residual){assert(Array.isArray(s.budgets)&&s.budgets.length===20&&s.budgets.every(n=>Number.isInteger(n)&&n>=0&&n<=5)
    &&s.budgets.reduce((a,b)=>a+b,0)===s.newBetAllowance&&s.newBetAllowance+s.usedBetAllowance===100&&s.usedBetAllowance>0,'DEMO_RESIDUAL_BUDGET');
    const parent=await get('journal',s.parentKey);assert(parent?.schema==='sg-demo-generation-v1'&&hash(parent)===s.parentHash&&parent.newBetAllowance===100,'DEMO_RESIDUAL_PARENT');
  }else assert(s.newBetAllowance===100,'DEMO_FRESH_BUDGET');
  const quota=residual?s.budgets[worker-offset]:5;
  assert(this.now()>=s.createdAt&&this.now()<s.expiresAt&&s.expiresAt-s.createdAt<=7200000&&!s.oldSessions.includes(identity.sessionHash),'DEMO_FRESH_STALE_OR_OLD_SESSION');
  const pool=await get('state','pool:'+this.plan.trialId);assert(pool?.enabled&&!pool.failure&&pool.planHash===hash(this.plan)&&pool.demoGeneration?.specHash===hash(s)&&pool.nextBatchId>=s.firstBatchId&&pool.nextBatchId<=s.firstBatchId+20,'DEMO_FRESH_POOL_CHANGED');
  const keys=Array.from({length:pool.nextBatchId-s.firstBatchId},(_,i)=>`batch:${this.plan.trialId}:${s.firstBatchId+i}`);
  let rows=keys.length?await this.store.getMany('state',keys):[];
  // take() reserves the range by pool CAS before next() creates its batch.
  // Peers may observe this short interval during admission. Wait only for a
  // specifically owned, live reservation; never omit a missing batch.
  for(let attempt=0;rows.some(r=>!r)&&attempt<8;attempt++){
   const fresh=await get('state','pool:'+this.plan.trialId);
   assert(fresh?.enabled&&!fresh.failure&&fresh.planHash===hash(this.plan)&&fresh.demoGeneration?.specHash===hash(s)
    &&fresh.nextBatchId>=pool.nextBatchId&&fresh.nextBatchId<=s.firstBatchId+20,'DEMO_FRESH_POOL_CHANGED');
   for(let i=0;i<rows.length;i++)if(!rows[i]){
    const id=s.firstBatchId+i,owners=Object.entries(fresh.workers).filter(([,w])=>w.activeBatch?.id===id);
    assert(owners.length===1&&Number(owners[0][0])!==worker&&owners[0][1].activeBatch.worker===Number(owners[0][0])
     &&owners[0][1].owner&&owners[0][1].leaseUntil>this.now(),'DEMO_FRESH_BATCH_MISSING');
   }
   await this.sleep(250);rows=await this.store.getMany('state',keys);
  }
  assert(rows.every(Boolean),'DEMO_FRESH_BATCH_MISSING');
  const own=rows.map(x=>x.value).filter(b=>b.worker===worker),count=own.reduce((n,b)=>n+b.journaled-b.start+1,0);
  assert(count>=0&&count<=quota&&own.every(b=>!b.pending&&!b.bootstrapAwaiting&&!b.failure&&b.sessionHash===identity.sessionHash),'DEMO_FRESH_PARTIAL_OR_QUOTA');
  assert(own.length===0||count===quota,'DEMO_FRESH_INTERRUPTED_NO_RESUME');
  this.firstBatchId=s.firstBatchId;this.admission={stage:'fresh',limit:quota-count};return this.admission;
 }
 checkLease(batch){assert(this.admission&&batch.id>=this.firstBatchId&&this.admission.limit>0&&(!this.batchId||this.batchId===batch.id),'DEMO_FRESH_OLD_BATCH');this.batchId=batch.id;this.startSequence=batch.start;}
 beforeBegin(sequence){assert(this.admission&&Number.isSafeInteger(this.startSequence)&&sequence>=this.startSequence&&sequence<this.startSequence+this.admission.limit,'DEMO_FRESH_QUOTA_EXHAUSTED');}
}
