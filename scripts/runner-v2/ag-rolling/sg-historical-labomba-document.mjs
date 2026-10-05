// Local, read-only candidate. The original historical identity is retained.
import assert from 'node:assert/strict';
export const VERSION='sg-historical-simulate-candidate-v1';
export function candidateDocument(r,b,p){
 assert(p.gameId===32723&&p.runtimeGameId===33123&&p.trialId==='sg_r1_20260928_32723'&&p.target===299850
  &&p.runtimeSlug==='labomba96'&&p.sourceKey==='labomba96-round-one-base-v1'&&p.campaignId==='sg_round_one_20260928'
  &&p.adapter==='native-nextgen-v1'&&p.buy===0&&p.betRaw===125,'OWN_HISTORICAL_PLAN');
 assert(b.gameId===p.gameId&&b.runtimeGameId===p.runtimeGameId&&b.trialId===p.trialId&&b.runtimeSlug===p.runtimeSlug
  &&b.database==='sg_labomba96'&&!Object.hasOwn(b,'queueId'),'OWN_HISTORICAL_BINDING');
 assert(Array.isArray(b.rtp)&&b.rtp.length&&b.rtp.every((v,i)=>Number.isSafeInteger(v)&&v>=0&&(i===0||v>b.rtp[i-1])),'OWN_HISTORICAL_RTP');
 assert(r.fixtureOnly===false&&r.raw?.fixtureOnly===false&&r.raw.sourceKey===p.sourceKey&&r.trialId===p.trialId
  &&r.gameId===p.gameId&&r.runtimeGameId===p.runtimeGameId&&/^[a-f0-9]{64}$/.test(r._id)&&/^[a-f0-9]{64}$/.test(r.contentHash)
  &&Number.isSafeInteger(r.sequence)&&r.sequence>=1&&r.sequence<=p.target&&Number.isSafeInteger(r.batchId)&&r.batchId>=1
  &&Number.isSafeInteger(r.shardId)&&r.shardId>=0&&r.shardId<20,'OWN_HISTORICAL_RECORD');
 const f=r.normalized,m=f.money,steps=r.raw.steps;
 assert(f.sourceKey===p.sourceKey&&f.typeMappingHash===b.typeMappingHash&&f.roundFieldsVersion==='sg-round-fields-v1'
  &&['bet','mul','buy','bonus','roundFieldsVersion'].every(k=>r[k]===f[k])&&f.buy===0
  &&((f.primaryBonusKind==='none'&&f.bonus===0)||(f.primaryBonusKind==='freeGame'&&f.bonus===1)),'OWN_HISTORICAL_TYPE');
 assert(['startBalanceRaw','endBalanceRaw','betRaw','totalWinRaw'].every(k=>Number.isSafeInteger(m[k])&&m[k]>=0)
  &&m.betRaw===125&&m.endBalanceRaw===m.startBalanceRaw-m.betRaw+m.totalWinRaw&&f.bet===m.betRaw/100
  &&f.mul===m.totalWinRaw/m.betRaw&&Array.isArray(steps)&&steps.length>0&&steps.at(-1).responseBalance===m.endBalanceRaw,'OWN_HISTORICAL_MONEY');
 return {_id:r._id.slice(0,24),bonus:f.bonus,buy:f.buy,bet:f.bet,mul:f.mul,rtp:structuredClone(b.rtp),gameId:p.runtimeGameId,
  data:{gameId:p.runtimeGameId,runtimeSlug:p.runtimeSlug,startBalance:m.startBalanceRaw/100,endBalance:m.endBalanceRaw/100,
   totalWin:m.totalWinRaw/100,roundFieldsVersion:f.roundFieldsVersion,money:structuredClone(m),stepCount:steps.length,
   msgIds:steps.map(s=>s.msgId),steps:structuredClone(steps),primaryBonusKind:f.primaryBonusKind,
   specialKinds:f.primaryBonusKind==='none'?[]:[f.primaryBonusKind],enhancedBetLevel:0,enhancedBetLabel:'',isFreeChoiceRound:false,
   freeChoiceOptionIndex:0,freeChoiceOptionCount:0,captureSourceCampaignId:p.campaignId,captureNativeShardId:r.shardId,
   captureBatchId:r.batchId,captureSequence:r.sequence,captureRecordId:r._id,captureContentHash:r.contentHash,
   captureTrialId:r.trialId,captureTransformVersion:VERSION}};
}
