import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createInterface} from 'node:readline';
import {createRequire} from 'node:module';
import {captureBatch, runDynamicBatches} from './capture-batch.mjs';
import {gameForShard} from './demo-sessions.mjs';

globalThis.fetch = () => { throw Error('NETWORK_FORBIDDEN_IN_FIXTURE'); };
const require = createRequire(import.meta.url);
require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json')});
const {prepareNextgenRound} = require('../../collector/sg.ingest.ts');
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
  : Array.isArray(value) ? '['+value.map(canonical).join(',')+']'
  : '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
const hash = value => createHash('sha256').update(value).digest('hex');
const registry = JSON.parse(fs.readFileSync('service/round_types.json','utf8'));
const plan = {...JSON.parse(fs.readFileSync('config/trial-pool.json','utf8')),
  configured:true, trialId:'bookofsevens_pool_e2e_fixture', target:3000};
const mappingHash = hash(canonical(registry.profiles[plan.sourceKey]));
const tempParent = fs.realpathSync(os.tmpdir());
const root = fs.mkdtempSync(path.join(tempParent,'sg-pool-e2e-fixture-'));
fs.writeFileSync(path.join(root,'fixture-plan.json'),JSON.stringify(plan));
const python = process.env.PYTHON || 'python3';
const childEnv = {...process.env, SG_OFFLINE_POOL_TEST:'1'};
const script = 'service/tests/pool_fixture_rpc.py';
const children = [], finishes = [];
const start = performance.now();

function synchronous(mode) {
  const result = spawnSync(python,[script,root,mode],{env:childEnv,encoding:'utf8',timeout:180000,maxBuffer:1048576});
  assert.equal(result.status,0,result.stderr || result.error?.message);
  return result.stdout;
}

function connection(shard) {
  const child = spawn(python,[script,root],{env:childEnv,stdio:['pipe','pipe','pipe']});
  children.push(child);
  let current, stderr='';
  const finished = new Promise((resolve,reject)=>{
    child.on('error',reject);
    child.on('close',code=>{
      if(current)current.reject(Error(stderr || `fixture RPC closed: ${code}`));
      code===0 ? resolve() : reject(Error(stderr || `fixture RPC exit ${code}`));
    });
  });
  finished.catch(()=>{});finishes.push(finished);
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-4000);});
  createInterface({input:child.stdout}).on('line',line=>{
    const pending=current;current=null;
    assert(pending,'Unexpected fixture RPC response');
    clearTimeout(pending.timer);
    try {
      const result=JSON.parse(line);
      if(!result.ok)throw Error(result.error);
      pending.resolve(result);
    }catch(error){pending.reject(error);}
  });
  return {close:()=>child.stdin.end(),rpc:(op,data={})=>new Promise((resolve,reject)=>{
    assert(!current,'Only one request per session');
    current={resolve,reject,timer:setTimeout(()=>{child.kill();reject(Error('FIXTURE_RPC_TIMEOUT'));},60000)};
    child.stdin.write(JSON.stringify({schema:plan.schema,trialId:plan.trialId,shardId:shard,op,...data})+'\n');
  })};
}

async function worker(shard) {
  const transport=connection(shard), rpc=transport.rpc;
  const game=gameForShard({id:32471,runtimeSlug:'bookofsevens96',mode:'demo',
    serverAddress:'ogs-gdm-usnj.nyxop.net/nextgen',sessionId:'Free:offline-fixture',operatorId:'fixture'},shard,plan.trialId);
  const identity={owner:`fixture-worker-${shard}`,sessionHash:hash(game.sessionId+'@'+game.operatorId),
    commitSha:'b'.repeat(40),planHash:hash(canonical(plan))};
  const evidence={completedThisRun:0,sourceRequests:0,paidRoundRequests:0}, state={};
  let balance=100000,remaining=0,paid=0,batches=0;
  const payload=msg=>`GN=bookofsevens96&PID=gdmgcmexplicit-test-fixture&MSGID=${msg}&AP=false&BPL=5&LB=5`;
  const bootstrap=async()=>{assert.equal(remaining,0);balance=100000;return balance;};
  const post=async(requestPayload,msgId)=>{
    await new Promise(resolve=>setTimeout(resolve,shard<10?1:12));
    let win=0;
    if(msgId==='BET'){
      assert.equal(remaining,0);balance-=25;paid++;remaining=paid%13===0?2:0;
    }else{
      assert(remaining>0);remaining--;if(remaining===0){win=50;balance+=50;}
    }
    const responsePayload=`MSGID=${msgId}&B=${balance}&AB=${balance}&TW=${win}&BPL=5&LB=5&FID=0|&IFG=${Number(msgId==='FREE_GAME')}&NFG=${remaining}`;
    return {msgId,requestPayload,responsePayload,responseBalance:balance,elapsedMs:shard<10?1:12,
      responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'};
  };
  try {
    await runDynamicBatches({rpc,identity,shouldStop:()=>false,deadline:performance.now()+300000,
      capture:async(lease,owned)=>{
        const result=await captureBatch({plan,lease,owned,rpc,post,payload,bootstrap,
          prepareRound:prepareNextgenRound,mappingHash,evidence,state,shouldStop:()=>false,
          requestStop:()=>{throw Error('UNEXPECTED_FIXTURE_HALT');},deadline:performance.now()+300000,limit:plan.target});
        assert.equal(result.status,'complete');batches++;return result;
      }});
    assert.equal(remaining,0);
    assert.equal(paid,evidence.completedThisRun);
    return {shard,rounds:evidence.completedThisRun,paidFixtureRequests:paid,batches};
  }finally{transport.close();}
}

try {
  synchronous('init');
  const workers=await Promise.all(Array.from({length:20},(_,i)=>worker(i)));
  await Promise.all(finishes);
  const audit=JSON.parse(synchronous('audit'));
  assert.equal(audit.status,'complete');assert.equal(audit.distinctSessions,20);
  assert.equal(audit.verifiedFileRounds,plan.target);assert.equal(audit.sourceEnabled,false);
  assert.equal(workers.reduce((n,w)=>n+w.rounds,0),plan.target);
  assert(workers.every(w=>w.rounds>0));assert(workers.some(w=>w.batches>1));
  console.log(JSON.stringify({schema:'sg-pool-e2e-fixture-result-v1',...audit,
    independentCaptureLoops:20,captureProcesses:1,storageRpcProcesses:20,
    sharedProductionCaptureLoop:true,sharedProductionPoolService:true,
    elapsedFixtureSeconds:Number(((performance.now()-start)/1000).toFixed(3)),workers}));
}finally{
  for(const child of children)if(child.exitCode===null)child.kill();
  await Promise.allSettled(finishes);
  assert.equal(path.dirname(root),tempParent);
  assert(path.basename(root).startsWith('sg-pool-e2e-fixture-'));
  fs.rmSync(root,{recursive:true,force:true});
}
