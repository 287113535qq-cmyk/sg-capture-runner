import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ZERO_ABPM,zeroAbpmNext,zeroAbpmFields} from './sg-zero-abpm.mjs';
import {nextgenCodec} from './sg-nextgen-codec.mjs';
const reg=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json','utf8')),pid='gdmgcmoffline-zero-abpm',hash='a'.repeat(64);
function sample(plan){
 const end=10000-plan.betRaw+25,payload=`MSGID=BET&IFG=0&ABPM=0&B=${end}&AB=${end}&TW=25`;
 return {fixtureOnly:false,protocol:'nextgen',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',
  zeroAbpmContract:ZERO_ABPM,startBalanceRaw:10000,steps:[{methodName:'processGameMessage',msgId:'BET',
   requestPayload:Object.entries({...plan.requestParams,PID:pid,MSGID:'BET'}).map(([k,v])=>k+'='+v).join('&'),
   responsePayload:payload,responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+payload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>',
   responseBalance:end,elapsedMs:0}]};
}
function change(raw,from,to){const s=raw.steps[0];s.responsePayload=s.responsePayload.replace(from,to);
 s.responseXml='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+s.responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>';return raw;}
test('a reviewed zero response flag accepts only each fixed ordinary wager, without granting feature or free routes',()=>{
 for(const key of ['32588','32666']){
  const p=reg.plans[key],r=sample(p);
  assert.deepEqual(zeroAbpmNext(p,{...r,steps:[]}),{MSGID:'BET'});assert.equal(zeroAbpmNext(p,r),null);
  assert.equal(zeroAbpmFields(p,r,hash).money.betRaw,p.betRaw);
  for(const [from,to] of [['ABPM=0','ABPM=1'],['ABPM=0','NFG=1&ABPM=0'],['ABPM=0','FID=1|&ABPM=0'],
   ['ABPM=0','FS_1=0&ABPM=0'],['ABPM=0','NFR_1=1&ABPM=0'],['ABPM=0','CFG=1&ABPM=0']])
   assert.throws(()=>zeroAbpmNext(p,change(sample(p),from,to)),/UNKNOWN_TRIAL_FEATURE/);
  const free=sample(p);free.steps.push(free.steps[0]);assert.throws(()=>zeroAbpmNext(p,free),/BASE_ONLY/);
 }
});
test('zero flag records retain source, contract, cash, XML, response observer and exact request protections',()=>{
 const p=reg.plans['32588'],r=sample(p),end=r.steps[0].responseBalance;
 assert.throws(()=>zeroAbpmNext({...p,betRaw:p.betRaw+1},r),/BINDING/);
 assert.throws(()=>zeroAbpmNext(reg.plans['32666'],r),/PROFILE/);
 assert.throws(()=>zeroAbpmNext(p,{...r,zeroAbpmContract:undefined}),/PROFILE/);
 for(const [from,to] of [[`B=${end}`,`B=${end+1}`],[`AB=${end}`,`AB=${end+1}`],['TW=25','TW=24']])
  assert.throws(()=>zeroAbpmNext(p,change(sample(p),from,to)),/MONEY/);
 const observer=sample(p);observer.steps[0].responseBalance++;assert.throws(()=>zeroAbpmNext(p,observer),/MONEY/);
 const xml=sample(p);xml.steps[0].responseXml=xml.steps[0].responseXml.replace('TW=25','TW=24');assert.throws(()=>zeroAbpmNext(p,xml),/XML/);
 const request=sample(p);request.steps[0].requestPayload+='&REC=1';assert.throws(()=>zeroAbpmNext(p,request),/REQUEST/);
 assert.throws(()=>zeroAbpmFields(p,{...r,steps:[]},hash),/INCOMPLETE/);
});
test('actual SG codec and independent Python IPC verify both fixed base records and reject mutated response flags',async()=>{
 for(const key of ['32588','32666']){
  const plan=reg.plans[key],codec=await nextgenCodec({plan,session:{pid},sequence:()=>1,worker:0,batchId:1});
  try{const r=codec.createRaw({balance:10000});assert.equal(r.zeroAbpmContract,ZERO_ABPM);
   assert.equal((await codec.next(r)).MSGID,'BET');r.steps=sample(plan).steps;assert.equal(await codec.next(r),null);
   const verified=await codec.prepare(r,{attempt:'offline-zero-test',sessionHash:hash});assert.equal(verified.independentlyVerified,true);
   assert.equal(verified.record.normalized.bonus,0);assert.equal(verified.endBalanceRaw,r.steps[0].responseBalance);
   await assert.rejects(codec.prepare(change(sample(plan),'ABPM=0','ABPM=15'),{attempt:'offline-zero-reject',sessionHash:hash}),/UNKNOWN_TRIAL_FEATURE/);
  }finally{codec.close();}
 }
});
