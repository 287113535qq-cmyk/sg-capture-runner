import assert from 'node:assert/strict';
import {readBootstrapRetirement} from './bootstrap-retirement.mjs';

// A retired Init has no paid allowance. Use its existing immutable retirement
// proof rather than changing the original generation's firstBatchId.
export async function interruptedBatchBoundary({store,plan,spec,campaign}) {
 const secondary=campaign?.group==='secondary';
 const very=plan.gameId===32812&&plan.trialId==='sg_r1_20261003_32812'
  &&plan.adapter==='veryfruity-wms-action-v1'&&plan.runnerGroup==='secondary';
 assert(secondary?(spec.group==='secondary'&&spec.workerOffset===20
  &&(very||[32719,32721].includes(plan.gameId)&&plan.trialId===`sg_r1_20260928_${plan.gameId}`))
  :(!spec.group&&!spec.workerOffset),'AG_CLOSE_GROUP_SCOPE');
 if(!campaign.protocolValidation?.bootstrapRebind)return spec.firstBatchId;
 assert(very&&spec.firstBatchId===1,'AG_CLOSE_BOOTSTRAP_SCOPE');
 const proof=await readBootstrapRetirement({store,plan,spec,campaign});
 assert(proof?.done.firstBatchId===2,'AG_CLOSE_BOOTSTRAP_BOUNDARY');
 return proof.done.firstBatchId;
}
