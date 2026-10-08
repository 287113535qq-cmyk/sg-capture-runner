import assert from 'node:assert/strict';
import {prepareExistingAgResume} from './sg-ag-existing-resume.mjs';
import {WMS_FIVE_PINS,ownWmsBusinessPlan} from './sg-own-wms-business.mjs';

// Production admission and offline rehearsals share this adapter decision.
// This only permits the original AG resume to inspect an already read-only
// quota stop; its ending, leases, saved journal and prefix checks still apply.
export async function prepareReviewedExistingAgResume({registry,...context}){
 assert(registry?.plans&&typeof registry.plans==='object','SG_AG_RESUME_REVIEWED_REGISTRY');
 assert(!Object.hasOwn(context,'canResumeQuotaGame'),'SG_AG_RESUME_NO_ELIGIBILITY_OVERRIDE');
 return prepareExistingAgResume({...context,canResumeQuotaGame:game=>{
  const plan=registry.plans[game.gameId];
  if(!plan||String(plan.gameId)!==game.gameId)return false;
  return Object.hasOwn(WMS_FIVE_PINS,game.gameId)?ownWmsBusinessPlan(plan):plan.adapter==='native-nextgen-v1';
 }});
}
