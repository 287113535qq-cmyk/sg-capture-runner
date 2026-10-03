import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {HUFF_SOURCE,ACTION_VERSION,ACTION_CONTRACT_HASH} from '../trial/huff-action-contract.mjs';

export const PREPARED_COMPACT_GATEWAY_HASH='c2a2af224f01f1b6d84f3e5314a1eaadd57a522381b900534a0faad3b80ecee5';

// Use the already installed fixed Mongo field projection. Exact preparation,
// allocation, native code and activation receipts opt in together.
export function compactPreparedBinding({plan,profile,spec,complete,commit}){
 assert(profile?.schema==='sg-prepared-count-profile-v1'&&profile.group==='primary'
  &&profile.controlReadMode==='compact-worker-v1'&&profile.gatewayHash===PREPARED_COMPACT_GATEWAY_HASH
  &&profile.files?.['service/mongo_only_gateway.py']===PREPARED_COMPACT_GATEWAY_HASH,'COMPACT_PREPARED_MODE');
 assert(plan?.gameId===32714&&plan.runtimeGameId===33114&&plan.trialId==='sg_r1_20260928_32714'
  &&plan.sourceKey===HUFF_SOURCE&&plan.target===300000&&plan.phase===1&&plan.buy===0
  &&plan.featureProfile===ACTION_VERSION&&plan.actionContractHash===ACTION_CONTRACT_HASH
  &&plan.countAllocation===profile.activation&&profile.newBetAllowance===0,'COMPACT_PREPARED_SCOPE');
 assert(/^[a-f0-9]{40}$/.test(commit??'')&&spec?.schema==='sg-complete-count-v1'
  &&spec.commit===commit&&spec.activation===plan.countAllocation&&spec.profileHash===hash(profile)
  &&spec.planHash===hash(plan)&&spec.trialId===plan.trialId&&spec.gameId===plan.gameId
  &&spec.sourceRecordsHash===profile.recordsHash&&spec.preparationProofHash===profile.preparationProofHash
  &&complete?.schema==='sg-complete-count-activation-v1'&&complete.specHash===hash(spec)
  &&complete.commit===commit&&complete.profileHash===hash(profile)&&complete.planHash===hash(plan)
  &&complete.trialId===plan.trialId&&complete.sourceRequests===0&&complete.newBetAllowance===0,
 'COMPACT_PREPARED_RECEIPT');
 return true;
}

export function compactPreparedRuntimeBinding({plan,profile,revision,receipt,spec,complete,commit,runtimeName}){
 assert(['sg-prepared-zero-source-runtime-v1','sg-prepared-settled-runtime-v1'].includes(revision?.schema)
  &&runtimeName===`count-prepared-runtime-32714-${revision.revisionId}.json`
  &&/^[a-f0-9]{64}$/.test(revision.revisionId??'')&&revision.gameId===32714
  &&revision.activation===plan.countAllocation&&revision.profileHash===hash(profile)
  &&revision.sourceRequests===0&&revision.newBetAllowance===0,'COMPACT_PREPARED_RUNTIME_SCOPE');
 assert(/^[a-f0-9]{40}$/.test(commit??'')&&receipt?.schema==='sg-count-runtime-v2'
  &&receipt.commit===commit&&receipt.activation===plan.countAllocation&&receipt.planHash===hash(plan)
  &&receipt.specHash===hash(spec)&&receipt.profileHash===hash(profile)&&receipt.revisionHash===hash(revision)
  &&receipt.sourceRequests===0&&receipt.newBetAllowance===0,'COMPACT_PREPARED_RUNTIME_RECEIPT');
 return compactPreparedBinding({plan,profile,spec,complete,commit:spec.commit});
}
