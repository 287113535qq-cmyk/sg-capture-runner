import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
import {createSourceJournal} from './sg-source-journal.mjs';
import {nextgenSession} from './sg-nextgen-source.mjs';
import {nextgenCodec} from './sg-nextgen-codec.mjs';
import {createTaskRuntime} from './sg-task-runtime.mjs';
import {runCaptureTask} from './sg-capture-adapter.mjs';
import {prepareTasks,connectTaskStore} from './sg-task-store.mjs';
const identity={queueId:'queue',game:{gameId:'32630',dbName:'sg_hens',campaignId:'hens-queue',baseline:100},kind:'canary',index:1,owner:'run:1:canary:1'};
const sessionHash='a'.repeat(64);
function spool(){let pending=false,closed=false;return {
 append(){assert(!pending&&!closed);pending=true;},confirmed(){assert(pending);pending=false;},
 close(){closed=true;},status:()=>({pending,closed})};}
function journalFixture(){const events=[];return {events,
 open:async()=>events.push('open'),intent:async()=>{events.push('intent');return {durable:true};},
 response:async()=>{events.push('response');return {durable:true};},close:async()=>events.push('close'),
 auditSources:async r=>({queueId:r.queueId,gameId:r.gameId,taskId:r.kind+':'+r.index,owner:r.owner,
  pending:r.sessions.filter(s=>s.awaiting||s.activeRound).length,unknownRequests:r.sessions.reduce((a,s)=>a+s.unknownRequests,0),
  protocolFaults:r.sessions.reduce((a,s)=>a+s.protocolFaults,0),sourcesClosed:r.sessions.every(s=>s.closed),activeLeases:0})};}
const fakeCodec=()=>({bootstrap:async()=>10000,payload:n=>'MSGID='+n.MSGID,
 createRaw:()=>({fixtureOnly:false,steps:[]}),next:async raw=>raw.steps.length<2?{MSGID:raw.steps.length?'FREE_GAME':'BET'}:null,
 prepare:async()=>({independentlyVerified:true,endBalanceRaw:10000,record:{fixtureOnly:false,buy:0,gameId:32630,bet:1,mul:1,bonus:1}})});
