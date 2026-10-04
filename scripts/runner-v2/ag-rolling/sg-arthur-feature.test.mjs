import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {CONTRACT,review,settled,previous,validateProof} from './sg-arthur-feature.mjs';
import {arthurFeatureCodec} from './sg-arthur-feature-codec.mjs';
import {arthurFeatureSession,arthurFeaturePayload} from './sg-arthur-feature-source.mjs';
import {analyzer} from '../analyzer.mjs';import {queueHash} from './sg-queue-profile.mjs';
import {rebaseResumeManifest} from './sg-resume-manifest.mjs';import {createProtocolSessions} from './sg-protocol-session.mjs';
import {parseXml,one} from '../../trial/pearl-protocol.mjs';
const reg=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')),plan=reg.plans['32754'],proof=reg.proofs['32754'];
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/arthur-feature-v2.json',import.meta.url))),copy=v=>structuredClone(v);
function changed(raw,from,to,frame=1){const r=copy(raw);r.steps[frame].responsePayload=r.steps[frame].responsePayload.replace(from,to);r.steps[frame].responseXml=r.steps[frame].responsePayload;return r;}
test('Arthur v2 runs independently verified free retriggers and Wild records through actual IPC',async()=>{
 const parser=analyzer();try{for(const f of fixture){const raw=copy(f.raw),s={session:'fixture-first',setSession(v){this.session=v;}};
  const codec=await arthurFeatureCodec({plan,session:s,sequence:()=>1,worker:0,batchId:1,createAnalyzer:()=>({call:q=>parser.call(q),close(){}})});
  try{const prefix=codec.createRaw({balance:raw.startBalanceRaw});for(const step of raw.steps){const next=await codec.next(prefix);assert.equal(next.MSGID,step.msgId);assert.equal(one(parseXml(codec.payload(next)),'Header').a.sessionID,one(parseXml(step.requestPayload),'Header').a.sessionID);prefix.steps.push(step);}
   assert.equal(await codec.next(prefix),null);const v=await codec.prepare(prefix,{attempt:'synthetic-v2',sessionHash:'a'.repeat(64)});assert(v.independentlyVerified);assert.deepEqual(v.record.normalized,f.fields);
  }finally{codec.close();}
 }}finally{parser.close();}
});
test('Arthur v2 rejects new Token, counter, multiplier, payout, overlay and early terminal states in both implementations',async()=>{
 const parser=analyzer(),raw=fixture[0].raw;try{
  for(const r of [changed(raw,'freeSpinNumber="1"','freeSpinNumber="2"'),changed(raw,'newGolden="0"','newGolden="3"'),
    changed(raw,'currentMultiplier="1"','currentMultiplier="7"'),changed(raw,'winVal="100"','winVal="101"'),
    changed(raw,'readyForEndGame="N"','readyForEndGame="Y"'),changed(fixture[2].raw,'overlay="','overlay="3|',0),
    {...copy(raw),steps:raw.steps.slice(0,-1)}, {...copy(raw),steps:[raw.steps[0],raw.steps.at(-1)]}]){
   assert.throws(()=>settled(r,fixture[0].fields.typeMappingHash));await assert.rejects(()=>parser.call({op:'fields',plan,raw:r}));
  }
 }finally{parser.close();}
});
test('Arthur v2 keeps old markers rejected and rejects unknown marker, wrong session and repeated END',()=>{
 const raw=copy(fixture[0].raw);delete raw.arthurFeatureContract;assert.throws(()=>review(raw),/FEATURE_NOT_ADAPTED/);
 assert.throws(()=>review({...fixture[0].raw,arthurFeatureContract:'unknown'}),/MARKER/);
 const r=copy(fixture[0].raw);r.steps[1].requestPayload=r.steps[1].requestPayload.replace('fixture-response-0','wrong');assert.throws(()=>review(r),/SESSION/);
 assert.throws(()=>review({...fixture[0].raw,steps:[...fixture[0].raw.steps,fixture[0].raw.steps.at(-1)]}));
});
test('Arthur v2 immutable resume binds the old plan and proof and prohibits completed repair',()=>{
 const old=previous(plan),previousProof=proof.arthurFeatureEvidence.previousProof;
 const entry={gameId:'32754',planHash:queueHash(old),adapterProofHash:queueHash(previousProof),campaignId:'original',target:300000};
 const args={previous:{manifest:[entry]},previousPlans:{plans:{'32754':old},proofs:{'32754':previousProof}},plans:reg};
 const result=rebaseResumeManifest(args)[0];assert.equal(result.planHash,queueHash(plan));assert.equal(result.campaignId,'original');assert.equal(result.target,300000);
 assert.throws(()=>rebaseResumeManifest({...args,completedGameIds:['32754']}),/COMPLETED_ADAPTER_CHANGED/);
 assert.throws(()=>rebaseResumeManifest({...args,previousPlans:{plans:{'32754':{...old,maxSteps:3}},proofs:{'32754':previousProof}}}));
});
test('Arthur v2 rejects re-signed proof changes to record, raw, route, constructor and historical credit evidence',()=>{
 assert(validateProof(plan,proof));for(const [key,value] of [['fullRecordsHash','a'.repeat(64)],['acceptedOriginalRawSetHash','a'.repeat(64)],['actualOwnRequests',2070],['originalEndConstructorExecutions',12],['historicalCredit',1]]){
  const bad=copy(proof),wire=bad.arthurFeatureEvidence.wiringEvidence;wire[key]=value;const {evidenceHash,...body}=wire;wire.evidenceHash=queueHash(body);assert.throws(()=>validateProof(plan,bad),/WIRING/);
 }
});
test('Arthur v2 transport guards paid Logic as BET and fresh owners differ; production source requires GHH',async()=>{
 const ctx={base:{mode:'demo',sessionId:'Free:synthetic-v2',operatorId:'synthetic'},plan,queueId:'synthetic',kind:'canary',index:1,owner:'synthetic',ordinal:1,guard:async()=>{}};
 assert.throws(()=>arthurFeatureSession(ctx),/GITHUB_SOURCE/);let calls=0;const guards=[];
 const s=arthurFeatureSession({...ctx,guard:async v=>guards.push(v.msgId),fetchSource:async()=>{calls++;throw Error('unknown');}}),other=arthurFeatureSession({...ctx,ordinal:2,fetchSource:async()=>{throw Error('unused');}});
 assert.notEqual(s.identity,other.identity);assert.equal(calls,0);await assert.rejects(()=>s.send(arthurFeaturePayload({MSGID:'Logic'},s.session,true),'Logic'),/OUTCOME_UNKNOWN/);assert.deepEqual(guards,['BET']);assert.equal(calls,1);s.close();other.close();
});
test('Arthur v2 unknown Init stays durable once without retry or paid request',async()=>{
 let calls=0,intents=0,responses=0,closed;const base={mode:'demo',sessionId:'Free:synthetic-v2',operatorId:'synthetic'};
 const protocol=createProtocolSessions({game:{gameId:'32754'},queueId:'synthetic',kind:'canary',index:1,owner:'synthetic',plan,guard:async()=>{},spoolFactory:()=>({append(){},confirmed(){},close(){}}),
  journal:{open:async()=>{},intent:async()=>{intents++;return{durable:true};},response:async()=>{responses++;return{durable:true};},close:async v=>{closed=v;},auditSources:async()=>{}},
  createSession:c=>arthurFeatureSession({...c,base,plan,queueId:'synthetic',kind:'canary',index:1,owner:'synthetic',guard:async()=>{},fetchSource:async()=>{calls++;throw Error('unknown');}}),createCodec:(_p,s)=>arthurFeatureCodec({plan,session:s,sequence:()=>1,worker:0,batchId:1})});
 const s=await protocol.open();await assert.rejects(()=>s.captureRound({}),/OUTCOME_UNKNOWN/);await s.close();assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);assert.equal(closed.unknownRequests,1);assert.equal(closed.ready,false);
});
