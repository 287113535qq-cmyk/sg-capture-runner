import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkLedger} from './complete-count.mjs';
import {bindPreparedCountPlan} from './prepared-count-plan-binding.mjs';
export async function checkPrimaryLeases({store,plans,now=Date.now,read}) {
  const keys=[...new Set(Object.values(plans).map(p=>'pool:'+p.trialId))];
  // Cover every configured plan; adding a candidate must not require a new fixed count.
  assert(keys.length>0&&keys.length<=178&&keys.length===Object.values(plans).length
    &&Object.values(plans).every(p=>typeof p.trialId==='string'&&p.trialId.length>0),'PLAN_COVERAGE_CHANGED');
  const pools=[];
  for(let i=0;i<keys.length;i+=100)pools.push(...await store.getMany('state',keys.slice(i,i+100)));
  const present=pools.filter(Boolean);
  const campaign=present.length?(await store.get('state','campaign'))?.value:null;
  assert(!present.length||campaign,'LEASE_SCOPE_CHANGED');
  let workers=0,batches=0;
  for(const doc of present){
    const pool=doc.value;
    for(const w of Object.values(pool.workers)){
      assert(Number.isFinite(w.leaseUntil) && w.leaseUntil<=now(),'WORKER_LEASE_ACTIVE');workers++;
    }
    const trialId=doc._id.split('/pool:')[1];
    const plan=Object.values(plans).find(p=>p.trialId===trialId);
    assert(plan && campaign,'LEASE_SCOPE_CHANGED');
    // Completed games are not reread. Active/parked pool batches are checked in full.
    if(campaign.games.find(g=>g.game_id===plan.gameId)?.status==='complete')continue;
    let ceiling=[32795,32799,32721].includes(plan.gameId)&&pool.countAllocation?600001:4001;
    if(pool.countAllocation&&![32795,32799,32721].includes(plan.gameId)){
      const activation=campaign.formalCount?.trialId===trialId?campaign.formalCount.activation:
        campaign.games.find(g=>g.game_id===plan.gameId)?.countActivation;
      assert(/^[a-f0-9]{64}$/.test(activation??''),'LEASE_COUNT_SCOPE');
      const key=`complete-count:${trialId}:${activation}`;
      const spec=(await store.get('journal',key))?.value,complete=(await store.get('journal',key+':complete'))?.value;
      const countPlan=bindPreparedCountPlan({base:plan,activation,spec,read});
      assert(spec?.gameId===plan.gameId&&spec.trialId===trialId&&spec.target===300000&&spec.maxSequence===600000
        &&spec.planHash===hash(countPlan)&&pool.countAllocation.specHash===hash(spec)
        &&complete?.schema==='sg-complete-count-activation-v1'&&complete.specHash===hash(spec),'LEASE_COUNT_SCOPE');
      checkLedger(pool,countPlan,spec);ceiling=600001;
    }
    assert(Number.isSafeInteger(pool.nextBatchId) && pool.nextBatchId>=1 && pool.nextBatchId<=ceiling,'LEASE_SCOPE_CHANGED');
    for(let start=1;start<pool.nextBatchId;start+=100){
      const wanted=Array.from({length:Math.min(100,pool.nextBatchId-start)},(_,i)=>`batch:${trialId}:${start+i}`);
      const rows=await store.getMany('state',wanted);assert(rows.every(Boolean),'LEASE_BATCH_MISSING');
      for(const {value:b} of rows){assert(Number.isFinite(b.leaseUntil) && b.leaseUntil<=now(),'BATCH_LEASE_ACTIVE');batches++;}
    }
  }
  if(present.length)assert(hash((await store.get('state','campaign'))?.value)===hash(campaign),'LEASE_CAMPAIGN_CHANGED');
  return {pools:present.length,workers,batches};
}
