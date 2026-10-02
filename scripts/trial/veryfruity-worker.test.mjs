import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import path from 'node:path';
import {runVeryFruityWorker} from './veryfruity-worker.mjs';
import {veryFruityActionNext} from './veryfruity-action-protocol.mjs';
import {veryFruityPayload,VERYFRUITY_ENDPOINT} from './veryfruity-session.mjs';
import {onePaidRound} from '../runner-v2/paid-round-evidence.mjs';
const py=process.env.PYTHON??'C:/Users/xxx/AppData/Local/Programs/Python/Python314/python.exe';
function python(code,q){const p=spawnSync(py,['-B','-c',code],{encoding:'utf8',env:{...process.env,PYTHONPATH:['service','service/tests'].join(path.delimiter),PYTHONUTF8:'1'},input:JSON.stringify(q)});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);}
const fixture=()=>python('import json;from test_veryfruity_action_fields import fixture;p,r=fixture();print(json.dumps({"plan":p,"raw":r}))');
const validate=(plan,op,raw,step)=>python('import json,sys;from veryfruity_action_fields import VeryFruityActionFields;q=json.load(sys.stdin);a=VeryFruityActionFields(q["plan"]);v=a.bootstrap(q["step"]) if q["op"]=="bootstrap" else a.validate_intent(q["raw"],q["step"]) if q["op"]=="intent" else a.settled(q["raw"]);print(json.dumps(v))',{plan,op,raw,step});
async function run({unknownAck=false,badInit=false,badLease=false}={}){
 const f=fixture(),plan={...f.plan,schema:'sg-work-pool-v1',trialId:'offline',demoGeneration:'a'.repeat(64),runnerGroup:'secondary',maxSteps:1026,target:1};
 let pending=null,bootstrap=null,raw=null,posts=0,record=null;const saved=[],evidence={sourceRequests:0,paidRoundRequests:0,completedThisRun:0};
 const init='<GameResponse type="Init"><Header gameID="20206" versionID="1_0" ccyCode="" lang="en_US" isRecovering="N" sessionID="fixture-0"/><Balances><Balance name="CASH_BALANCE" value="1000"/></Balances><Stakes>1|2|</Stakes><CurrencyMultiplier>1</CurrencyMultiplier><PaylineInfo>'+Array.from({length:20},(_,i)=>`<Payline index="${i}"/>`).join('')+'</PaylineInfo></GameResponse>';
 const rpc=async(op,d)=>{
  if(op==='register')return {workerEpoch:1};if(op==='next')return {durable:0,sequenceTarget:1,batchId:1,epoch:1,shortRunLimit:badLease?6:1,pendingRound:null};
  if(op==='bootstrap_intent'){bootstrap=d.requestPayload;return {};}
  if(op==='bootstrap_frame'){assert.equal(d.step.requestPayload,bootstrap);saved.push(d.step);validate(plan,'bootstrap',{},d.step);bootstrap=null;return {};}
  if(op==='begin'||op==='intent'){assert.equal(pending,null);if(op==='begin')raw={...f.raw,steps:[],startBalanceRaw:d.startBalanceRaw};validate(plan,'intent',raw,d.requestPayload);pending=d.requestPayload;return {};}
  if(op==='exchange_journal'){assert.equal(pending,d.step.requestPayload);if(unknownAck)throw Object.assign(Error('ACK_UNKNOWN'),{code:'ACK_UNKNOWN'});saved.push(d.step);raw.steps.push(d.step);pending=null;const next=veryFruityActionNext(plan,raw);if(!next)record=validate(plan,'settled',raw);return {complete:!next,followingIntentDurable:false,checkpoint:!next?1:0,endBalanceRaw:1000};}
  if(op==='release')return {status:'partial',checkpoint:record?1:0};if(op==='status')return {confirmed:record?1:0};throw Error('UNEXPECTED_RPC');
 };
 const fetchImpl=async(url,options)=>{assert.equal(url,VERYFRUITY_ENDPOINT);assert.equal(options.body,bootstrap??pending);assert.equal(options.redirect,'manual');
  const text=posts++===0?(badInit?init.replace('1|2|','2|'):init):f.raw.steps[posts-2].responseXml;
  return {ok:true,headers:{getSetCookie:()=>[],get:()=>null},text:async()=>text};};
 let error;try{await runVeryFruityWorker({plan,baseGame:{mode:'demo',sessionId:'Free:offline',operatorId:'offline'},shard:20,rpc,
  prepareRound:r=>validate(plan,'settled',r),evidence,shouldStop:()=>false,requestStop(){},onLease(){},commitSha:'b'.repeat(40),planHash:'c'.repeat(64),fetchImpl,limit:1,runId:'1',runAttempt:'1',job:'offline'});}catch(e){error=e;}
 return {error,posts,saved,evidence,record,pending};
}
test('worker binds real protocol identity and persists Init/Logic/EndGame before independent settlement',async()=>{const r=await run();assert.equal(r.error,undefined);assert.equal(r.posts,3);assert.equal(r.saved.length,3);assert.equal(r.evidence.paidRoundRequests,1);assert.equal(r.evidence.completedThisRun,1);assert.equal(r.record.classificationStatus,'pending');});
test('unknown durability never retries or sends EndGame',async()=>{const r=await run({unknownAck:true});assert.equal(r.error.code,'ACK_UNKNOWN');assert.equal(r.posts,2);assert(r.pending);assert.equal(r.record,null);});
test('unadvertised wager stops after preserved Init with zero paid requests',async()=>{const r=await run({badInit:true});assert(r.error);assert.equal(r.posts,1);assert.equal(r.saved.length,1);assert.equal(r.evidence.paidRoundRequests,0);});
test('invalid pilot lease stops before Init',async()=>{const r=await run({badLease:true});assert(r.error);assert.equal(r.posts,0);});
test('paid evidence counts a whole action chain and rejects forged abandoned session or wager',()=>{
 const {plan,raw}=fixture();assert(onePaidRound(plan,raw));
 const prefix={...raw,steps:raw.steps.slice(0,1)};assert(!onePaidRound(plan,prefix));assert(onePaidRound(plan,prefix,{abandoned:true}));
 for(const payload of [prefix.steps[0].requestPayload.replace('total="20"','total="40"'),raw.steps[1].requestPayload]){
  assert(!onePaidRound(plan,{...prefix,steps:[{...prefix.steps[0],requestPayload:payload}]},{abandoned:true}));
 }
 const bad=structuredClone(raw);bad.steps[1].requestPayload=veryFruityPayload(plan,'EndGame','wrong');assert(!onePaidRound(plan,bad,{abandoned:true}));
});
