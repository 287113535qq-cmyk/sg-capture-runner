import assert from 'node:assert/strict';
export async function checkPrimaryLeases({store,plans,now=Date.now}) {
  const keys=[...new Set(Object.values(plans).map(p=>'pool:'+p.trialId))];
  // The178-game catalog currently has24 configured runnable/parked plans.
  assert(keys.length===24,'PLAN_COVERAGE_CHANGED');
  const pools=[];
  for(let i=0;i<keys.length;i+=100)pools.push(...await store.getMany('state',keys.slice(i,i+100)));
  let workers=0,batches=0;
  for(const doc of pools.filter(Boolean)){
    const pool=doc.value;
    for(const w of Object.values(pool.workers)){
      assert(Number.isFinite(w.leaseUntil) && w.leaseUntil<=now(),'WORKER_LEASE_ACTIVE');workers++;
    }
    const campaign=(await store.get('state','campaign'))?.value;
    const trialId=doc._id.split('/pool:')[1];
    const plan=Object.values(plans).find(p=>p.trialId===trialId);
    assert(plan && campaign,'LEASE_SCOPE_CHANGED');
    // Completed games are not reread. Active/parked pool batches are checked in full.
    if(campaign.games.find(g=>g.game_id===plan.gameId)?.status==='complete')continue;
    assert(Number.isSafeInteger(pool.nextBatchId) && pool.nextBatchId>=1 && pool.nextBatchId<=4001,'LEASE_SCOPE_CHANGED');
    for(let start=1;start<pool.nextBatchId;start+=100){
      const wanted=Array.from({length:Math.min(100,pool.nextBatchId-start)},(_,i)=>`batch:${trialId}:${start+i}`);
      const rows=await store.getMany('state',wanted);assert(rows.every(Boolean),'LEASE_BATCH_MISSING');
      for(const {value:b} of rows){assert(Number.isFinite(b.leaseUntil) && b.leaseUntil<=now(),'BATCH_LEASE_ACTIVE');batches++;}
    }
  }
  return {pools:pools.filter(Boolean).length,workers,batches};
}
