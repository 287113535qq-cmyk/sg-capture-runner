import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';
import {sessionLayoutPlan} from './session-layout-profile.mjs';
// A draft never writes state or admits a source run. Activation independently
// rereads the source, leases, batch proofs and the exact pool/campaign hashes.
export function draftRhinoSessions({base,parent,review,activation,now,files}){
 assert(review?.schema==='sg-count-window-review-v1'&&review.gameId===32799&&review.trialId===base.trialId
  &&review.fullReadback===true&&review.sourceRequests===0&&review.databaseWrites===0&&!review.gameComplete
  &&review.profileHash===hash(parent)&&review.activation===parent.activation
  &&review.complete>=151&&review.remainingComplete===base.target-review.complete,'SESSION_DRAFT_REVIEW');
 assert(review.previousLanesPerHost===1,'SESSION_DRAFT_MEASURED_STEP');
 assert(Number.isSafeInteger(now)&&now>0&&files&&Object.keys(files).length>0,'SESSION_DRAFT_FILES');
 const sessionLayout={schema:'sg-independent-sessions-v1',group:'primary',hosts:20,lanesPerHost:2};
 const profile={schema:'sg-session-layout-rhino-v1',gameId:32799,group:'primary',activation,parentActivation:parent.activation,
  parentProfileHash:hash(parent),basePlanHash:hash(base),planHash:hash({...base,countAllocation:activation,sessionLayout}),
  sourceRun:review.sourceRun,sourceCommit:review.sourceCommit,sourceSpecHash:review.sourceSpecHash,
  sourcePermitHash:review.sourcePermitHash,poolHash:review.poolHash,campaignHash:review.campaignHash,
  completePreserved:review.complete,remainingComplete:review.remainingComplete,newBetAllowance:0,
  previousLanesPerHost:1,sessionLayout,comparisonHash:null,captureMinutes:20,maxSequence:600000,
  sessionRotation:'closed-batches-v1',createdAt:now,expiresAt:now+7200000,files};
 sessionLayoutPlan(base,profile);return profile;
}
