import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AUTOMATIC_TERMINAL,terminalNext,terminalFields} from './sg-automatic-terminal.mjs';
import {automaticFreePrefix} from './sg-automatic-free.mjs';
import {nextgenCodec} from './sg-nextgen-codec.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {rebaseResumeManifest} from './sg-resume-manifest.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
const book=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json','utf8')),plan=book.plans[32595];
const policy=JSON.parse(fs.readFileSync('config/ag-rolling-automatic-terminal-contracts.json','utf8')),pid='gdmgcmoffline-terminal';
const encode=p=>Object.entries(p).map(([k,v])=>`${k}=${v}`).join('&');
const xml=p=>'<GDMRESPONSE><OGS_RC>0</OGS_RC><SUCCESS>true</SUCCESS><PAYLOAD>'+p.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>';
function sample(fid='2|',total=7){
 const raw={fixtureOnly:false,protocol:'nextgen',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:10000,
  automaticFreeContract:plan.automaticFreeContract,automaticTerminalContract:AUTOMATIC_TERMINAL,steps:[]};
 for(let i=0;i<=total;i++){
  const msg=i?'FREE_GAME':'BET',win=50+10*i,ab=i===total?9800+win:9800;
  const values=Object.fromEntries(policy.responseKeySets[msg].at(-1).map(k=>[k,'0']));
  Object.assign(values,{MSGID:msg,IFG:String(Number(i>0)),NFG:String(total-i),FID:fid,B:String(9800+win),AB:String(ab),TW:String(win),
   CW:String(i?10:50),FGTW:String(10*i),TFG:String(total),CFGG:String(i),BPR:'10',MUL:'1',FRBAL:'0',SID:'stable-response-session'});
  if(!i)values.FGT=String(total);const payload=encode(values);
  raw.steps.push({methodName:'processGameMessage',msgId:msg,requestPayload:encode({...plan.requestParams,PID:pid,MSGID:msg}),
   responsePayload:payload,responseXml:xml(payload),responseBalance:ab,elapsedMs:0});
 }return raw;
}
function alter(raw,index,key,value){const s=raw.steps[index],p=Object.fromEntries(s.responsePayload.split('&').map(v=>v.split(/=(.*)/s).slice(0,2)));
 if(value===undefined)delete p[key];else p[key]=value;s.responsePayload=encode(p);s.responseXml=xml(s.responsePayload);}
