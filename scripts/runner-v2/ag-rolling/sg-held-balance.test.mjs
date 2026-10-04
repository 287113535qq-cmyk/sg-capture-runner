import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {heldBalanceFields,BALANCE_CONTRACT} from './sg-held-balance.mjs';
import {nextgenCodec} from './sg-nextgen-codec.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json','utf8')).plans['32500'];
const pid='gdmgcmoffline-held',hash='a'.repeat(64);
function step(msg,win,remaining,requestPayload){const payload=`MSGID=${msg}&IFG=${Number(msg==='FREE_GAME')}&NFG=${remaining}&FID=0|&B=${900+win}&AB=900&TW=${win}`;
 return {methodName:'processGameMessage',msgId:msg,requestPayload:requestPayload??Object.entries({...plan.requestParams,PID:pid,MSGID:msg}).map(([k,v])=>k+'='+v).join('&'),
  responsePayload:payload,responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+payload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>',responseBalance:900,elapsedMs:0};}
const raw=()=>({fixtureOnly:false,protocol:'nextgen',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',
 balanceContract:BALANCE_CONTRACT,startBalanceRaw:1000,steps:[step('BET',0,2),step('FREE_GAME',20,1),step('FREE_GAME',50,0)]});
const change=(r,i,old,value)=>{const s=r.steps[i];s.responsePayload=s.responsePayload.replace(old,value);s.responseXml='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+s.responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>';return r;};
test('held award fields reconcile both balances and cumulative wins on every frame',()=>{
 const result=heldBalanceFields(plan,raw(),hash);assert.equal(result.bonus,1);assert.equal(result.mul,.5);
 assert.deepEqual(result.money,{startBalanceRaw:1000,endBalanceRaw:950,totalWinRaw:50,betRaw:100});
 for(const r of [change(raw(),1,'AB=900','AB=901'),change(raw(),1,'B=920','B=921'),change(raw(),2,'B=950&AB=900&TW=50','B=910&AB=900&TW=10')])assert.throws(()=>heldBalanceFields(plan,r,hash),/RELATION/);
 const r=raw();r.steps[1].responseBalance++;assert.throws(()=>heldBalanceFields(plan,r,hash),/OBSERVER/);
});
test('held award adapter does not relax feature closure, source/session scope or XML evidence',()=>{
 const partial=raw();partial.steps.pop();assert.throws(()=>heldBalanceFields(plan,partial,hash),/INCOMPLETE/);
 for(const changed of [{betRaw:101},{sourceKey:'other'},{balanceContractHash:'f'.repeat(64)}])assert.throws(()=>heldBalanceFields({...plan,...changed},raw(),hash),/BINDING/);
 for(const [from,to] of [['FID=0|','FID=1|'],['FID=0|','FID=0|&NFR_0=1'],['FID=0|','FID=0|&CFG=0']])assert.throws(()=>heldBalanceFields(plan,change(raw(),0,from,to),hash),/FEATURE/);
 const r=raw();r.steps[1].requestPayload=r.steps[1].requestPayload.replace(pid,'gdmgcmother');assert.throws(()=>heldBalanceFields(plan,r,hash),/SESSION/);
 const mismatch=raw();mismatch.steps[0].responseXml=mismatch.steps[0].responseXml.replace('TW=0','TW=1');assert.throws(()=>heldBalanceFields(plan,mismatch,hash),/XML_EVIDENCE/);
});
test('real SG codec and independent Python create and verify a marked paid-round record without source I/O',async()=>{
 const codec=await nextgenCodec({plan,session:{pid},sequence:()=>1,worker:0,batchId:1});
 try{
  const exchange=async(msg,payload)=>{const body=`MSGID=${msg}&B=1000&AB=1000`;return {methodName:'processGameMessage',msgId:msg,requestPayload:payload,
   responsePayload:body,responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+body.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>',responseBalance:1000,elapsedMs:0};};
  assert.equal(await codec.bootstrap(exchange),1000);const r=codec.createRaw({balance:1000});assert.equal(r.balanceContract,BALANCE_CONTRACT);
  const next=await codec.next(r);assert.equal(next.MSGID,'BET');r.steps.push(step('BET',50,0,codec.payload(next)));
  assert.equal(await codec.next(r),null);const result=await codec.prepare(r,{attempt:'offline-held-replay',sessionHash:hash});
  assert.equal(result.independentlyVerified,true);assert.equal(result.endBalanceRaw,950);assert.equal(result.record.bet,1);
  assert.equal(result.record.normalized.money.totalWinRaw,50);assert.equal(result.record.raw.balanceContract,BALANCE_CONTRACT);
 }finally{codec.close();}
});
