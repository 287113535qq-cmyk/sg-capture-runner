import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {DRAGON_FREE,dragonFreePrevious,dragonFreeRoute,dragonFreeIntent,dragonFreeProof} from './sg-dragon-first-free.mjs';
import {nextgenCodec} from './sg-nextgen-codec.mjs';import {queueHash} from './sg-queue-profile.mjs';import {rebaseResumeManifest} from './sg-resume-manifest.mjs';import {createProtocolSessions} from './sg-protocol-session.mjs';
const registry=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json','utf8')),plan=registry.plans['32497'],proof=registry.proofs['32497'],fixture=JSON.parse(fs.readFileSync('service/tests/fixtures/dragon-first-free-v4-synthetic.json','utf8'));
const raw=()=>structuredClone(fixture.raw),pid=fixture.raw.steps[0].requestPayload.match(/PID=([^&]+)/)[1];
function alter(r,key,value){const s=r.steps.at(-1),p=Object.fromEntries(s.responsePayload.split('&').map(v=>v.split(/=(.*)/s).slice(0,2)));if(value===undefined)delete p[key];else p[key]=value;s.responsePayload=Object.entries(p).map(([k,v])=>`${k}=${v}`).join('&');s.responseXml='<GDMRESPONSE><OGS_RC>0</OGS_RC><SUCCESS>true</SUCCESS><PAYLOAD>'+s.responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>';}
test('own END selects only the first FREE with constructor LB50 and unchanged source parameters',()=>{
 assert.deepEqual(dragonFreeRoute(plan,raw()),{request:{MSGID:'FREE_GAME'},options:[],settlementApproved:false});
 const p=`GN=${plan.runtimeSlug}&PID=${pid}&AP=false&BPL=5&LB=50&MSGID=FREE_GAME`;assert.deepEqual(dragonFreeIntent(plan,raw(),p),{validated:true});
 for(const bad of [p.replace('LB=50','LB=25'),p+'&CFG=0',p+'&FP=0|1|1',p+'&BPR=10',p.replace('FREE_GAME','BET'),p.replace('AP=false','AP=true')])assert.throws(()=>dragonFreeIntent(plan,raw(),bad),/INTENT_CHANGED/);
});
test('parent START PICK END gates and every old marker remain intact',async()=>{
 const codec=await nextgenCodec({plan,session:{pid},sequence:()=>assert.fail('no credit'),worker:0,batchId:1});
 try{for(let n=1;n<=3;n++){const r=raw();r.steps.length=n;assert.equal((await codec.next(r)).MSGID,['FEATURE_START','FEATURE_PICK','FEATURE_END'][n-1]);}
  const old=raw();delete old.dragonFreeContract;await assert.rejects(()=>codec.next(old),/DRAGON_END_RESPONSE_REVIEW_REQUIRED/);
  const blocked={...fixture.parentBlocked,dragonFreeContract:DRAGON_FREE};assert.throws(()=>dragonFreeRoute(plan,blocked),/EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED/);
  await assert.rejects(()=>codec.prepare(raw(),{attempt:'offline',sessionHash:'a'.repeat(64)}),/INCOMPLETE_DRAGON_FIRST_FREE/);
 }finally{codec.close();}
});
test('counter money session and joint visual changes refuse the first FREE',()=>{
 for(const [k,v] of [['B','1'],['AB','1'],['TW','1'],['SID','other'],['IFG','1'],['NFG','0'],['NFG','9'],['TFG','99'],['FGT','99'],['CW','1'],['FGTW','1'],['FID','0|'],['GCT','0'],['PD','unknown'],['RS','0,0,0,0,0'],['LB','50']]){const r=raw();alter(r,k,v);assert.throws(()=>dragonFreeRoute(plan,r));}
 const r=raw();r.steps.at(-1).requestPayload+='&FP=0|1|1';assert.throws(()=>dragonFreeRoute(plan,r),/REQUEST/);
});
test('XML error mismatch and timing cannot advance and every FREE response stops',()=>{
 for(const xml of ['<OGS_RC>1</OGS_RC>','<ERROR>reject</ERROR>']){const r=raw();r.steps.at(-1).responseXml=r.steps.at(-1).responseXml.replace('<OGS_RC>0</OGS_RC>',xml);assert.throws(()=>dragonFreeRoute(plan,r),/XML/);}
 const r=raw();r.steps.at(-1).elapsedMs=300001;assert.throws(()=>dragonFreeRoute(plan,r),/TIMING/);
 for(const nfg of ['0','5']){const unknown=raw();unknown.steps.push({...unknown.steps.at(-1),msgId:'FREE_GAME'});alter(unknown,'NFG',nfg);assert.throws(()=>dragonFreeRoute(plan,unknown),/DRAGON_FREE_RESPONSE_REVIEW_REQUIRED/);}
});
test('mandatory proof refuses re-signed raw frame constructor record credit and parent evidence changes',()=>{
 assert.equal(dragonFreeProof(plan,proof),true);
 for(const [k,v] of [['actualOwnCodecPythonRequests',279],['oldAcceptedRecordParity',98],['ownPrefixRoutesHash','a'.repeat(64)],['ownCandidateIntentsHash','a'.repeat(64)],['frontendExecutionHash','a'.repeat(64)],['freeResponsesObserved',1],['failedRoundsCredited',1]]){const p=structuredClone(proof);p.dragonFreeEvidence.wiringEvidence[k]=v;assert.throws(()=>dragonFreeProof(plan,p),/PROOF/);}
 const p=structuredClone(proof);delete p.dragonFreeEvidence.wiringEvidence;assert.throws(()=>dragonFreeProof(plan,p),/PROOF/);
 const parent=structuredClone(proof);parent.dragonEndEvidence.wiringEvidence.ownClosedPrefixes=1;assert.throws(()=>dragonFreeProof(plan,parent),/PROOF/);
});
test('immutable original v1 v2 v3 v4 resume preserves namespace and validates each parent',()=>{
 let p=dragonFreePrevious(plan),{dragonFreeEvidence,...q}=proof;q={...q,planHash:queueHash(p)};const pairs=[[p,q]];
 for(const [key,e] of [['dragonEnd','dragonEndEvidence'],['explicitDragon','explicitDragonEvidence'],['explicitProbe','explicitProbeEvidence']]){const {[key+'Contract']:c,[key+'ContractHash']:h,...prev}=p;const {[e]:ev,...rest}=q;if(key==='explicitProbe')delete rest.previousPlanHash;p=prev;q={...rest,planHash:queueHash(prev)};pairs.push([p,q]);}
 for(const [old,oldProof] of pairs){const entry={gameId:'32497',campaignId:'same',namespace:'same',planHash:queueHash(old),adapterProofHash:queueHash(oldProof)},args={previous:{manifest:[entry]},previousPlans:{plans:{32497:old},proofs:{32497:oldProof}},plans:registry};const before=queueHash(args),out=rebaseResumeManifest(args)[0];assert.equal(out.namespace,'same');assert.equal(out.campaignId,'same');assert.equal(out.planHash,queueHash(plan));assert.equal(queueHash(args),before);assert.throws(()=>rebaseResumeManifest({...args,completedGameIds:['32497']}),/COMPLETED_ADAPTER_CHANGED/);}
});
test('unknown first FREE response or native ACK is sealed once and never retried or credited',async()=>{
 for(const unknown of [false,true]){const r=raw(),sends=[],events=[];let closed=0,closure;
 const source=await createProtocolSessions({game:{gameId:'32497'},queueId:'offline-free-v4',kind:'canary',index:1,owner:'offline',plan,guard:async()=>{},journal:{async open(){},async intent(q){events.push('intent:'+q.msgId);return {durable:true};},async response(q){events.push('response:'+q.msgId);if(unknown&&sends.length===7)throw Error('unknown');return {durable:true};},async close(q){closed++;closure=q;},async auditSources(){assert.fail('no credit');}},spoolFactory:()=>({append(){events.push('fsync');},confirmed(){},close(){}}),
 createSession:async()=>({identity:'a'.repeat(64),pid,async close(){},async send(payload,msg){sends.push(msg);events.push('source:'+msg);if(['INIT','REELSTRIP'].includes(msg)){const p=`MSGID=${msg}&B=${r.startBalanceRaw}&AB=${r.startBalanceRaw}&TW=0&IFG=0&NFG=0`;return {methodName:'processGameMessage',msgId:msg,requestPayload:payload,responsePayload:p,responseBalance:r.startBalanceRaw,elapsedMs:0,responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+p.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'};}return {...(r.steps.find(s=>s.msgId===msg)??r.steps.at(-1)),msgId:msg,requestPayload:payload};}}),createCodec:(plan,session)=>nextgenCodec({plan,session,sequence:()=>assert.fail('no credit'),worker:20,batchId:21})}).open();
 try{await assert.rejects(()=>source.captureRound({}),unknown?/JOURNAL_ACK_UNKNOWN/:/DRAGON_FREE_RESPONSE_REVIEW_REQUIRED/);}finally{await source.close();}
 assert.deepEqual(sends,['INIT','REELSTRIP','BET','FEATURE_START','FEATURE_PICK','FEATURE_END','FREE_GAME']);assert.equal(closed,1);assert.equal(closure.awaiting,unknown?7:null);assert.equal(closure.performance.normalize.count,0);assert.equal(events.filter(v=>v==='fsync').length,7);assert(events.indexOf('intent:FREE_GAME')<events.indexOf('source:FREE_GAME'));
 }
});