test('reviewed FID2 and all four FID3 counter paths complete, while partials continue without credit',()=>{
 for(const [fid,total] of [['2|',7],...Array.from({length:4},(_,i)=>['3|',9+i])]){
  const raw=sample(fid,total);assert.equal(terminalNext(plan,raw),null);const fields=terminalFields(plan,raw,'a'.repeat(64));
  assert.deepEqual(fields.money,{startBalanceRaw:10000,endBalanceRaw:9850+10*total,totalWinRaw:50+10*total,betRaw:200});
  assert.equal(fields.bonus,1);raw.steps.pop();assert.deepEqual(terminalNext(plan,raw),{MSGID:'FREE_GAME'});
  assert.throws(()=>terminalFields(plan,raw,'a'.repeat(64)),/INCOMPLETE/);
 }
});
test('unseen FIDs, initial counts, changed counters, retriggers and explicit feature keys are rejected',()=>{
 for(const raw of [sample('2|',8),sample('3|',8),sample('3|',13),sample('4|',7)])assert.throws(()=>terminalNext(plan,raw));
 for(const [i,key,value] of [[1,'FID','3|'],[1,'NFG','7'],[1,'TFG','8'],[1,'CFGG','0'],[1,'FGT','7'],[0,'FGT','8'],[1,'FS_2','1'],[1,'CFG','2'],[1,'ABPM','0']]){
  const raw=sample();alter(raw,i,key,value);assert.throws(()=>terminalNext(plan,raw));
 }
});
test('per-frame cash, cumulative awards, observer, request identity and business XML stay strict',()=>{
 for(const [key,value] of [['B','9861'],['AB','9860'],['TW','59'],['CW','11'],['FGTW','11'],['SID','changed'],['BPR','11'],['FRBAL','1']]){
  const raw=sample();alter(raw,1,key,value);assert.throws(()=>terminalNext(plan,raw));
 }
 for(const damage of [r=>r.steps[1].responseBalance++,r=>r.steps[1].requestPayload=r.steps[1].requestPayload.replace(pid,'gdmgcmother'),
  r=>r.steps[1].requestPayload+='&REC=1',r=>r.steps[1].responseXml=r.steps[1].responseXml.replace('<OGS_RC>0','<OGS_RC>1'),
  r=>r.steps[1].responseXml=r.steps[1].responseXml.replace('</GDMRESPONSE>','<ERROR>rejected</ERROR></GDMRESPONSE>'),
  r=>r.steps[1].responseXml=r.steps[1].responseXml.replace('<SUCCESS>true','<SUCCESS>false'),r=>r.steps[1].elapsedMs=300001]){
  const raw=sample();damage(raw);assert.throws(()=>terminalNext(plan,raw));
 }
});
test('old v1 terminals still stop; ordinary and FID1 behavior delegates to the unchanged v1 validator',()=>{
 const old=sample();delete old.automaticTerminalContract;assert.throws(()=>automaticFreePrefix(plan,old),/UNREVIEWED_AUTOMATIC_TERMINAL/);
 for(const fid of ['0|','1|']){const raw=sample(fid,fid==='0|'?0:7);
  const before=automaticFreePrefix(plan,raw),after=terminalFields(plan,raw,'a'.repeat(64));assert.equal(after.money.totalWinRaw,before.win);assert.equal(after.money.endBalanceRaw,before.balance);
 }
 for(const damage of [{betRaw:201},{runtimeGameId:33027},{gameId:32500},{automaticTerminalContractHash:'f'.repeat(64)}])assert.throws(()=>terminalNext({...plan,...damage},sample()),/BINDING/);
 const raw=sample();raw.automaticTerminalContract='unknown';assert.throws(()=>terminalNext(plan,raw),/PROFILE/);
});
test('actual codec and independent IPC agree on every next request and settled fields',async()=>{
 for(const [fid,total] of [['2|',7],['3|',12]]){
  const raw=sample(fid,total),codec=await nextgenCodec({plan,session:{pid},sequence:()=>1,worker:0,batchId:1});
  try{const value=codec.createRaw({balance:10000});for(const step of raw.steps){assert.equal((await codec.next(value)).MSGID,step.msgId);value.steps.push(step);}
   assert.equal(await codec.next(value),null);const out=await codec.prepare(value,{attempt:'offline-terminal',sessionHash:'a'.repeat(64)});
   assert.deepEqual(out.record.normalized,terminalFields(plan,raw,out.record.normalized.typeMappingHash));
  }finally{codec.close();}
 }
});
test('resume forwards only the exact evidence-bound v1 and original unmarked chain without mutating history',()=>{
 const {automaticTerminalContract,automaticTerminalContractHash,...oldPlan}=plan;
 const {planHash,automaticTerminalEvidence:e,...fields}=book.proofs[32595],oldProof={...structuredClone(fields),planHash:e.previousPlanHash};
 const f={previous:{manifest:[{gameId:'32595',planHash:queueHash(oldPlan),adapterProofHash:queueHash(oldProof),campaignId:'preserved'}]},previousPlans:{plans:{32595:structuredClone(oldPlan)},proofs:{32595:oldProof}},plans:{plans:{32595:plan},proofs:{32595:book.proofs[32595]}}};
 const before=queueHash(f);assert.equal(rebaseResumeManifest(f)[0].planHash,queueHash(plan));assert.equal(queueHash(f),before);
 const {automaticFreeContract,automaticFreeContractHash,...originalPlan}=oldPlan;
 const {automaticFreeRepair,previousPlanHash,...originalFields}=oldProof;const originalProof={...originalFields,planHash:queueHash(originalPlan)};
 const original={...f,previous:{manifest:[{...f.previous.manifest[0],planHash:queueHash(originalPlan),adapterProofHash:queueHash(originalProof)}]},previousPlans:{plans:{32595:originalPlan},proofs:{32595:originalProof}}};
 assert.equal(rebaseResumeManifest(original)[0].adapterProofHash,queueHash(book.proofs[32595]));
 for(const damage of [v=>v.plans.proofs[32595].automaticTerminalEvidence.previousProofHash='f'.repeat(64),v=>v.plans.proofs[32595].automaticTerminalEvidence.ownClosedNaturalRounds=103,
  v=>v.plans.proofs[32595].automaticTerminalEvidence.wiringEvidence.evidenceHash='f'.repeat(64),v=>v.plans.proofs[32595].acceptedRawHashes=[],v=>v.plans.plans[32595].requestParams.BPR='11',
  v=>v.plans.proofs[32595].automaticTerminalEvidence.nativeEvidenceHash='f'.repeat(64),
  v=>{const wire=v.plans.proofs[32595].automaticTerminalEvidence.wiringEvidence;wire.terminalFidCounts={'2|':90,'3|':14};wire.evidenceHash=queueHash(Object.fromEntries(Object.entries(wire).filter(([k])=>k!=='evidenceHash')));},
  v=>{const wire=v.plans.proofs[32595].automaticTerminalEvidence.wiringEvidence;wire.independentEveryFrameFinanceAndRequests=false;wire.evidenceHash=queueHash(Object.fromEntries(Object.entries(wire).filter(([k])=>k!=='evidenceHash')));}]){
  const bad=structuredClone(f);damage(bad);assert.throws(()=>rebaseResumeManifest(bad),/REPAIR_UNREVIEWED/);
 }
 assert.throws(()=>rebaseResumeManifest({...f,completedGameIds:['32595']}),/COMPLETED_ADAPTER_CHANGED/);
});
test('an unknown final FREE response ACK is sent once, preserved and never normalized or retried',async()=>{
 const raw=sample(),sends=[];let closing=0,closed;
 const source=await createProtocolSessions({game:{gameId:'32595'},queueId:'offline-terminal',kind:'canary',index:1,owner:'offline',plan,guard:async()=>{},
  journal:{async open(){},async intent(){return {durable:true};},async response(){if(sends.length===10)throw Error('unknown-ack');return {durable:true};},async close(q){closing++;closed=q;},async auditSources(){assert.fail('unknown');}},
  spoolFactory:()=>({append(){},confirmed(){},close(){}}),createSession:async()=>({identity:'a'.repeat(64),pid,async close(){},async send(payload,msg){
   sends.push(msg);if(['INIT','REELSTRIP'].includes(msg)){const p=`MSGID=${msg}&B=10000&AB=10000&TW=0&IFG=0&NFG=0`;return {methodName:'processGameMessage',msgId:msg,requestPayload:payload,responsePayload:p,responseXml:xml(p),responseBalance:10000,elapsedMs:0};}
   return {...raw.steps[sends.length-3],requestPayload:payload};}}),
  createCodec:(plan,session)=>nextgenCodec({plan,session,sequence:()=>assert.fail('no record'),worker:20,batchId:21})}).open();
 try{await assert.rejects(()=>source.captureRound({}),/JOURNAL_ACK_UNKNOWN/);}finally{await source.close();}
 assert.deepEqual(sends,['INIT','REELSTRIP','BET',...Array(7).fill('FREE_GAME')]);assert.equal(closing,1);assert.equal(closed.awaiting,10);assert.equal(closed.performance.normalize.count,0);
});
