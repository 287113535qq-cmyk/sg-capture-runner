import assert from 'node:assert/strict';
import {stable} from '../mongo-writer.mjs';

export const BUSINESS_VERSION='sg-simulate-delivery-v1';
export function businessDocument(record,binding,campaignId){
 assert(record?.fixtureOnly===false&&record.trialId===binding.trialId&&record.gameId===binding.gameId
  &&record.runtimeGameId===binding.runtimeGameId&&/^[a-f0-9]{64}$/.test(record._id)
  &&/^[a-f0-9]{64}$/.test(record.contentHash)&&record.raw?.fixtureOnly===false,'SG_BUSINESS_SOURCE_IDENTITY');
 assert(binding.database==='sg_'+binding.runtimeSlug&&/^sg_[a-z0-9_-]+$/.test(binding.database)
  &&Array.isArray(binding.rtp)&&binding.rtp.length>0&&binding.rtp.every((n,i)=>Number.isSafeInteger(n)&&n>=0&&(i===0||n>binding.rtp[i-1])),'SG_BUSINESS_BINDING');
 const f=record.normalized,m=f.money,steps=record.raw.steps;
 assert(m&&['startBalanceRaw','endBalanceRaw','totalWinRaw','betRaw'].every(k=>Number.isSafeInteger(m[k])&&m[k]>=0)
  &&m.betRaw>0&&m.endBalanceRaw===m.startBalanceRaw-m.betRaw+m.totalWinRaw
  &&record.bet===f.bet&&record.mul===f.mul&&record.buy===f.buy&&record.bonus===f.bonus
  &&f.bet===m.betRaw/100&&Number.isFinite(f.mul)&&f.mul>=0&&f.buy===0
  &&Number.isSafeInteger(f.bonus)&&f.bonus>=0&&['none','freeGame','feature','freeFeature'].includes(f.primaryBonusKind)
  &&Array.isArray(steps)&&steps.length>0&&steps.at(-1).responseBalance===m.endBalanceRaw,'SG_BUSINESS_MONEY');
 assert(campaignId===`sg_${record.gameId}-`+binding.queueId&&record.roundFieldsVersion===f.roundFieldsVersion,'SG_BUSINESS_CAMPAIGN');
 assert(Number.isSafeInteger(record.shardId)&&record.shardId>=0&&record.shardId<20,'SG_BUSINESS_WORKER');
 return {_id:record._id.slice(0,24),bonus:f.bonus,buy:f.buy,bet:f.bet,mul:f.mul,rtp:structuredClone(binding.rtp),gameId:binding.runtimeGameId,
  data:{gameId:binding.runtimeGameId,runtimeSlug:binding.runtimeSlug,startBalance:m.startBalanceRaw/100,
   endBalance:m.endBalanceRaw/100,totalWin:m.totalWinRaw/100,roundFieldsVersion:f.roundFieldsVersion,money:structuredClone(m),
   stepCount:steps.length,msgIds:steps.map(s=>s.msgId),steps:structuredClone(steps),primaryBonusKind:f.primaryBonusKind,
   specialKinds:f.primaryBonusKind==='none'?[]:[f.primaryBonusKind],enhancedBetLevel:0,enhancedBetLabel:'',
   isFreeChoiceRound:false,freeChoiceOptionIndex:0,freeChoiceOptionCount:0,
   captureCampaignId:campaignId,captureWorkerIndex:record.shardId+1,captureNativeShardId:record.shardId,captureRecordId:record._id,
   captureContentHash:record.contentHash,captureTrialId:record.trialId,captureTransformVersion:BUSINESS_VERSION}};
}
export function verifyBusinessPage(records,documents,binding,campaignId){
 assert(records.length>0&&records.length<=100&&records.length===documents.length,'SG_BUSINESS_PAGE');
 assert(new Set(records.map(r=>r._id)).size===records.length&&new Set(documents.map(d=>d._id)).size===documents.length,'SG_BUSINESS_DUPLICATE');
 for(let i=0;i<records.length;i++)assert(stable(documents[i])===stable(businessDocument(records[i],binding,campaignId)),'SG_BUSINESS_DOCUMENT_CHANGED');
 return true;
}
