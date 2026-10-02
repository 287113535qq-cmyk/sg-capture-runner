import assert from 'node:assert/strict';
import {onePaidRound} from './paid-round-evidence.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

export async function reviewAdapterStopDiagnosis({plan,basePlan,profile,pending,parser}) {
 const steps=pending.raw?.steps;
 assert(Array.isArray(steps)&&steps.length>0&&steps.every(s=>s.responseXml&&s.responsePayload),'AG_RECLASSIFY_RAW');
 if(profile.schema==='sg-ag-shared-stop-close-v1') {
  assert(profile.code==='HUFF_UNREVIEWED_FEATURE_SLOTS'&&steps[0].msgId==='BET'
   &&steps.filter(s=>s.msgId==='BET').length===1,'AG_RECLASSIFY_SCOPE');
  let code=null;try{await parser.call({op:'next',plan:basePlan,raw:pending.raw});}catch(e){code=e.code;}
  assert(code===profile.code,'AG_RECLASSIFY_DIAGNOSIS');return;
 }
 // Fixed historical display-field fault, now a reviewed incomplete prefix.
 // This proves only that archiving is safe. No EndGame or old-session replay.
 assert(profile.schema==='sg-ag-shared-stop-close-v2'&&profile.group==='secondary'
  &&plan.gameId===32812&&plan.trialId==='sg_r1_20261003_32812'
  &&plan.adapter==='veryfruity-wms-action-v1'&&plan.runnerGroup==='secondary'
  &&profile.sourceRunKey==='capture-run:37053154321:1'
  &&profile.sourceCommit==='54e5fa3c63bf7766d02a443e5bdd07c10a290412'
  &&profile.code==='VERYFRUITY_ACTION_UNREVIEWED_EXIT'
  &&onePaidRound(plan,pending.raw,{abandoned:true}), 'AG_RECLASSIFY_FIXED_PREFIX_SCOPE');
 const next=await parser.call({op:'next',plan:basePlan,raw:pending.raw});
 assert(hash(next)===profile.reviewedNextHash&&hash(next)===hash({MSGID:'EndGame'}),'AG_RECLASSIFY_FIXED_PREFIX');
}
