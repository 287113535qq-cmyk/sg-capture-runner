import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {automaticFreeNext,automaticFreeFields,AUTOMATIC_FREE_CONTRACT} from './sg-automatic-free.mjs';
import {nextgenCodec} from './sg-nextgen-codec.mjs';
const registry=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json','utf8')),plan=registry.plans['32500'];
const pid='gdmgcmoffline-automatic',hash='a'.repeat(64);
function sample(p=plan){
 const steps=[['BET',2,0],['FREE_GAME',1,20],['FREE_GAME',0,50]].map(([msg,nfg,win],i)=>{
  const held=1000-p.betRaw,ab=i===2?held+win:held;
  const payload=`MSGID=${msg}&IFG=${Number(i>0)}&NFG=${nfg}&FID=${p.gameId===32486?(i===1?'1|0|':'0|'):'1|'}&B=${held+win}&AB=${ab}&TW=${win}`;
  return {methodName:'processGameMessage',msgId:msg,requestPayload:Object.entries({...p.requestParams,PID:pid,MSGID:msg}).map(([k,v])=>k+'='+v).join('&'),
   responsePayload:payload,responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+payload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>',responseBalance:ab,elapsedMs:0};
 });
 return {fixtureOnly:false,protocol:'nextgen',sourceKey:p.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,
  automaticFreeContract:AUTOMATIC_FREE_CONTRACT,...(p.balanceContract?{balanceContract:p.balanceContract}:{}),steps};
}
function change(r,i,old,value){const s=r.steps[i];s.responsePayload=s.responsePayload.replace(old,value);
 s.responseXml='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+s.responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>';return r;}
test('reviewed automatic feature IDs continue only FREE_GAME and settle exact original paid cost at zero remaining',()=>{
 for(const p of ['32486','32500','32501'].map(id=>registry.plans[id])){
  const r=sample(p);assert.deepEqual(automaticFreeNext(p,{...r,steps:[]}),{MSGID:'BET'});
  for(const n of [1,2])assert.deepEqual(automaticFreeNext(p,{...r,steps:r.steps.slice(0,n)}),{MSGID:'FREE_GAME'});
  assert.equal(automaticFreeNext(p,r),null);const f=automaticFreeFields(p,r,hash);
  assert.equal(f.bonus,1);assert.equal(f.money.betRaw,p.betRaw);assert.equal(f.money.endBalanceRaw,1000-p.betRaw+50);
 }
});
test('automatic review never authorizes explicit choice, unknown feature IDs, unfinished rounds or additional paid requests',()=>{
 for(const [from,to] of [['FID=1|','FID=2|'],['FID=1|','FID=1|&FS_1=0'],['FID=1|','FID=1|&NFR_1=1'],
  ['FID=1|','FID=1|&CFG=1'],['FID=1|','FID=1|&ABPM=1'],['FID=1|','FID=1|&GSD=#lives~1']])
  assert.throws(()=>automaticFreeNext(plan,change(sample(),0,from,to)),/FEATURE/);
 const p=registry.plans['32486'];assert.throws(()=>automaticFreeNext(p,change(sample(p),2,'FID=0|','FID=1|0|')),/FEATURE/);
 const partial=sample();partial.steps.pop();assert.throws(()=>automaticFreeFields(plan,partial,hash),/INCOMPLETE/);
 const extra=change(sample(),2,'AB=950','AB=900');extra.steps[2].responseBalance=900;
 extra.steps.push(extra.steps[0]);assert.throws(()=>automaticFreeNext(plan,extra),/FRAME_SCOPE/);
});
test('each automatic frame keeps exact balances, observer, XML, source, request and session bindings',()=>{
 for(const r of [change(sample(),1,'B=920','B=921'),change(sample(),1,'AB=900','AB=920'),
  change(sample(),2,'TW=50','TW=49')])assert.throws(()=>automaticFreeFields(plan,r,hash),/MONEY/);
 const observer=sample();observer.steps[1].responseBalance++;assert.throws(()=>automaticFreeNext(plan,observer),/OBSERVER/);
 const xml=sample();xml.steps[0].responseXml=xml.steps[0].responseXml.replace('TW=0','TW=1');assert.throws(()=>automaticFreeNext(plan,xml),/XML_EVIDENCE/);
 const session=sample();session.steps[1].requestPayload=session.steps[1].requestPayload.replace(pid,'gdmgcmother');assert.throws(()=>automaticFreeNext(plan,session),/SESSION/);
 const mode=sample();mode.steps[1].requestPayload+='&REC=1';assert.throws(()=>automaticFreeNext(plan,mode),/REQUEST_MODE/);
 assert.throws(()=>automaticFreeNext({...plan,betRaw:101},sample()),/BINDING/);
 assert.throws(()=>automaticFreeNext(plan,{...sample(),sourceKey:'other'}),/PROFILE/);
});
test('real SG codec and Python independently route, normalize and verify an automatic feature terminal record',async()=>{
 const codec=await nextgenCodec({plan,session:{pid},sequence:()=>1,worker:0,batchId:1});
 try{
  const r=codec.createRaw({balance:1000});assert.equal(r.automaticFreeContract,AUTOMATIC_FREE_CONTRACT);
  for(const s of sample().steps){const next=await codec.next(r);assert.equal(next.MSGID,s.msgId);assert.equal(codec.payload(next),s.requestPayload);r.steps.push(s);}
  assert.equal(await codec.next(r),null);const result=await codec.prepare(r,{attempt:'offline-automatic-replay',sessionHash:hash});
  assert.equal(result.independentlyVerified,true);assert.equal(result.record.normalized.bonus,1);
  assert.equal(result.record.normalized.money.betRaw,100);assert.equal(result.endBalanceRaw,950);
 }finally{codec.close();}
});

function longSample(p,n=101){
 const r=sample(p),held=1000-p.betRaw;
 r.steps=Array.from({length:n},(_,i)=>{
  const msg=i?'FREE_GAME':'BET',remaining=n-1-i,win=i,ab=remaining?held:held+win;
  const responsePayload=`MSGID=${msg}&IFG=${Number(i>0)}&NFG=${remaining}&FID=0|&B=${held+win}&AB=${ab}&TW=${win}`;
  return {methodName:'processGameMessage',msgId:msg,requestPayload:Object.entries({...p.requestParams,PID:pid,MSGID:msg}).map(([k,v])=>k+'='+v).join('&'),
   responsePayload,responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>',
   responseBalance:ab,elapsedMs:0};
 });return r;
}
test('reviewed Gold Fish continuations drain a round beyond 100 frames, while incomplete, unmarked, oversized and cross-source rounds fail',()=>{
 for(const p of ['32529','32530'].map(id=>registry.plans[id])){
  const r=longSample(p);assert.deepEqual(automaticFreeNext(p,{...r,steps:r.steps.slice(0,100)}),{MSGID:'FREE_GAME'});
  assert.equal(automaticFreeNext(p,r),null);assert.equal(automaticFreeFields(p,r,hash).money.betRaw,p.betRaw);
  assert.throws(()=>automaticFreeFields(p,{...r,steps:r.steps.slice(0,100)},hash),/INCOMPLETE/);
  assert.throws(()=>automaticFreeNext({...p,maxSteps:100},r),/PLAN_BINDING/);
  assert.throws(()=>automaticFreeNext(p,{...r,automaticFreeContract:undefined}),/PROFILE_REQUIRED/);
  assert.throws(()=>automaticFreeNext(p,{...r,steps:Array(1027).fill(r.steps[0])}),/INVALID_ROUND_STEPS/);
  assert.throws(()=>automaticFreeNext(plan,{...sample(),steps:Array(101).fill(sample().steps[0])}),/INVALID_ROUND_STEPS/);
 }
});
test('the real Python record path independently verifies a synthetic 101-frame reviewed continuation without widening other games',async()=>{
 const p=registry.plans['32530'],codec=await nextgenCodec({plan:p,session:{pid},sequence:()=>1,worker:0,batchId:1});
 try{const r=longSample(p);assert.equal(await codec.next(r),null);
  const prepared=await codec.prepare(r,{attempt:'offline-long-synthetic',sessionHash:hash});
  assert.equal(prepared.independentlyVerified,true);assert.equal(prepared.record.normalized.bonus,1);
  assert.equal(prepared.endBalanceRaw,1000);assert.equal(prepared.record.raw.steps.length,101);
 }finally{codec.close();}
});
test('new automatic variants retain fixed source, exact free request and conservative choice/unknown-feature rejection',()=>{
 for(const [id,fid] of [['32545','2|'],['32595','1|']]){
  const p=registry.plans[id],r=sample(p);
  for(const s of r.steps){s.responsePayload=s.responsePayload.replace('FID=1|',`FID=${fid}`);
   s.responseXml='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+s.responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>';}
  assert.equal(automaticFreeFields(p,r,hash).bonus,1);
  assert.throws(()=>automaticFreeNext(p,change(structuredClone(r),0,`FID=${fid}`,'FID=4|')),/FEATURE/);
  assert.throws(()=>automaticFreeNext(p,change(structuredClone(r),0,`FID=${fid}`,`FID=${fid}&CFG=1`)),/FEATURE/);
 }
});
