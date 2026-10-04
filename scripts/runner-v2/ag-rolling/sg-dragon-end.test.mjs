import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DRAGON_END,dragonEndPrevious,dragonEndRoute,dragonEndIntent,dragonEndProof} from './sg-dragon-end.mjs';
import {nextgenCodec} from './sg-nextgen-codec.mjs';
import {rebaseResumeManifest} from './sg-resume-manifest.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
const registry=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json','utf8')),plan=registry.plans['32497'],proof=registry.proofs['32497'];
const fixture=JSON.parse(fs.readFileSync('service/tests/fixtures/dragon-end-v3-synthetic.json','utf8')),pid='gdmgcmoffline-dragon-end-v3';
const raw=()=>structuredClone(fixture.raw);
function alter(r,key,value){const s=r.steps.at(-1),p=Object.fromEntries(s.responsePayload.split('&').map(v=>v.split(/=(.*)/s).slice(0,2)));if(value===undefined)delete p[key];else p[key]=value;
 s.responsePayload=Object.entries(p).map(([k,v])=>`${k}=${v}`).join('&');s.responseXml='<GDMRESPONSE><OGS_RC>0</OGS_RC><SUCCESS>true</SUCCESS><PAYLOAD>'+s.responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>';}
test('the own first PICK permits only the original frontend END constructor without FP',()=>{
 const r=dragonEndRoute(plan,raw());assert.deepEqual(r,{request:{MSGID:'FEATURE_END',CFG:'0'},options:[],settlementApproved:false});
 assert.deepEqual(dragonEndIntent(plan,raw(),`GN=${plan.runtimeSlug}&PID=${pid}&MSGID=FEATURE_END&CFG=0`),{validated:true});
 for(const request of ['MSGID=FEATURE_END&CFG=0&FP=0|1|1','MSGID=FEATURE_END&CFG=1','MSGID=FEATURE_PICK&CFG=0&FP=0|2|1','MSGID=FREE_GAME'])assert.throws(()=>dragonEndIntent(plan,raw(),`GN=${plan.runtimeSlug}&PID=${pid}&${request}`),/INTENT_CHANGED/);
});
test('the unchanged START gate rejects the seven own unsupported prefixes before END',()=>{
 assert.throws(()=>dragonEndRoute(plan,fixture.parentBlocked),/EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED/);
 const r=raw();r.steps.length=2;assert.deepEqual(dragonEndRoute(plan,r).request,{MSGID:'FEATURE_PICK',CFG:'0',FP:'0|1|1'});r.steps.length=1;assert.equal(dragonEndRoute(plan,r).request.MSGID,'FEATURE_START');
});
test('money, PID, SID, exact counters, PD and XML cannot be changed to advance',()=>{
 for(const [k,v] of [['TW','1'],['AB','1'],['B','1'],['SID','other'],['IFG','1'],['CFP_0','2'],['NFR_0','0'],['FS_0','0'],['FID','1|'],['TFW_0','1'],['ABPM','0'],['PD','rid_100~0#']]){const r=raw();alter(r,k,v);assert.throws(()=>dragonEndRoute(plan,r));}
 const r=raw();r.steps[2].requestPayload=r.steps[2].requestPayload.replace(pid,'gdmgcmother');assert.throws(()=>dragonEndRoute(plan,r),/REQUEST/);
 for(const value of ['<OGS_RC>1</OGS_RC>','<ERROR>reject</ERROR>']){const r=raw();r.steps[2].responseXml=r.steps[2].responseXml.replace('<OGS_RC>0</OGS_RC>',value);assert.throws(()=>dragonEndRoute(plan,r),/XML/);}
 for(const changes of [{betRaw:101},{runtimeGameId:33027},{dragonEndContractHash:'a'.repeat(64)}])assert.throws(()=>dragonEndRoute({...plan,...changes},raw()),/BINDING/);
});
test('actual codec IPC preserves old v2 refusal and never grants special settlement or a second END',async()=>{
 const codec=await nextgenCodec({plan,session:{pid},sequence:()=>assert.fail('no credit'),worker:0,batchId:1});
 try{assert.deepEqual(await codec.next(raw()),{MSGID:'FEATURE_END',CFG:'0'});const old=raw();delete old.dragonEndContract;await assert.rejects(()=>codec.next(old),/EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED/);
  await assert.rejects(()=>codec.prepare(raw(),{attempt:'offline',sessionHash:'a'.repeat(64)}),/INCOMPLETE_DRAGON_END/);
  const unknown=raw();unknown.steps.push({...unknown.steps[2],msgId:'FEATURE_END'});await assert.rejects(()=>codec.next(unknown),/DRAGON_END_RESPONSE_REVIEW_REQUIRED/);
 }finally{codec.close();}
});
test('mandatory proof rejects re-signed count, frame, record, intent, raw and credit evidence',()=>{
 assert.equal(dragonEndProof(plan,proof),true);
 for(const [k,v] of [['ownClosedPrefixes',87],['actualOwnCodecPythonRequests',256],['oldAcceptedRecordParity',98],['ownPrefixRoutesHash','a'.repeat(64)],['oldOrdinaryRecordFormsHash','a'.repeat(64)],['ownCandidateIntentsHash','a'.repeat(64)],['nativeEvidenceHash','a'.repeat(64)],['endResponsesObserved',1],['failedRoundsCredited',1]]){const p=structuredClone(proof);p.dragonEndEvidence.wiringEvidence[k]=v;assert.throws(()=>dragonEndProof(plan,p),/PROOF/);}
 const p=structuredClone(proof);p.acceptedRawHashes=[];assert.throws(()=>dragonEndProof(plan,p),/PROOF/);
});
test('immutable original to v1 to v2 to v3 forward preserves namespace and requires every old proof',()=>{
 const parent=dragonEndPrevious(plan),{dragonEndEvidence,...fields}=proof,parentProof={...fields,planHash:queueHash(parent)};
 const {explicitDragonContract,explicitDragonContractHash,...v1}=parent,{explicitDragonEvidence,...v1fields}=parentProof,v1proof={...v1fields,planHash:queueHash(v1)};
 const {explicitProbeContract,explicitProbeContractHash,...original}=v1,{previousPlanHash,explicitProbeEvidence,...originalFields}=v1proof,originalProof={...originalFields,planHash:queueHash(original)};
 for(const [old,oldProof] of [[original,originalProof],[v1,v1proof],[parent,parentProof]]){
  const entry={gameId:'32497',campaignId:'same',namespace:'same',planHash:queueHash(old),adapterProofHash:queueHash(oldProof)},args={previous:{manifest:[entry]},previousPlans:{plans:{32497:old},proofs:{32497:oldProof}},plans:registry},hash=queueHash(args);
  const result=rebaseResumeManifest(args)[0];assert.equal(result.namespace,'same');assert.equal(result.campaignId,'same');assert.equal(result.planHash,queueHash(plan));assert.equal(queueHash(args),hash);
  assert.throws(()=>rebaseResumeManifest({...args,completedGameIds:['32497']}),/COMPLETED_ADAPTER_CHANGED/);
  const bad=structuredClone(args);bad.previousPlans.proofs[32497].acceptedRawHashes=[];assert.throws(()=>rebaseResumeManifest(bad));
 }
});
test('the first unknown END response or ACK drains once with durable evidence and no record',async()=>{
 for(const unknown of [false,true]){const r=raw(),sends=[],events=[];let closure,closed=0;
  const source=await createProtocolSessions({game:{gameId:'32497'},queueId:'offline-end-v3',kind:'canary',index:1,owner:'offline',plan,guard:async()=>{},
   journal:{async open(){},async intent(q){events.push('intent:'+q.msgId);return {durable:true};},async response(q){events.push('response:'+q.msgId);if(unknown&&sends.length===6)throw Error('unknown');return {durable:true};},async close(q){closure=q;closed++;},async auditSources(){assert.fail('no credit');}},spoolFactory:()=>({append(){events.push('fsync');},confirmed(){},close(){}}),
   createSession:async()=>({identity:'a'.repeat(64),pid,async close(){},async send(payload,msg){sends.push(msg);events.push('source:'+msg);
    if(['INIT','REELSTRIP'].includes(msg)){const p=`MSGID=${msg}&B=1000000&AB=1000000&TW=0&IFG=0&NFG=0`;return {methodName:'processGameMessage',msgId:msg,requestPayload:payload,responsePayload:p,responseBalance:1000000,elapsedMs:0,responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+p.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'};}
    return {...(r.steps.find(s=>s.msgId===msg)??r.steps[2]),msgId:msg,requestPayload:payload};}}),createCodec:(plan,session)=>nextgenCodec({plan,session,sequence:()=>assert.fail('no credit'),worker:20,batchId:21})}).open();
  try{await assert.rejects(()=>source.captureRound({}),unknown?/JOURNAL_ACK_UNKNOWN/:/DRAGON_END_RESPONSE_REVIEW_REQUIRED/);}finally{await source.close();}
  assert.deepEqual(sends,['INIT','REELSTRIP','BET','FEATURE_START','FEATURE_PICK','FEATURE_END']);assert.equal(closed,1);assert.equal(closure.awaiting,unknown?6:null);assert.equal(closure.performance.normalize.count,0);assert.equal(events.filter(e=>e==='fsync').length,6);assert(events.indexOf('intent:FEATURE_END')<events.indexOf('source:FEATURE_END'));
 }
});