test('SG natural continuation waits for durable intent and response ACK, and closes before source audit',async()=>{
 const j=journalFixture(),s=spool();let calls=0,resume;
 const normalResponse=j.response;j.response=async r=>{await normalResponse(r);if(calls===1)await new Promise(resolve=>resume=resolve);return {durable:true};};
 const p=createProtocolSessions({...identity,plan:{maxSteps:100},journal:j,guard:async()=>{},spoolFactory:()=>s,
  createCodec:async()=>fakeCodec(),createSession:async()=>({identity:sessionHash,close(){},async send(requestPayload,msgId){
   calls++;assert.equal(j.events.at(-1),'intent');return {msgId,requestPayload};}})});
 const session=await p.open(),pending=session.captureRound({});
 while(!resume)await new Promise(r=>setTimeout(r,1));assert.equal(calls,1);assert(s.status().pending);
 resume();const round=await pending;assert(round.data.complete);assert.equal(calls,2);assert(!s.status().pending);
 await session.close();assert.deepEqual(j.events,['open','intent','response','intent','response','close']);
 const audit=await p.inspectSource();assert.equal(audit.pending,0);assert(audit.sourcesClosed);
});
test('unknown source outcome remains an unresolved intent and cannot send a second paid request',async()=>{
 const j=journalFixture();let calls=0;
 const p=createProtocolSessions({...identity,plan:{maxSteps:100},journal:j,guard:async()=>{},spoolFactory:spool,
  createCodec:async()=>fakeCodec(),createSession:async()=>({identity:sessionHash,close(){},async send(){calls++;throw Error('network');}})});
 const s=await p.open();await assert.rejects(()=>s.captureRound({}),e=>e.code==='SOURCE_NETWORK_OUTCOME_UNKNOWN');
 await assert.rejects(()=>s.captureRound({}),/REENTRY/);await s.close();
 const audit=await p.inspectSource();assert.equal(calls,1);assert.equal(audit.unknownRequests,1);assert(audit.pending>0);
});
test('response journal failure keeps fsynced evidence and blocks all continuation',async()=>{
 const j=journalFixture(),local=spool();let calls=0;j.response=async()=>{throw Error('lost ACK');};
 const p=createProtocolSessions({...identity,plan:{maxSteps:100},journal:j,guard:async()=>{},spoolFactory:()=>local,
  createCodec:async()=>fakeCodec(),createSession:async()=>({identity:sessionHash,close(){},async send(requestPayload,msgId){calls++;return {requestPayload,msgId};}})});
 const s=await p.open();await assert.rejects(()=>s.captureRound({}),e=>e.code==='JOURNAL_ACK_UNKNOWN');
 assert.equal(calls,1);assert(local.status().pending);await s.close();assert((await p.inspectSource()).pending>0);
});
test('codec initialization failure releases its unopened source session without a source request',async()=>{
 let closed=0;const p=createProtocolSessions({...identity,plan:{maxSteps:100},journal:journalFixture(),guard:async()=>{},spoolFactory:spool,
  createCodec:async()=>{throw Error('bad plan');},createSession:async()=>({identity:sessionHash,close(){closed++;},send(){assert.fail();}})});
 await assert.rejects(()=>p.open());assert.equal(closed,1);
});
test('concurrent close drains one issued source response before closing the spool and publishes only one closure',async()=>{
 const j=journalFixture(),local=spool();let release,requests=0,sourceCloses=0,codecCloses=0;
 const p=createProtocolSessions({...identity,plan:{maxSteps:100},journal:j,guard:async()=>{},spoolFactory:()=>local,
  createCodec:async()=>({...fakeCodec(),close(){codecCloses++;}}),
  createSession:async()=>({identity:sessionHash,close(){sourceCloses++;},async send(requestPayload,msgId){
   requests++;if(requests===1)await new Promise(resolve=>release=resolve);return {requestPayload,msgId};}})});
 const session=await p.open(),capture=session.captureRound({});
 while(!release)await new Promise(r=>setTimeout(r,1));
 const close1=session.close(),close2=session.close();assert.equal(close1,close2);
 await new Promise(r=>setImmediate(r));assert.equal(sourceCloses,0);assert.equal(local.status().closed,false);
 await assert.rejects(()=>session.captureRound({}),/REENTRY/);
 release();assert.equal((await capture).data.complete,true);await close1;
 assert.equal(requests,2);assert.equal(sourceCloses,1);assert.equal(codecCloses,1);
 assert.equal(j.events.filter(e=>e==='close').length,1);assert.equal(local.status().closed,true);
 assert.equal((await p.inspectSource()).pending,0);
});
test('close during an issued unknown source call preserves its unresolved intent without any replay',async()=>{
 const j=journalFixture(),local=spool();let release,requests=0;
 const p=createProtocolSessions({...identity,plan:{maxSteps:100},journal:j,guard:async()=>{},spoolFactory:()=>local,
  createCodec:async()=>fakeCodec(),createSession:async()=>({identity:sessionHash,close(){},async send(){
   requests++;await new Promise(resolve=>release=resolve);throw Error('source unknown');}})});
 const session=await p.open(),capture=assert.rejects(()=>session.captureRound({}),e=>e.code==='SOURCE_NETWORK_OUTCOME_UNKNOWN');
 while(!release)await new Promise(r=>setTimeout(r,1));const closing=session.close();
 assert.equal(local.status().closed,false);release();await capture;await closing;
 const audit=await p.inspectSource();assert.equal(requests,1);assert.equal(audit.unknownRequests,1);assert(audit.pending>0);
 assert.equal(j.events.filter(e=>e==='close').length,1);
});
function nativeMemory(){
 const docs=new Map();return {docs,
  store:{get:async(c,k)=>structuredClone(docs.get(k)??null),getMany:async(c,keys)=>keys.map(k=>structuredClone(docs.get(k)??null))},
  transport:{async request(op,r){if(op==='hello')return {database:'sg_capture_staging_v1',rollingJournalBatchEnabled:true};
   assert.equal(op,'rolling_journal_insert');for(const row of r.records)if(!docs.has(row.key))docs.set(row.key,{_id:'primary/'+row.key,value:structuredClone(row.value)});return {inserted:r.records.length};}},
 };
}
test('source journal audits every intent/response from native storage and refuses altered evidence',async()=>{
 const m=nativeMemory(),j=createSourceJournal({...identity,...m,guard:async()=>{}});
 const scope={queueId:'queue',gameId:'32630',kind:'canary',index:1,owner:identity.owner,sessionHash,ordinal:1};
 await j.open(scope);const request={queueId:scope.queueId,gameId:scope.gameId,kind:scope.kind,index:scope.index,owner:scope.owner,
  sessionHash,requestNo:1,msgId:'BET',requestPayload:'MSGID=BET'};
 await j.intent(request);const step={msgId:'BET',requestPayload:request.requestPayload,rollingSource:{sessionHash,requestNo:1}};
 await j.response({...request,step});await j.assertDurable([{sourceSessionHash:sessionHash,raw:{steps:[step]}}]);
 const state={sessionHash,ordinal:1,requestNo:1,awaiting:null,activeRound:false,unknownRequests:0,protocolFaults:0,closed:true};
 await j.close({...scope,...state});const audit=await j.auditSources({...request,sessions:[state]});assert.equal(audit.pending,0);
 const altered=structuredClone(step);altered.requestPayload='MSGID=FREE_GAME';
 await assert.rejects(()=>j.assertDurable([{sourceSessionHash:sessionHash,raw:{steps:[altered]}}]));
 const row=[...m.docs.values()].find(r=>r._id.endsWith(':response'));row.value.step.extra='changed';
 await assert.rejects(()=>j.auditSources({...request,sessions:[state]}),/CONTENT/);await j.close();
});
const plan=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))['32630'];
const base={mode:'demo',serverAddress:'ogs-gdm-usnj.nyxop.net/nextgen',sessionId:'Free:fixture-identity',operatorId:'fixture',currency:'USD'};
test('SG source identities and cookie jars remain independent; HTTP rejection is a retained response',async()=>{
 let calls=0;const make=ordinal=>nextgenSession({...identity,ordinal,base,plan,guard:async()=>{},fetchSource:async(url,options)=>{
  calls++;assert.equal(url,'https://ogs-gdm-usnj.nyxop.net/nextgen/');assert.equal(options.redirect,'manual');
  assert.equal(options.headers.Cookie,undefined);return new Response('rejected',{status:429});}});
 const a=make(1),b=make(2);assert.notEqual(a.identity,b.identity);assert.notEqual(a.pid,b.pid);
 for(const s of [a,b])assert((await s.send(`GN=${plan.runtimeSlug}&PID=${s.pid}&MSGID=INIT`,'INIT')).sourceRejected);
 assert.equal(calls,2);a.close();b.close();
});
test('real SG JS and Python codec independently validate ordinary round and source bootstrap',async()=>{
 let sequence=0;const session={pid:'gdmgcmfixture'},c=await nextgenCodec({plan,session,sequence:()=>++sequence,worker:0,batchId:1});
 const xml=p=>'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+p.replace(/&/g,'&amp;')+'</PAYLOAD></GDMRESPONSE>';
 const frame=(msgId,responsePayload)=>({methodName:'processGameMessage',msgId,requestPayload:c.payload({MSGID:msgId}),
  responsePayload,responseXml:xml(responsePayload),elapsedMs:0,rollingSource:{sessionHash,requestNo:3}});
 try{
  const balance=await c.bootstrap(async msg=>frame(msg,'MSGID='+msg+'&B=10000&AB=10000'));
  const raw=c.createRaw({balance});assert.equal((await c.next(raw)).MSGID,'BET');
  raw.steps.push(frame('BET','MSGID=BET&B=9900&AB=9900&TW=0&IFG=0&FID=0|&NFG=0'));
  assert.equal(await c.next(raw),null);const p=await c.prepare(raw,{attempt:'fixture-attempt',sessionHash});
  assert(p.independentlyVerified);assert.equal(p.record.bet,1);assert.equal(p.endBalanceRaw,9900);assert.equal(p.record.buy,0);
  const bad=structuredClone(raw);bad.steps[0].responsePayload+='&CFG=1';
  await assert.rejects(()=>c.next(bad));assert.equal(sequence,1);
 }finally{c.close();}
});
test('complete task crosses original AG scheduler, SG journal, real JS/Python codec and native full readback',async()=>{
 const m=nativeMemory();m.store.create=async(c,k,v)=>{if(!m.docs.has(k))m.docs.set(k,{_id:'primary/'+k,version:0,value:structuredClone(v)});return structuredClone(m.docs.get(k));};
 m.store.cas=async(c,k,b,v)=>{const old=m.docs.get(k);if(old.version!==b.version)return null;
  old.value=structuredClone(v);old.version++;return structuredClone(old);};
 const g={...identity.game,baseline:299980},ctx={...identity,game:g};
 await prepareTasks({...ctx,store:m.store,guard:async()=>{}});
 const tasks=connectTaskStore({...ctx,store:m.store,guard:async()=>{},verifyTask:async()=>proof});
 assert(await tasks.claim('canary:1',ctx.owner));let calls=0,proof;
 const runtime=createTaskRuntime({...ctx,...m,plan,quota:10,base,guard:async()=>{},spoolFactory:spool,
  createSession:scope=>{const s=nextgenSession({...scope,fetchSource:async(url,options)=>{
   calls++;const req=options.body.match(/<payload>(.*?)<\/payload>/)[1].replace(/&amp;/g,'&');
   const msg=new URLSearchParams(req).get('MSGID');
   const balance=msg==='BET'?10000-100*bet++:10000;
   const p=`MSGID=${msg}&B=${balance}&AB=${balance}`+(msg==='BET'?'&TW=0&IFG=0&FID=0|&NFG=0':'');
   return new Response('<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+p.replace(/&/g,'&amp;')+'</PAYLOAD></GDMRESPONSE>');
  }});let bet=1;return s;},
 });
 try{
  const result=await runCaptureTask({...ctx,quota:10,protocol:runtime.protocol,storage:runtime.storage,guard:async()=>{},deadline:Date.now()+10000});
  assert.equal(result.exitCode,0);assert.equal(result.proof.count,10);assert.equal(calls,12);proof=result.proof;
  await tasks.verify('canary',1,10);await tasks.finish('canary:1',ctx.owner,'success',0);
  const task=await tasks.read('canary:1');assert.equal(task.proof.recordsHash,proof.recordsHash);assert.equal(task.count,10);
  assert(!m.docs.has('campaign')&&!m.docs.has('pool:'+plan.trialId));
 }finally{await runtime.close();}
});
