import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CARNIVAL_PICK,carnivalPrevious,carnivalRoute,carnivalIntent,carnivalProof} from './sg-carnival-pick.mjs';
import {continuationRoute} from './sg-explicit-continuation.mjs';
import {nextgenCodec} from './sg-nextgen-codec.mjs';
import {rebaseResumeManifest} from './sg-resume-manifest.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
const registry=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json','utf8')),plan=registry.plans['32474'],proof=registry.proofs['32474'],pid='gdmgcmoffline-pick-v3';
function raw({position=0,missing=false,second=false}={}){
 const held=1000-108,common={B:String(held),AB:String(held),TW:'0',IFG:'0',SID:'offline-pick-v3',FRBAL:'0',GA:'0',GSD:'',VER:'1'},ftv='0;6;6;1;2;3;4;5;1;|';
 const frame=(msg,p,fp)=>{const q=msg==='BET'?{...plan.requestParams,PID:pid,MSGID:msg}:{GN:plan.runtimeSlug,PID:pid,MSGID:msg,CFG:'1',...(fp?{FP:fp}:{})},payload=Object.entries({...common,MSGID:msg,...p}).map(([k,v])=>`${k}=${v}`).join('&');
  return {methodName:'processGameMessage',msgId:msg,requestPayload:Object.entries(q).map(([k,v])=>`${k}=${v}`).join('&'),responsePayload:payload,responseBalance:held,elapsedMs:0,responseXml:'<GDMRESPONSE><OGS_RC>0</OGS_RC><SUCCESS>true</SUCCESS><PAYLOAD>'+payload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'};};
 const counters={NFG:'3',TFG:'3',FGT:'3',CW:'0',FGTW:'0',CFGG:'0'},pick=(ordinal,positions,without)=>({...(without?{}:counters),FID:without?'1|':'1|0|',CFG:'1',CFP_1:String(ordinal),CFR_1:String(ordinal),FPM_1:positions.map(n=>`${n};`).join('')+'|',FS_1:'1',NFR_1:'1',FTV_1:ftv});
 const steps=[frame('BET',{NFG:'3',FID:'1|0|',CFG:'1',FS_1:'0',NFR_1:'1',CFP_1:'0',FPM_1:'|',FTV_1:ftv}),frame('FEATURE_START',counters),frame('FEATURE_PICK',pick(1,[position],missing),`1|1|${position}`)];
 if(second)steps.push(frame('FEATURE_PICK',pick(2,[0,1],false),'1|2|1'));
 return {fixtureOnly:false,protocol:'nextgen',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,explicitProbeContract:plan.explicitProbeContract,explicitContinuationContract:plan.explicitContinuationContract,carnivalPickContract:CARNIVAL_PICK,steps};
}
function alter(value,key,next){const s=value.steps.at(-1),p=Object.fromEntries(s.responsePayload.split('&').map(v=>v.split(/=(.*)/s).slice(0,2)));if(next===undefined)delete p[key];else p[key]=next;
 s.responsePayload=Object.entries(p).map(([k,v])=>`${k}=${v}`).join('&');s.responseXml='<GDMRESPONSE><OGS_RC>0</OGS_RC><SUCCESS>true</SUCCESS><PAYLOAD>'+s.responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>';}
test('the two own first positions and exact optional-counter shapes permit a second pick only',()=>{
 for(const position of [0,1])for(const missing of [false,true]){const v=raw({position,missing}),r=carnivalRoute(plan,v);assert.equal(r.options.length,14);assert(!r.options.some(o=>o.position===position));assert.equal(r.request.FP,`1|2|${position===0?1:0}`);assert.equal(r.settlementApproved,false);}
 const bad=raw({missing:true});alter(bad,'NFG','3');assert.throws(()=>carnivalRoute(plan,bad),/REVIEW_REQUIRED/);
 const unobserved=raw({position:2});assert.throws(()=>carnivalRoute(plan,unobserved),/REVIEW_REQUIRED/);
});
test('only the observed second pair permits ordinal3 and excludes both previous positions',()=>{
 const v=raw({second:true}),r=carnivalRoute(plan,v);assert.equal(r.request.FP,'1|3|2');assert.equal(r.options.length,13);
 for(const o of r.options)assert.deepEqual(carnivalIntent(plan,v,`GN=${plan.runtimeSlug}&PID=${pid}&MSGID=FEATURE_PICK&CFG=1&FP=1|3|${o.position}`),{validated:true});
 for(const fp of ['1|3|0','1|3|1','1|2|2','1|4|2','1|3|15'])assert.throws(()=>carnivalIntent(plan,v,`GN=${plan.runtimeSlug}&PID=${pid}&MSGID=FEATURE_PICK&CFG=1&FP=${fp}`));
 const unsupported=raw({position:1,second:true});assert.throws(()=>carnivalRoute(plan,unsupported),/REVIEW_REQUIRED/);
});
test('money, session, counters, feature shape, XML errors and unknown third responses cannot advance',()=>{
 for(const [key,value] of [['TW','1'],['AB','891'],['SID','other'],['CFP_1','3'],['CFGG','1'],['FID','2|'],['FTV_1','0;2;2;1;1;|'],['FS_1','0'],['ABPM','0']]){const v=raw({second:true});alter(v,key,value);assert.throws(()=>carnivalRoute(plan,v));}
 for(const xml of ['<ERROR>reject</ERROR>','<OGS_RC>1</OGS_RC>']){const v=raw();v.steps.at(-1).responseXml=v.steps.at(-1).responseXml.replace('<OGS_RC>0</OGS_RC>',xml);assert.throws(()=>carnivalRoute(plan,v),/XML/);}
 const v=raw({second:true});v.steps.push(v.steps.at(-1));assert.throws(()=>carnivalRoute(plan,v),/REVIEW_REQUIRED/);
 for(const msg of ['FEATURE_END','FREE_GAME'])assert.throws(()=>carnivalIntent(plan,raw(),`GN=${plan.runtimeSlug}&PID=${pid}&MSGID=${msg}&CFG=1`));
});
test('old v2 raw remains stopped while new raw passes actual independent codec IPC and never settles',async()=>{
 const v=raw({position:1});delete v.carnivalPickContract;assert.throws(()=>continuationRoute(carnivalPrevious(plan),v),/EXPLICIT_CONTINUATION_REQUEST/);
 const codec=await nextgenCodec({plan,session:{pid},sequence:()=>assert.fail('no credit'),worker:0,batchId:1});
 try{await assert.rejects(()=>codec.next(v),/EXPLICIT_CONTINUATION_REQUEST/);const marked=raw({second:true});assert.equal((await codec.next(marked)).FP,'1|3|2');await assert.rejects(()=>codec.prepare(marked,{attempt:'offline',sessionHash:'a'.repeat(64)}),/INCOMPLETE_CARNIVAL_PICK/);}finally{codec.close();}
});
test('mandatory proof rejects re-signed wiring or historical-credit changes and plan/source changes',()=>{
 assert.equal(carnivalProof(plan,proof),true);
 for(const damage of [p=>delete p.carnivalPickEvidence.wiringEvidence,p=>p.carnivalPickEvidence.wiringEvidence.ownPrefixRoutesHash='a'.repeat(64),p=>p.carnivalPickEvidence.wiringEvidence.oldAcceptedRecordParity=99,p=>p.carnivalPickEvidence.wiringEvidence.failedRoundsCredited=1,p=>p.acceptedRawHashes=[]]){const p=structuredClone(proof);damage(p);assert.throws(()=>carnivalProof(plan,p),/PROOF/);}
 for(const change of [{betRaw:109},{runtimeGameId:33028},{carnivalPickContractHash:'a'.repeat(64)}])assert.throws(()=>carnivalRoute({...plan,...change},raw()),/BINDING/);
});
test('immutable v2 to v3 forward retains namespace and rejects complete or tampered entries',()=>{
 const oldPlan=carnivalPrevious(plan),{carnivalPickEvidence,...fields}=proof,oldProof={...fields,planHash:queueHash(oldPlan)},entry={gameId:'32474',campaignId:'retained',namespace:'unchanged',planHash:queueHash(oldPlan),adapterProofHash:queueHash(oldProof)},args={previous:{manifest:[entry]},previousPlans:{plans:{32474:oldPlan},proofs:{32474:oldProof}},plans:{plans:{32474:plan},proofs:{32474:proof}}};
 const unchanged=queueHash(args),result=rebaseResumeManifest(args)[0];assert.equal(result.campaignId,entry.campaignId);assert.equal(result.namespace,entry.namespace);assert.equal(result.planHash,queueHash(plan));assert.equal(queueHash(args),unchanged);
 assert.throws(()=>rebaseResumeManifest({...args,completedGameIds:['32474']}),/COMPLETED_ADAPTER_CHANGED/);
 const bad=structuredClone(args);bad.plans.proofs[32474].carnivalPickEvidence.wiringEvidence.failedRoundsCredited=1;assert.throws(()=>rebaseResumeManifest(bad),/PROOF/);
});
test('unknown third PICK ACK closes once after durable response and produces no complete record',async()=>{
 for(const unknown of [false,true]){const v=raw({second:true}),sends=[],events=[];let closure,closed=0,picks=0;
  const source=await createProtocolSessions({game:{gameId:'32474'},queueId:'offline-v3',kind:'canary',index:1,owner:'offline',plan,guard:async()=>{},
   journal:{async open(){},async intent(q){events.push('intent:'+q.msgId);return {durable:true};},async response(q){events.push('response:'+q.msgId);if(unknown&&sends.length===7)throw Error('unknown');return {durable:true};},async close(q){closure=q;closed++;},async auditSources(){assert.fail('no credit');}},spoolFactory:()=>({append(){events.push('fsync');},confirmed(){},close(){}}),
   createSession:async()=>({identity:'a'.repeat(64),pid,async close(){},async send(payload,msg){sends.push(msg);events.push('source:'+msg);
    if(['INIT','REELSTRIP'].includes(msg)){const text=`MSGID=${msg}&B=1000&AB=1000&TW=0&IFG=0&NFG=0`;return {methodName:'processGameMessage',msgId:msg,requestPayload:payload,responsePayload:text,responseBalance:1000,elapsedMs:0,responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+text.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'};}
    const s=msg==='BET'?v.steps[0]:msg==='FEATURE_START'?v.steps[1]:v.steps[Math.min(2+picks++,3)];return {...s,requestPayload:payload};}}),createCodec:(plan,session)=>nextgenCodec({plan,session,sequence:()=>assert.fail('no credit'),worker:20,batchId:21})}).open();
  try{await assert.rejects(()=>source.captureRound({chooseOption:async options=>options[0]}),unknown?/JOURNAL_ACK_UNKNOWN/:/CARNIVAL_PICK_RESPONSE_REVIEW_REQUIRED/);}finally{await source.close();}
  assert.deepEqual(sends,['INIT','REELSTRIP','BET','FEATURE_START','FEATURE_PICK','FEATURE_PICK','FEATURE_PICK']);assert.equal(closed,1);assert.equal(closure.awaiting,unknown?7:null);assert.equal(closure.performance.normalize.count,0);
  assert.equal(events.filter(e=>e==='fsync').length,7);assert(events.indexOf('intent:BET')<events.indexOf('source:BET'));
 }
});
