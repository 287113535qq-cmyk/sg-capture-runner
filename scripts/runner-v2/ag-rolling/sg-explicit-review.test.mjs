import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reviewExplicitPrefix,reviewedPickRequest} from './sg-explicit-review.mjs';
import {nextgenCodec} from './sg-nextgen-codec.mjs';
const registry=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json','utf8')),pid='gdmgcmoffline-explicit';
const currentRegistry=structuredClone(registry);
const {carnivalPickContract,carnivalPickContractHash,...previousCarnival}=registry.plans['32474'];registry.plans['32474']=previousCarnival;
function frame(p,msg,reply){
 const q=msg==='BET'?{...p.requestParams,PID:pid,MSGID:msg}:{GN:p.runtimeSlug,PID:pid,MSGID:msg,CFG:p.gameId===32474?'1':'0'};
 const responsePayload='MSGID='+msg+'&B='+(1000-p.betRaw)+'&AB='+(1000-p.betRaw)+'&TW=0&IFG=0&'+reply;
 return {methodName:'processGameMessage',msgId:msg,requestPayload:Object.entries(q).map(([k,v])=>k+'='+v).join('&'),
  responsePayload,responseBalance:1000-p.betRaw,elapsedMs:0,
  responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'};
}
function sample(id='32474',start=false){
 const p=registry.plans[id],cfg=id==='32474'?'1':'0',fid=id==='32474'?'1|0|':'0|';
 const raw={fixtureOnly:false,protocol:'nextgen',sourceKey:p.sourceKey,roundFieldsVersion:'sg-round-fields-v1',
  startBalanceRaw:1000,steps:[frame(p,'BET',`NFG=3&FID=${fid}&CFG=${cfg}&FS_${cfg}=0&NFR_${cfg}=1&CFP_${cfg}=0&FPM_${cfg}=|&FTV_${cfg}=0;1;1;4;|`)]};
 if(start)raw.steps.push(frame(p,'FEATURE_START','NFG=3'));return raw;
}
function change(raw,i,from,to){const s=raw.steps[i];s.responsePayload=s.responsePayload.replace(from,to);
 s.responseXml='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+s.responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>';return raw;}
test('explicit review keeps the game-specific start and pick constructor, bounded source positions and no settlement approval',()=>{
 for(const id of ['32474','32497']){
  const p=registry.plans[id],r=reviewExplicitPrefix(p,sample(id));
  assert.equal(r.sourceAllowance,0);assert.equal(r.diagnosticOnly,true);assert.equal(r.settlementApproved,false);
  assert.deepEqual(r.candidateRequest,{MSGID:'FEATURE_START',CFG:id==='32474'?'1':'0'});
 }
 const p=registry.plans['32474'],r=reviewExplicitPrefix(p,sample('32474',true));
 assert.deepEqual(r.candidateRequest,{MSGID:'FEATURE_PICK',CFG:'1',FP:'1|1|0'});
 assert.deepEqual(r.options.map(o=>o.position),Array.from({length:15},(_,i)=>i));
 assert.deepEqual(reviewedPickRequest(p,15,14),{MSGID:'FEATURE_PICK',CFG:'1',FP:'1|15|14'});
 assert.deepEqual(reviewedPickRequest(registry.plans['32497'],1),{MSGID:'FEATURE_PICK',CFG:'0',FP:'0|1|1'});
 for(const [ordinal,position] of [[0,0],[16,0],[1,-1],[1,15],[1,0.5]])
  assert.throws(()=>reviewedPickRequest(p,ordinal,position),/EXPLICIT_PICK/);
 assert.throws(()=>reviewedPickRequest(registry.plans['32497'],2),/DRAGON_PICK_SCOPE/);
});
test('unobserved start, picks, terminal responses and unsupported trigger states cannot become approvals',()=>{
 const p=registry.plans['32474'];
 assert.throws(()=>reviewExplicitPrefix(registry.plans['32497'],sample('32497',true)),/UNREVIEWED/);
 const extra=sample('32474',true);extra.steps.push(extra.steps[1]);assert.throws(()=>reviewExplicitPrefix(p,extra),/UNREVIEWED/);
 for(const raw of [change(sample(),0,'FS_1=0','FS_1=1'),change(sample(),0,'NFR_1=1','NFR_1=2'),
  change(sample(),0,'CFG=1','CFG=2'),change(sample(),0,'FTV_1=0;1;1;4','FTV_1=0;2;1;4'),
  change(sample('32474',true),1,'NFG=3','NFG=0')])assert.throws(()=>reviewExplicitPrefix(p,raw),/EXPLICIT/);
});
test('request reviews reject altered wager, source, session, balances, XML and observed credit',()=>{
 const p=registry.plans['32474'];assert.throws(()=>reviewExplicitPrefix({...p,betRaw:109},sample()),/PLAN_BINDING/);
 const r=sample('32474',true);r.steps[1].requestPayload=r.steps[1].requestPayload.replace(pid,'gdmgcmother');
 assert.throws(()=>reviewExplicitPrefix(p,r),/SESSION/);
 assert.throws(()=>reviewExplicitPrefix(p,change(sample(),0,'B=892','B=893')),/MONEY/);
 const observer=sample();observer.steps[0].responseBalance++;assert.throws(()=>reviewExplicitPrefix(p,observer),/OBSERVER/);
 const xml=sample();xml.steps[0].responseXml=xml.steps[0].responseXml.replace('TW=0','TW=1');
 assert.throws(()=>reviewExplicitPrefix(p,xml),/XML_EVIDENCE/);
 const q=sample();q.steps[0].requestPayload+='&REC=1';assert.throws(()=>reviewExplicitPrefix(p,q),/REQUEST/);
});
test('real independent IPC review cannot authorize the existing source next or record path',async()=>{
 const p=registry.plans['32474'],codec=await nextgenCodec({plan:currentRegistry.plans['32474'],session:{pid},sequence:()=>1,worker:0,batchId:1});
 try{
  const raw=sample('32474',true),review=await codec.reviewExplicit(raw);
  assert.equal(review.settlementApproved,false);assert.equal(review.sourceAllowance,0);
  await assert.rejects(()=>codec.next(raw),/FEATURE|REQUEST_MODE/);
  await assert.rejects(()=>codec.prepare(raw,{attempt:'offline-explicit-review',sessionHash:'a'.repeat(64)}),/FEATURE|REQUEST_MODE/);
 }finally{codec.close();}
});
