import assert from 'node:assert/strict';
import test from 'node:test';
import {captureBatch, runDynamicBatches} from './capture-batch.mjs';

test('a fully persisted recovered batch makes no new source request', async()=>{
  let released=0;
  const result=await captureBatch({plan:{target:20},lease:{durable:20,sequenceTarget:20},owned:{epoch:2},
    rpc:async op=>{assert.equal(op,'release');released++;return {status:'complete'};},
    bootstrap:()=>assert.fail('No source bootstrap'),post:()=>assert.fail('No source replay')});
  assert.equal(result.status,'complete');assert.equal(released,1);
});

test('an unknown response cannot be resumed by the capture loop', async()=>{
  await assert.rejects(captureBatch({plan:{target:20},lease:{durable:0,sequenceTarget:20,
    pendingRound:{awaiting:'BET'}},state:{},bootstrap:()=>assert.fail('No bootstrap'),
    post:()=>assert.fail('No source replay')}));
});

test('worker keeps one identity while taking multiple batches and stops at exhaustion', async()=>{
  let next=0, captured=0;
  const identity={owner:'fixed-owner',sessionHash:'stable'};
  await runDynamicBatches({identity,shouldStop:()=>false,deadline:performance.now()+10000,
    rpc:async(op,data)=>{
      if(op==='register'){assert.equal(data,identity);return {workerEpoch:7};}
      assert.equal(op,'next');assert.deepEqual(data,{owner:'fixed-owner',workerEpoch:7});
      return next++<3 ? {batchId:next,epoch:2} : {done:true};
    },capture:async(lease,owned)=>{
      assert.equal(owned.owner,identity.owner);assert.equal(owned.batchId,lease.batchId);
      captured++;return {status:'complete'};
    }});
  assert.equal(captured,3);assert.equal(next,4);
});

test('partial batch is retained and cannot be replaced by a new assignment', async()=>{
  let calls=0;
  await runDynamicBatches({identity:{owner:'worker'},shouldStop:()=>false,deadline:performance.now()+10000,
    rpc:async op=>{calls++;return op==='register'?{workerEpoch:1}:{batchId:1,epoch:1};},
    capture:async()=>({status:'pending'})});
  assert.equal(calls,2);
});

test('failed capture is not retried or moved to another batch', async()=>{
  let next=0;
  await assert.rejects(runDynamicBatches({identity:{owner:'worker'},shouldStop:()=>false,
    deadline:performance.now()+10000,rpc:async op=>{
      if(op==='register')return {workerEpoch:1};next++;return {batchId:1,epoch:1};
    },capture:async()=>{throw Error('SOURCE_NETWORK_OUTCOME_UNKNOWN');}}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);
  assert.equal(next,1);
});
test('completion racing with registration exits without a false failure or source request',async()=>{
  let calls=0;
  await runDynamicBatches({identity:{owner:'late-worker'},shouldStop:()=>false,
    deadline:performance.now()+10000,rpc:async op=>{
      assert.equal(op,'register');calls++;return {done:true};
    },capture:()=>assert.fail('No capture after completion')});
  assert.equal(calls,1);
});
test('missing storage registrations stop startup within its own bounded deadline',async()=>{
  let calls=0;
  await assert.rejects(runDynamicBatches({identity:{owner:'waiting-worker'},shouldStop:()=>false,
    deadline:performance.now()+60000,startupTimeoutMs:0,rpc:async op=>{
      calls++;return op==='register'?{workerEpoch:1}:{waitingForWorkers:true,readyWorkers:19};
    },capture:()=>assert.fail('No capture with nineteen ready sessions')}),/POOL_RUNNERS_NOT_READY/);
  assert.equal(calls,2);
});
