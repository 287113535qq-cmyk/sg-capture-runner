import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {VERYFRUITY_SOURCE,ACTION_VERSION,ACTION_CONTRACT_HASH} from '../trial/veryfruity-action-protocol.mjs';
export const VERYFRUITY_PILOT_FILE='demo-pilot-veryfruity-action-revision2-20261003.json';
export function checkVeryFruityNextProfile(p,plan){
 assert(p?.schema==='sg-demo-next-game-v1'&&p.group==='secondary'&&p.workerOffset===20
  &&p.gameId===32812&&p.fromGameId===32721&&p.completePreserved===0&&p.abandonedAttempts===0
  &&p.newBetAllowance===100&&p.perWorker===5&&p.workers===20&&!p.sourceClosureHash&&!p.legacyImport&&!p.repairedCandidate
  &&plan?.schema==='sg-work-pool-v1'&&plan.gameId===32812&&plan.runtimeGameId===33172
  &&plan.trialId==='sg_r1_20261003_32812'&&plan.target===300000&&plan.workers===20&&plan.runnerGroup==='secondary'
  &&plan.protocol==='wms'&&plan.sourceKey===VERYFRUITY_SOURCE&&plan.adapter===VERYFRUITY_SOURCE
  &&plan.featureProfile===ACTION_VERSION&&plan.actionContractHash===ACTION_CONTRACT_HASH&&plan.buy===0&&plan.mode==='demo'
  &&plan.betRaw===20&&plan.phase===1&&plan.maxSteps===1026&&p.oldPlanHash===hash(plan)
  &&p.emptyCandidate?.schema==='sg-empty-demo-candidate-v1'&&/^[a-f0-9]{64}$/.test(p.emptyCandidate.campaignHash??''),'VERYFRUITY_NEXT_SCOPE');
 const ref=p.sourceFormal;
 assert(ref?.schema==='sg-formal-source-boundary-v1'&&ref.kind==='complete'
  &&ref.plan?.gameId===32721&&ref.plan.trialId==='sg_r1_20260928_32721'
  &&ref.planHash===hash(ref.plan)&&p.sourcePlanHash===ref.planHash&&p.sourceCommit===ref.commit
  &&p.sourceRunKey==='capture-run:'+ref.run&&ref.proofKey==='game-audit:sg_r1_20260928_32721'
  &&['proofHash','campaignHash','poolHash','specHash','runPermitHash'].every(k=>/^[a-f0-9]{64}$/.test(ref[k]??'')),'VERYFRUITY_COMPLETE_SOURCE');
 assert(/^[a-f0-9]{64}$/.test(p.generation??'')&&p.planHash===hash({...plan,demoGeneration:p.generation})
  &&p.expiresAt-p.createdAt===7200000,'VERYFRUITY_NEXT_PLAN');
 return true;
}
