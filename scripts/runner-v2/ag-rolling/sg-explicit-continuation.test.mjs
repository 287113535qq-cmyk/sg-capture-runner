import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {queueHash} from './sg-queue-profile.mjs';
import {EXPLICIT_CONTINUATION,continuationRoute,continuationIntent} from './sg-explicit-continuation.mjs';
import {EXPLICIT_PROBE,explicitProbeRoute} from './sg-explicit-probe.mjs';
import {nextgenCodec} from './sg-nextgen-codec.mjs';
import {rebaseResumeManifest} from './sg-resume-manifest.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
const registry=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json','utf8')),plan=registry.plans['32474'],pid='gdmgcmoffline-continuation';
const currentPlan=structuredClone(plan);
const {carnivalPickContract,carnivalPickContractHash,...previousCarnival}=plan;
delete plan.carnivalPickContract;delete plan.carnivalPickContractHash;
const {carnivalPickEvidence,...previousProof}=registry.proofs['32474'];previousProof.planHash=carnivalPickEvidence.previousPlanHash;registry.proofs['32474']=previousProof;
function sample({missing=false,picked=true}={}){
 const held=1000-plan.betRaw,common={B:String(held),AB:String(held),TW:'0',IFG:'0',SID:'offline-fixed-session',FRBAL:'0',GA:'0',GSD:'',VER:'1'};
 const frame=(msg,p,fp)=>{const payload=Object.entries({...common,MSGID:msg,...p}).map(([k,v])=>`${k}=${v}`).join('&');
  const request=msg==='BET'?{...plan.requestParams,PID:pid,MSGID:msg}:{GN:plan.runtimeSlug,PID:pid,MSGID:msg,CFG:'1',...(fp?{FP:fp}:{})};
  return {methodName:'processGameMessage',msgId:msg,requestPayload:Object.entries(request).map(([k,v])=>`${k}=${v}`).join('&'),responsePayload:payload,responseBalance:held,elapsedMs:0,responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+payload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'};};
 const ftv='0;6;6;1;2;3;4;5;1;|';
 const steps=[frame('BET',{NFG:'3',FID:'1|0|',CFG:'1',FS_1:'0',NFR_1:'1',CFP_1:'0',FPM_1:'|',FTV_1:ftv})];
 steps.push(frame('FEATURE_START',missing?{}:{NFG:'3',TFG:'3',FGT:'3',FGTW:'0',CW:'0',CFGG:'0'}));
 if(picked)steps.push(frame('FEATURE_PICK',{NFG:'3',TFG:'3',FGT:'3',FGTW:'0',CW:'0',CFGG:'0',FID:'1|0|',CFG:'1',CFP_1:'1',CFR_1:'1',FS_1:'1',NFR_1:'1',FPM_1:'0;|',FTV_1:ftv},'1|1|0'));
 return {fixtureOnly:false,protocol:'nextgen',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',explicitProbeContract:EXPLICIT_PROBE,explicitContinuationContract:EXPLICIT_CONTINUATION,startBalanceRaw:1000,steps};
}
function changeReply(raw,key,value){const s=raw.steps.at(-1),p=Object.fromEntries(s.responsePayload.split('&').map(v=>v.split(/=(.*)/s).slice(0,2)));if(value===undefined)delete p[key];else p[key]=value;
 s.responsePayload=Object.entries(p).map(([k,v])=>`${k}=${v}`).join('&');s.responseXml='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+s.responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>';}
test('only the two witnessed START shapes and position-zero first PICK allow the next constructor ordinal',()=>{
 for(const missing of [false,true]){
  const start=sample({missing,picked:false}),first=continuationRoute(plan,start);assert.equal(first.options.length,15);assert.equal(first.request.FP,'1|1|0');
  const picked=sample({missing}),next=continuationRoute(plan,picked);assert.equal(next.request.FP,'1|2|1');assert.equal(next.options.length,14);assert(!next.options.some(o=>o.position===0));assert.equal(next.settlementApproved,false);
  for(const o of next.options)assert.deepEqual(continuationIntent(plan,picked,`GN=${plan.runtimeSlug}&PID=${pid}&MSGID=FEATURE_PICK&CFG=1&FP=1|2|${o.position}`),{validated:true});
 }
});
test('absent NFG permission is scoped to the exact START shape, never globally optional',()=>{
 for(const [key,value] of [['NFG','0'],['NFG','2'],['EXTRA','1'],['CFG','1'],['ABPM','0'],['B',undefined]]){
  const raw=sample({missing:true,picked:false});changeReply(raw,key,value);assert.throws(()=>continuationRoute(plan,raw),/RESPONSE_REVIEW_REQUIRED|MONEY/);
 }
 const raw=sample();changeReply(raw,'NFG',undefined);assert.throws(()=>continuationRoute(plan,raw),/RESPONSE_REVIEW_REQUIRED/);
});
test('changed counter, feature, position, money, source, XML, session or unknown subsequent response remains rejected',()=>{
 for(const [key,value] of [['CFP_1','2'],['CFR_1','2'],['FS_1','0'],['NFR_1','0'],['FID','2|'],['FPM_1','1;|'],['FTV_1','0;1;1;1;|'],['TW','1'],['AB','891'],['SID','other']]){
  const raw=sample();changeReply(raw,key,value);assert.throws(()=>continuationRoute(plan,raw));
 }
 const position=sample();position.steps[2].requestPayload=position.steps[2].requestPayload.replace('1|1|0','1|1|1');assert.throws(()=>continuationRoute(plan,position),/REQUEST/);
 const error=sample();error.steps[2].responseXml=error.steps[2].responseXml.replace('</GDMRESPONSE>','<ERROR>rejected</ERROR></GDMRESPONSE>');assert.throws(()=>continuationRoute(plan,error),/XML_EVIDENCE/);
 const future=sample();future.steps.push(future.steps[2]);assert.throws(()=>continuationRoute(plan,future),/RESPONSE_REVIEW_REQUIRED/);
 for(const p of [{...plan,betRaw:109},{...plan,sourceKey:'foreign'},{...plan,explicitContinuationContractHash:'a'.repeat(64)}])assert.throws(()=>continuationRoute(p,sample()),/BINDING/);
 for(const fp of ['1|2|0','1|1|1','1|3|1','1|2|15'])assert.throws(()=>continuationIntent(plan,sample(),`GN=${plan.runtimeSlug}&PID=${pid}&MSGID=FEATURE_PICK&CFG=1&FP=${fp}`),/POSITION/);
});
test('saved v1 markers retain their old stop and missing-counter behavior under the new plan',()=>{
 const first=sample();delete first.explicitContinuationContract;assert.throws(()=>explicitProbeRoute(plan,first),/EXPLICIT_PROBE_RESPONSE_REVIEW_REQUIRED/);
 const start=sample({missing:true,picked:false});delete start.explicitContinuationContract;assert.throws(()=>explicitProbeRoute(plan,start),/INVALID_SOURCE_MONEY/);
});
test('actual independent IPC chooses the second PICK, rejects repeated positions and never prepares a special record',async()=>{
 const raw=sample(),codec=await nextgenCodec({plan:currentPlan,session:{pid},sequence:()=>assert.fail('no credit'),worker:0,batchId:1});
 try{assert.deepEqual(await codec.next(raw,async options=>options.at(-1)),{MSGID:'FEATURE_PICK',CFG:'1',FP:'1|2|14'});
  await assert.rejects(()=>codec.next(raw,async()=>({pickIndex:1,position:0})),/POSITION/);
  await assert.rejects(()=>codec.prepare(raw,{attempt:'offline',sessionHash:'a'.repeat(64)}),/INCOMPLETE_EXPLICIT_PROBE/);
 }finally{codec.close();}
});
test('versioned forward preserves the v1 plan, proof and namespace, rejects completion, evidence and historical changes',()=>{
 const {explicitContinuationContract,explicitContinuationContractHash,...oldPlan}=plan;
 const {planHash,explicitContinuationEvidence,...fields}=registry.proofs['32474'],oldProof={...structuredClone(fields),planHash:explicitContinuationEvidence.previousPlanHash};
 const previous={manifest:[{gameId:'32474',planHash:queueHash(oldPlan),adapterProofHash:queueHash(oldProof),campaignId:'retained'}]};
 const f={previous,previousPlans:{plans:{32474:structuredClone(oldPlan)},proofs:{32474:oldProof}},plans:{plans:{32474:plan},proofs:{32474:registry.proofs['32474']}}};
 const before=queueHash(f);assert.equal(rebaseResumeManifest(f)[0].planHash,queueHash(plan));assert.equal(queueHash(f),before);
 for(const damage of [v=>v.plans.proofs[32474].explicitContinuationEvidence.previousProofHash='f'.repeat(64),v=>v.plans.proofs[32474].explicitContinuationEvidence.maximumReviewedOrdinal=3,v=>v.plans.proofs[32474].explicitContinuationEvidence.settlementApproved=true,v=>v.plans.proofs[32474].explicitContinuationEvidence.failedRoundsCredited=1,v=>v.plans.proofs[32474].acceptedRawHashes=[],v=>v.plans.plans[32474].requestParams.RB='6']){
  const bad=structuredClone(f);damage(bad);assert.throws(()=>rebaseResumeManifest(bad),/REPAIR_UNREVIEWED/);
 }
 assert.throws(()=>rebaseResumeManifest({...f,completedGameIds:['32474']}),/COMPLETED_ADAPTER_CHANGED/);
});
test('durable exchange drains and closes once after an unknown second PICK ACK, with no replay or normalization',async()=>{
 for(const unknown of [false,true]){
  const raw=sample(),sends=[],events=[];let closed,closing=0;
  const source=await createProtocolSessions({game:{gameId:'32474'},queueId:'offline-v2',kind:'canary',index:1,owner:'offline',plan,
   guard:async()=>{},journal:{async open(){},async intent(q){events.push('intent:'+q.msgId);return {durable:true};},async response(q){events.push('response:'+q.msgId);if(unknown&&sends.length===6)throw Error('unknown-ack');return {durable:true};},async close(q){closing++;closed=q;},async auditSources(){assert.fail('not complete');}},
   spoolFactory:()=>({append(){events.push('fsync');},confirmed(){},close(){}}),createSession:async()=>({identity:'a'.repeat(64),pid,async close(){},async send(payload,msg){
    sends.push(msg);events.push('source:'+msg);
    if(['INIT','REELSTRIP'].includes(msg)){
     const responsePayload=`MSGID=${msg}&B=1000&AB=1000&TW=0&IFG=0&NFG=0`;
     return {methodName:'processGameMessage',msgId:msg,requestPayload:payload,responsePayload,responseBalance:1000,elapsedMs:0,responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'};
    }
    const step=raw.steps.find(s=>s.msgId===msg);return {...step,requestPayload:payload};}}),
   createCodec:async(plan,session)=>{const codec=await nextgenCodec({plan:currentPlan,session,sequence:()=>assert.fail('no record'),worker:20,batchId:21}),create=codec.createRaw;codec.createRaw=q=>{const raw=create(q);delete raw.carnivalPickContract;return raw;};return codec;}}).open();
  try{await assert.rejects(()=>source.captureRound({chooseOption:async options=>options[0]}),unknown?/JOURNAL_ACK_UNKNOWN/:/EXPLICIT_CONTINUATION_RESPONSE_REVIEW_REQUIRED/);}finally{await source.close();}
  assert.deepEqual(sends,['INIT','REELSTRIP','BET','FEATURE_START','FEATURE_PICK','FEATURE_PICK']);assert.equal(closing,1);assert.equal(closed.performance.normalize.count,0);assert.equal(closed.awaiting,unknown?6:null);
  for(let i=0;i<sends.length;i++){const at=events.indexOf('source:'+sends[i],i===5?events.lastIndexOf('source:FEATURE_PICK'):0);assert(events.slice(0,at).includes('intent:'+sends[i]));assert(events[at+1]==='fsync');}
 }
});
