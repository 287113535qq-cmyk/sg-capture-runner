import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {params,integer} from '../../trial/capture-batch.mjs';
import {captureXmlParser} from '../../trial/collector-loader.mjs';
import {stable} from '../mongo-writer.mjs';

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
