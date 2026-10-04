import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EXPLICIT_DRAGON,dragonRoute,dragonIntent} from './sg-explicit-dragon.mjs';
import {explicitProbeRoute} from './sg-explicit-probe.mjs';
import {nextgenCodec} from './sg-nextgen-codec.mjs';
import {rebaseResumeManifest} from './sg-resume-manifest.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
const registry=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json','utf8')),plan=registry.plans['32497'],pid='gdmgcmoffline-dragon';
function sample(){
 const held=1000-plan.betRaw,common={B:String(held),AB:String(held),TW:'0',IFG:'0',SID:'offline-dragon',FRBAL:'0',GA:'0',GSD:'',VER:'1'};
 const frame=(msg,p)=>{const payload=Object.entries({...common,MSGID:msg,...p}).map(([k,v])=>`${k}=${v}`).join('&');
  const q=msg==='BET'?{...plan.requestParams,PID:pid,MSGID:msg}:{GN:plan.runtimeSlug,PID:pid,MSGID:msg,CFG:'0'};
  return {methodName:'processGameMessage',msgId:msg,requestPayload:Object.entries(q).map(([k,v])=>`${k}=${v}`).join('&'),responsePayload:payload,responseBalance:held,elapsedMs:0,
   responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+payload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'};};
 return {fixtureOnly:false,protocol:'nextgen',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,
  explicitProbeContract:plan.explicitProbeContract,explicitDragonContract:EXPLICIT_DRAGON,
  steps:[frame('BET',{NFG:'0',FID:'0|',CFG:'0',FS_0:'0',NFR_0:'1',CFP_0:'0',FPM_0:'|',FTV_0:'0;1;1;1;|'}),
   frame('FEATURE_START',{PD:'rid_100~0#stops_100~0,1,2,3,4,5,6#totalBet_100~100#va_100~'+('0,'.repeat(26))+'#'})]};
}
function alter(raw,key,value){const s=raw.steps.at(-1),p=Object.fromEntries(s.responsePayload.split('&').map(v=>v.split(/=(.*)/s).slice(0,2)));if(value===undefined)delete p[key];else p[key]=value;
 s.responsePayload=Object.entries(p).map(([k,v])=>`${k}=${v}`).join('&');s.responseXml='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+s.responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>';}
test('only reviewed Dragon START and numeric PD shapes allow the fixed original frontend PICK',()=>{
 const raw=sample();assert.deepEqual(dragonRoute(plan,raw),{request:{MSGID:'FEATURE_PICK',CFG:'0',FP:'0|1|1'},options:[],settlementApproved:false});
 assert.deepEqual(dragonIntent(plan,raw,`GN=${plan.runtimeSlug}&PID=${pid}&MSGID=FEATURE_PICK&CFG=0&FP=0|1|1`),{validated:true});
 const trigger=structuredClone(raw);trigger.steps.pop();assert.equal(dragonRoute(plan,trigger).request.MSGID,'FEATURE_START');
});
test('missing NFG is confined to the exact witnessed START shape; unknown PD shapes and wager are rejected',()=>{
 for(const [key,value] of [['NFG','0'],['CFG','0'],['ABPM','0'],['PD',undefined],['PD','rid_100~0#totalBet_100~100#'],['PD',sample().steps[1].responsePayload.split('PD=')[1].replace('totalBet_100~100','totalBet_100~101')]]){
  const raw=sample();alter(raw,key,value);assert.throws(()=>dragonRoute(plan,raw),/RESPONSE_REVIEW_REQUIRED/);
 }
 for(const pd of ['rid_100~0#rid_100~0#', 'rid_100~NaN#', 'unknown~1#', 'rid_100~0~1#']){
  const raw=sample();alter(raw,'PD',pd);assert.throws(()=>dragonRoute(plan,raw),/RESPONSE_REVIEW_REQUIRED/);
 }
});
test('changed balance, accumulated win, PID, SID, XML rejection, source and contract never pass',()=>{
 for(const [key,value] of [['B','901'],['AB','899'],['TW','1'],['SID','other']]){const raw=sample();alter(raw,key,value);assert.throws(()=>dragonRoute(plan,raw));}
 const pidChange=sample();pidChange.steps[1].requestPayload=pidChange.steps[1].requestPayload.replace(pid,'gdmgcmother');assert.throws(()=>dragonRoute(plan,pidChange),/REQUEST/);
 const xml=sample();xml.steps[1].responseXml=xml.steps[1].responseXml.replace('</GDMRESPONSE>','<ERROR>rejected</ERROR></GDMRESPONSE>');assert.throws(()=>dragonRoute(plan,xml),/XML_EVIDENCE/);
 for(const damage of [{betRaw:101},{runtimeGameId:33027},{sourceKey:'foreign'},{explicitDragonContractHash:'a'.repeat(64)}])assert.throws(()=>dragonRoute({...plan,...damage},sample()),/BINDING/);
});
test('old stored v1 markers still stop, and any new PICK response, END or FREE remains unreviewed',()=>{
 const old=sample();delete old.explicitDragonContract;assert.throws(()=>explicitProbeRoute(plan,old),/EXPLICIT_PROBE_RESPONSE_REVIEW_REQUIRED/);
 const next=sample();next.steps.push(next.steps[1]);assert.throws(()=>dragonRoute(plan,next),/EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED/);
 for(const request of ['MSGID=FEATURE_PICK&CFG=0&FP=0|1|0','MSGID=FEATURE_PICK&CFG=0&FP=0|2|1','MSGID=FEATURE_END&CFG=0','MSGID=FREE_GAME'])assert.throws(()=>dragonIntent(plan,sample(),`GN=${plan.runtimeSlug}&PID=${pid}&${request}`),/INTENT_CHANGED/);
});
test('actual independent IPC permits the fixed PICK and refuses special normalization',async()=>{
 const raw=sample(),codec=await nextgenCodec({plan,session:{pid},sequence:()=>assert.fail('no credit'),worker:0,batchId:1});
 try{assert.deepEqual(await codec.next(raw),{MSGID:'FEATURE_PICK',CFG:'0',FP:'0|1|1'});await assert.rejects(()=>codec.prepare(raw,{attempt:'offline',sessionHash:'a'.repeat(64)}),/INCOMPLETE_EXPLICIT_PROBE/);}finally{codec.close();}
});
test('new resume forward retains v1 proof/history and rejects altered evidence or completed adapters',()=>{
 const {explicitDragonContract,explicitDragonContractHash,...oldPlan}=plan;
 const {planHash,explicitDragonEvidence,...fields}=registry.proofs['32497'],oldProof={...structuredClone(fields),planHash:explicitDragonEvidence.previousPlanHash};
 const f={previous:{manifest:[{gameId:'32497',planHash:queueHash(oldPlan),adapterProofHash:queueHash(oldProof),campaignId:'retained'}]},previousPlans:{plans:{32497:structuredClone(oldPlan)},proofs:{32497:oldProof}},plans:{plans:{32497:plan},proofs:{32497:registry.proofs['32497']}}};
 const before=queueHash(f);assert.equal(rebaseResumeManifest(f)[0].planHash,queueHash(plan));assert.equal(queueHash(f),before);
 for(const damage of [v=>v.plans.proofs[32497].explicitDragonEvidence.previousProofHash='f'.repeat(64),v=>v.plans.proofs[32497].explicitDragonEvidence.maximumReviewedResponses=3,v=>v.plans.proofs[32497].explicitDragonEvidence.settlementApproved=true,v=>v.plans.proofs[32497].acceptedRawHashes=[],v=>v.plans.plans[32497].requestParams.BPR='101']){
  const bad=structuredClone(f);damage(bad);assert.throws(()=>rebaseResumeManifest(bad),/REPAIR_UNREVIEWED/);
 }
 assert.throws(()=>rebaseResumeManifest({...f,completedGameIds:['32497']}),/COMPLETED_ADAPTER_CHANGED/);
});
test('new anonymous exchange drains one unreviewed PICK or unknown ACK and never replays or credits it',async()=>{
 for(const unknown of [false,true]){
  const raw=sample(),sends=[];let closed,closing=0;
  const source=await createProtocolSessions({game:{gameId:'32497'},queueId:'offline-dragon',kind:'canary',index:1,owner:'offline',plan,guard:async()=>{},
   journal:{async open(){},async intent(){return {durable:true};},async response(){if(unknown&&sends.length===5)throw Error('unknown-ack');return {durable:true};},async close(q){closing++;closed=q;},async auditSources(){assert.fail('incomplete');}},
   spoolFactory:()=>({append(){},confirmed(){},close(){}}),createSession:async()=>({identity:'a'.repeat(64),pid,async close(){},async send(payload,msg){
    sends.push(msg);if(['INIT','REELSTRIP'].includes(msg)){const p=`MSGID=${msg}&B=1000&AB=1000&TW=0&IFG=0&NFG=0`;return {methodName:'processGameMessage',msgId:msg,requestPayload:payload,responsePayload:p,responseBalance:1000,elapsedMs:0,responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+p.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'};}
    return {...(raw.steps.find(s=>s.msgId===msg)??raw.steps[1]),msgId:msg,requestPayload:payload};}}),
   createCodec:(plan,session)=>nextgenCodec({plan,session,sequence:()=>assert.fail('no record'),worker:20,batchId:21})}).open();
  try{await assert.rejects(()=>source.captureRound({}),unknown?/JOURNAL_ACK_UNKNOWN/:/EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED/);}finally{await source.close();}
  assert.deepEqual(sends,['INIT','REELSTRIP','BET','FEATURE_START','FEATURE_PICK']);assert.equal(closing,1);assert.equal(closed.performance.normalize.count,0);assert.equal(closed.awaiting,unknown?5:null);
 }
});
