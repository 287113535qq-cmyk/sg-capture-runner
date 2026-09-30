import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export const SECONDARY_IDLE_SCHEMA='sg-demo-secondary-idle-pilot-v1';
export function checkSecondaryIdleProfile(profile,plan){
 assert(profile?.schema===SECONDARY_IDLE_SCHEMA&&profile.group==='secondary'&&profile.workerOffset===20
  &&profile.gameId===32719&&profile.fromGameId===null&&plan.gameId===32719
  &&plan.trialId==='sg_r1_20260928_32719'&&plan.runtimeGameId===33119&&plan.buy===0&&plan.phase===1
  &&profile.workers===20&&profile.perWorker===5&&profile.newBetAllowance===100
  &&profile.completePreserved===67&&profile.abandonedAttempts===1
  &&profile.legacyImport?.schema==='sg-parked-import-v1'&&profile.legacyImport.mongoCount===60
  &&profile.legacyImport.complete===67&&profile.legacyImport.pending===1
  &&profile.legacyImport.archiveHash==='2d815dffe1185deb4b13d180744f8eec69364956297efc122cd1858f9b6c01f2'
  &&profile.legacyImport.bytes===74009&&profile.oldPlanHash===hash(plan)
  &&typeof profile.generation==='string'&&/^[a-f0-9]{64}$/.test(profile.generation)
  &&profile.planHash===hash({...plan,demoGeneration:profile.generation})
  &&profile.expiresAt-profile.createdAt===7200000
  &&!profile.sourceFormal&&!profile.sourceGeneration&&!profile.sourceRunKey&&!profile.repairedCandidate&&!profile.emptyCandidate,
  'SECONDARY_IDLE_PROFILE_SCOPE');
 return profile;
}
export function checkIdleSecondaryCampaign(campaign,gameId=32719){
 assert(campaign?.schema==='sg-github-campaign-v2'&&campaign.group==='secondary'&&campaign.enabled===true
  &&campaign.activeGame===null&&!campaign.audit&&!campaign.protocolValidation&&!campaign.formalCount
  &&campaign.validationLimit===0&&campaign.games.filter(g=>g.game_id===gameId).length===1
  &&campaign.games.find(g=>g.game_id===gameId).status==='parked-protocol'
  &&campaign.games.every(g=>g.status!=='active'),'SECONDARY_CAMPAIGN_NOT_IDLE');
}
