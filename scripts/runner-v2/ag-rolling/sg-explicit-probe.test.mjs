import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EXPLICIT_PROBE,explicitProbeRoute,explicitProbeIntent} from './sg-explicit-probe.mjs';
import {nextgenCodec} from './sg-nextgen-codec.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
const registry=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json','utf8')),pid='gdmgcmoffline-probe';
const currentRegistry=structuredClone(registry);
const {carnivalPickContract,carnivalPickContractHash,...previousCarnival}=registry.plans['32474'];registry.plans['32474']=previousCarnival;
const {dragonEndContract,dragonEndContractHash,...previousDragon}=registry.plans['32497'];registry.plans['32497']=previousDragon;
function sample(id='32474',start=false){
 const p=registry.plans[id],cfg=id==='32474'?'1':'0',held=1000-p.betRaw;
 const frame=(msg,reply)=>{const q=msg==='BET'?{...p.requestParams,PID:pid,MSGID:msg}:{GN:p.runtimeSlug,PID:pid,MSGID:msg,CFG:cfg};
  const payload=`MSGID=${msg}&B=${held}&AB=${held}&TW=0&IFG=0&${reply}`;
  return {methodName:'processGameMessage',msgId:msg,requestPayload:Object.entries(q).map(([k,v])=>`${k}=${v}`).join('&'),
   responsePayload:payload,responseBalance:held,elapsedMs:0,responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+payload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'};};
 const raw={fixtureOnly:false,protocol:'nextgen',sourceKey:p.sourceKey,roundFieldsVersion:'sg-round-fields-v1',
  explicitProbeContract:EXPLICIT_PROBE,startBalanceRaw:1000,steps:[frame('BET',`NFG=3&FID=${id==='32474'?'1|0|':'0|'}&CFG=${cfg}&FS_${cfg}=0&NFR_${cfg}=1&CFP_${cfg}=0&FPM_${cfg}=|&FTV_${cfg}=0;1;1;4;|`)]};
 if(start)raw.steps.push(frame('FEATURE_START','NFG=3'));return raw;
}
test('a probe permits only pinned new request continuations, stops at the first unobserved response and never approves settlement',()=>{
 for(const id of ['32474','32497'])assert.deepEqual(explicitProbeRoute(registry.plans[id],sample(id)).request,{MSGID:'FEATURE_START',CFG:id==='32474'?'1':'0'});
 const p=registry.plans['32474'],r=sample('32474',true),route=explicitProbeRoute(p,r);
 assert.equal(route.settlementApproved,false);assert.equal(route.options.length,15);
 for(const position of [0,14])assert.deepEqual(explicitProbeIntent(p,r,`GN=${p.runtimeSlug}&PID=${pid}&MSGID=FEATURE_PICK&CFG=1&FP=1|1|${position}`),{validated:true});
 const extra=structuredClone(r);extra.steps.push(extra.steps[1]);assert.throws(()=>explicitProbeRoute(p,extra),/RESPONSE_REVIEW_REQUIRED/);
 assert.throws(()=>explicitProbeRoute(registry.plans['32497'],sample('32497',true)),/RESPONSE_REVIEW_REQUIRED/);
});
test('probe authority cannot expand source, wager, marker, previous request, ordinal, position, session or end',()=>{
 const p=registry.plans['32474'],r=sample('32474',true);
 for(const changed of [{...p,betRaw:109},{...p,explicitProbeContractHash:'a'.repeat(64)},registry.plans['32550']])assert.throws(()=>explicitProbeRoute(changed,r),/BINDING/);
 const missing=structuredClone(r);delete missing.explicitProbeContract;assert.throws(()=>explicitProbeRoute(p,missing),/PROFILE/);
 for(const suffix of ['FP=0|1|0','FP=1|2|0','FP=1|1|15','FP=1|1|0&EXTRA=1'])assert.throws(()=>explicitProbeIntent(p,r,`GN=${p.runtimeSlug}&PID=${pid}&MSGID=FEATURE_PICK&CFG=1&${suffix}`),/POSITION|INTENT_CHANGED/);
 assert.throws(()=>explicitProbeIntent(p,r,`GN=${p.runtimeSlug}&PID=gdmgcmother&MSGID=FEATURE_PICK&CFG=1&FP=1|1|0`),/INTENT_CHANGED/);
 assert.throws(()=>explicitProbeIntent(p,r,`GN=${p.runtimeSlug}&PID=${pid}&MSGID=FEATURE_END&CFG=1`),/POSITION/);
});
test('actual independent IPC uses the original AG chooseOption callback and refuses full fields after the new pick response',async()=>{
 const p=registry.plans['32474'],r=sample('32474',true),codec=await nextgenCodec({plan:currentRegistry.plans['32474'],session:{pid},sequence:()=>1,worker:0,batchId:1});
 try{
  const next=await codec.next(r,async options=>options[14]);assert.deepEqual(next,{MSGID:'FEATURE_PICK',CFG:'1',FP:'1|1|14'});
  await assert.rejects(()=>codec.next(r,async()=>({pickIndex:16,position:15})),/POSITION/);
  const extra=structuredClone(r);extra.steps.push(extra.steps[1]);
  await assert.rejects(()=>codec.next(extra),/RESPONSE_REVIEW_REQUIRED/);
  await assert.rejects(()=>codec.prepare(extra,{attempt:'offline-probe',sessionHash:'a'.repeat(64)}),/INCOMPLETE_EXPLICIT_PROBE/);
 }finally{codec.close();}
});
test('a new probe is captured through durable intent, response and closure once; an unknown pick ACK cannot resend or normalize it',async()=>{
 for(const unknownAck of [false,true]){
  const p=registry.plans['32474'],raw=sample('32474',true),events=[],sends=[];let closed;
  const journal={async open(){events.push('open');},async intent(q){events.push('intent:'+q.msgId);return {durable:true};},
   async response(q){events.push('response:'+q.msgId);if(unknownAck&&q.msgId==='FEATURE_PICK')throw Error('unknown-ack');return {durable:true};},
   async close(q){closed=q;events.push('closed');},async auditSources(){assert.fail('not a completed task');}};
  const source=await createProtocolSessions({game:{gameId:'32474'},queueId:'offline-probe-test',kind:'canary',index:1,owner:'offline-owner',plan:p,
   guard:async()=>{},journal,spoolFactory:()=>({append(){events.push('fsync');},confirmed(){events.push('confirmed');},close(){}}),
   createSession:async()=>({identity:'a'.repeat(64),pid,async close(){},async send(payload,msg){
    sends.push(msg);events.push('source:'+msg);
    if(msg==='BET'||msg==='FEATURE_START')return {...raw.steps[msg==='BET'?0:1],requestPayload:payload};
    const responsePayload=`MSGID=${msg}&B=1000&AB=1000&TW=0&IFG=0&NFG=0`;
    return {methodName:'processGameMessage',msgId:msg,requestPayload:payload,responsePayload,responseBalance:1000,elapsedMs:0,
     responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'};
   }}),createCodec:async(plan,session)=>{
    const codec=await nextgenCodec({plan:currentRegistry.plans['32474'],session,sequence:()=>assert.fail('no record'),worker:20,batchId:21}),createRaw=codec.createRaw;
    // Replay the stored v1 marker path under a later registered plan.
    codec.createRaw=q=>{const raw=createRaw(q);delete raw.explicitContinuationContract;delete raw.carnivalPickContract;return raw;};return codec;
   },
  }).open();
  try{await assert.rejects(()=>source.captureRound({chooseOption:async options=>options[14]}),unknownAck?/JOURNAL_ACK_UNKNOWN/:/EXPLICIT_PROBE_RESPONSE_REVIEW_REQUIRED/);}
  finally{await source.close();}
  assert.deepEqual(sends,['INIT','REELSTRIP','BET','FEATURE_START','FEATURE_PICK']);
  for(const msg of sends){const intent=events.indexOf('intent:'+msg),sent=events.indexOf('source:'+msg),reply=events.indexOf('response:'+msg);
   assert(intent<sent&&sent<reply);assert(events.slice(sent+1,reply).includes('fsync'));}
  assert.equal(closed.protocolFaults,1);assert.equal(closed.activeRound,true);assert.equal(closed.closed,true);
  assert.equal(closed.awaiting,unknownAck?5:null);assert.equal(closed.performance.normalize.count,0);
 }
});
