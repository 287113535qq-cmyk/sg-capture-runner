import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {params,integer} from '../../trial/capture-batch.mjs';
import {captureXmlParser} from '../../trial/collector-loader.mjs';
import {stable} from '../mongo-writer.mjs';
import fs from 'node:fs';

// Legacy rows have no transport timing receipts. Check the stored protocol,
// classification and financial evidence without inventing timing or native credit.
export function inspectExistingOrdinary(doc,plan,binding){
 const d=doc?.data;
 assert(Array.isArray(doc?.rtp)&&doc.rtp.length>0&&new Set(doc.rtp).size===doc.rtp.length&&doc.rtp.every(n=>Number.isSafeInteger(n)&&n>=0),'SG_EXISTING_BUSINESS_RTP');
 assert(/^[a-f0-9]{24}$/.test(doc?._id)&&doc.gameId===plan.runtimeGameId&&d?.gameId===plan.runtimeGameId
  &&d.runtimeSlug===plan.runtimeSlug&&stable(doc.rtp)===stable(binding.rtp),'SG_EXISTING_BUSINESS_IDENTITY');
 assert(plan.adapter==='native-nextgen-v1'&&doc.buy===0&&doc.bonus===0&&d.primaryBonusKind==='none'
  &&stable(d.specialKinds)===stable([])&&d.isFreeChoiceRound===false&&d.freeChoiceOptionIndex===0
  &&d.freeChoiceOptionCount===0&&d.enhancedBetLevel===0&&d.enhancedBetLabel===''
  &&d.stepCount===1&&stable(d.msgIds)===stable(['BET'])&&d.steps?.length===1,'SG_EXISTING_BUSINESS_REVIEW_REQUIRED');
 const s=d.steps[0],q=params(s.requestPayload),p=params(s.responsePayload);
 assert(s.msgId==='BET'&&s.methodName==='processGameMessage'&&q.MSGID==='BET'&&p.MSGID==='BET'
  &&typeof q.PID==='string'&&q.PID.length>6&&q.PID.length<512
  &&stable(Object.fromEntries(Object.entries(q).filter(([k])=>k!=='PID')))===stable({...plan.requestParams,MSGID:'BET'}),'SG_EXISTING_BUSINESS_REQUEST');
 assert(['0','0|',''].includes(p.FID??'0|')&&integer(p.NFG??'0')===0&&p.IFG==='0'
  &&!Object.keys(p).some(k=>k==='CFG'||k==='ABPM'||k.startsWith('FS_')||k.startsWith('NFR_')),'SG_EXISTING_BUSINESS_FEATURE');
 assert(typeof s.responseXml==='string'&&s.responseXml.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(s.responseXml),'SG_EXISTING_BUSINESS_XML');
 const root=captureXmlParser().parse(s.responseXml)?.GDMRESPONSE;
 assert(root&&String(root.SUCCESS).toLowerCase()==='true'&&String(root.OGS_RC)==='0'&&root.PAYLOAD===s.responsePayload,'SG_EXISTING_BUSINESS_XML');
 const raw=n=>{assert(Number.isFinite(n)&&n>=0&&Number.isSafeInteger(Math.round(n*100))&&Math.abs(n*100-Math.round(n*100))<1e-7,'SG_EXISTING_BUSINESS_MONEY');return Math.round(n*100);};
 const start=raw(d.startBalance),end=raw(d.endBalance),win=raw(d.totalWin),bet=raw(doc.bet);
 assert(bet===plan.betRaw&&end===start-bet+win&&integer(p.B)===end&&integer(p.AB)===end
  &&integer(p.TW)===win&&s.responseBalance===end&&Number.isFinite(doc.mul)&&Math.abs(doc.mul-win/bet)<0.000501,'SG_EXISTING_BUSINESS_MONEY');
 return {recordHash:createHash('sha256').update(stable(doc)).digest('hex'),protocolVerified:true,moneyVerified:true,
  typeAndRtpVerified:true,transportTimingAvailable:false,newNativeCredit:0};
}
// Legacy free replays use their own pinned automatic contract, or the native
// zero-FID free contract. This diagnostic has no source or timing permission.
export function inspectExistingNextgen(doc,plan,binding){
 if(doc?.data?.steps?.length===1)return inspectExistingOrdinary(doc,plan,binding);
 const d=doc?.data,profile=JSON.parse(fs.readFileSync('service/round_types.json')).profiles[plan.sourceKey];
 assert(plan.adapter==='native-nextgen-v1'&&profile?.adapter==='native-nextgen-v1'&&profile.protocol==='nextgen'
  &&profile.fixtureOnly===false&&profile.freeSelector==='implicit-single-free-game'
  &&stable(profile.freeTypes)===stable({'native-free-game':1})&&profile.evidence.captureGameId===binding.gameId
  &&profile.evidence.runtimeGameId===binding.runtimeGameId,'SG_EXISTING_BUSINESS_TYPE_POLICY');
 assert(/^[a-f0-9]{24}$/.test(doc?._id)&&doc.gameId===plan.runtimeGameId&&d?.gameId===plan.runtimeGameId
  &&d.runtimeSlug===plan.runtimeSlug&&doc.buy===0&&doc.bonus===1&&d.primaryBonusKind==='freeGame'
  &&stable(d.specialKinds)===stable(['freeGame'])&&d.enhancedBetLevel===0&&d.enhancedBetLabel===''
  &&d.isFreeChoiceRound===false&&d.freeChoiceOptionIndex===0&&d.freeChoiceOptionCount===0,'SG_EXISTING_BUSINESS_FREE_IDENTITY');
 assert(stable(doc.rtp)===stable(binding.rtp)&&Array.isArray(doc.rtp)&&doc.rtp.length>0
  &&new Set(doc.rtp).size===doc.rtp.length&&doc.rtp.every(n=>Number.isSafeInteger(n)&&n>=0),'SG_EXISTING_BUSINESS_RTP');
 let contract=null;
 if(plan.automaticFreeContract!==undefined){
  const c=JSON.parse(fs.readFileSync('config/ag-rolling-automatic-free-contracts.json'));contract=c.sources[plan.sourceKey];
  assert(c.schema==='sg-ag-rolling-automatic-free-contracts-v1'&&c.sourceAllowance===0&&contract
   &&plan.automaticFreeContract==='nextgen-automatic-nfg-free-v1'
   &&createHash('sha256').update(stable(contract)).digest('hex')===plan.automaticFreeContractHash
   &&['gameId','runtimeGameId','sourceKey','betRaw','requestParams'].every(k=>stable(contract[k])===stable(plan[k])),'SG_EXISTING_BUSINESS_FREE_POLICY');
 }
 const raw=n=>{assert(Number.isFinite(n)&&n>=0&&Number.isSafeInteger(Math.round(n*100))&&Math.abs(n*100-Math.round(n*100))<1e-7,'SG_EXISTING_BUSINESS_MONEY');return Math.round(n*100);};
 const start=raw(d.startBalance),end=raw(d.endBalance),win=raw(d.totalWin),bet=raw(doc.bet),held=start-bet;
 assert(bet===plan.betRaw&&held>=0&&end===held+win&&Number.isFinite(doc.mul)&&Math.abs(doc.mul-win/bet)<0.000501,'SG_EXISTING_BUSINESS_MONEY');
 assert(Array.isArray(d.steps)&&d.steps.length>1&&d.steps.length<=(contract?.maxSteps??100)&&d.stepCount===d.steps.length
  &&stable(d.msgIds)===stable(d.steps.map(s=>s.msgId)),'SG_EXISTING_BUSINESS_FREE_COUNT');
 let remaining=0,priorWin=0,player,sid;
 for(let i=0;i<d.steps.length;i++){
  const s=d.steps[i],msg=i?'FREE_GAME':'BET',q=params(s.requestPayload),p=params(s.responsePayload),last=i===d.steps.length-1;
  assert(s.msgId===msg&&s.methodName==='processGameMessage'&&q.MSGID===msg&&p.MSGID===msg&&!s.sourceRejected
   &&(i===0||remaining>0)&&typeof q.PID==='string'&&q.PID.startsWith('gdmgcm')&&q.PID.length>6&&q.PID.length<512
   &&(player===undefined||player===q.PID)&&stable(Object.fromEntries(Object.entries(q).filter(([k])=>k!=='PID')))===stable({...plan.requestParams,MSGID:msg}),'SG_EXISTING_BUSINESS_FREE_REQUEST');player=q.PID;
  if(p.SID!==undefined){assert(p.SID.length>0&&p.SID.length<512&&(sid===undefined||sid===p.SID),'SG_EXISTING_BUSINESS_RESPONSE_SESSION');sid=p.SID;}
  remaining=integer(p.NFG);assert(remaining>=0&&remaining<=100&&p.IFG===String(Number(i>0)),'SG_EXISTING_BUSINESS_FREE_STATE');
  const fid=p.FID??'0|';assert(['0','0|',''].includes(fid)||(contract?.allowedFids?.[msg]??[]).includes(fid)
   &&(remaining>0||i>0&&contract.allowTerminalFeatureId),'SG_EXISTING_BUSINESS_FREE_FEATURE');
  assert(remaining>0||['0','0|',''].includes(fid)||contract?.terminalFids===undefined||contract.terminalFids.includes(fid),'SG_EXISTING_BUSINESS_FREE_TERMINAL');
  assert(!Object.keys(p).some(k=>k==='CFG'||k==='ABPM'||k.startsWith('FS_')||k.startsWith('NFR_'))&&!String(p.GSD??'').includes('#lives~'),'SG_EXISTING_BUSINESS_FREE_FEATURE');
  const b=integer(p.B),ab=integer(p.AB),tw=integer(p.TW);
  assert(tw>=priorWin&&b===held+tw&&(ab===held||last&&remaining===0&&ab===b)&&s.responseBalance===ab,'SG_EXISTING_BUSINESS_FREE_MONEY');priorWin=tw;
  assert(typeof s.responseXml==='string'&&s.responseXml.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(s.responseXml),'SG_EXISTING_BUSINESS_XML');
  const xml=captureXmlParser().parse(s.responseXml)?.GDMRESPONSE;
  assert(xml&&String(xml.SUCCESS).toLowerCase()==='true'&&String(xml.OGS_RC)==='0'&&xml.PAYLOAD===s.responsePayload,'SG_EXISTING_BUSINESS_XML');
  if(s.elapsedMs!==undefined)assert(Number.isSafeInteger(s.elapsedMs)&&s.elapsedMs>=0&&s.elapsedMs<=300000,'SG_EXISTING_BUSINESS_TIMING');
 }
 assert(remaining===0&&priorWin===win&&integer(params(d.steps.at(-1).responsePayload).B)===end,'SG_EXISTING_BUSINESS_FREE_COMPLETE');
 return {recordHash:createHash('sha256').update(stable(doc)).digest('hex'),protocolVerified:true,moneyVerified:true,
  typeAndRtpVerified:true,transportTimingAvailable:d.steps.every(s=>s.elapsedMs!==undefined),newNativeCredit:0};
}
