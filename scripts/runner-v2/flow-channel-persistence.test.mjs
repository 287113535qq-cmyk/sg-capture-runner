import test from 'node:test';
import assert from 'node:assert/strict';
import {BatchController} from './batch-controller.mjs';

// Exercise the real durable exchange order with an independently supplied
// flow channel. This fixture does not enable that channel in a capture profile.
test('continuation reads persisted original response before deciding; no record until terminal', async()=>{
  const controller=Object.create(BatchController.prototype),events=[];
  const raw={steps:[]};
  const state={checkpoint:0,pending:{sequence:1,attempt:'fixture',raw,awaiting:'BET'}};
  controller.plan={maxSteps:100};
  controller.identity={sessionHash:'fixture'};
  controller.lease={worker:0};controller.batch={id:1};
  controller.spool={append:()=>events.push('spool'),confirmed:()=>events.push('confirmed')};
  controller.owned=async()=>events.push('owner');
  controller.update=async change=>{
    const next=change(structuredClone(controller.batchSnapshot?.value??state));
    controller.batchSnapshot={value:next};events.push('persist');return controller.batchSnapshot;
  };
  controller.analyzer={call:async request=>{
    assert.equal(request.op,'next');
    assert.equal(controller.batchSnapshot.value.pending.awaiting,null);
    assert.deepEqual(request.raw,controller.batchSnapshot.value.pending.raw);
    assert.equal(request.raw.steps.at(-1).responsePayload,'FGTHNS=1&HNSID=7');
    events.push('flow');return {MSGID:'FREE_GAME'};
  }};
  const step={requestPayload:'BET',responsePayload:'FGTHNS=1&HNSID=7',responseXml:'original'};
  const result=await controller.exchange({sequence:1,step});
  assert.deepEqual(events,['spool','owner','persist','confirmed','flow']);
  assert.equal(result.complete,false);
  assert.equal(result.followingIntentDurable,false);
  assert.deepEqual(controller.batchSnapshot.value.pending.raw.steps,[step]);
});

test('failed response persistence prevents the flow channel and following request', async()=>{
  const controller=Object.create(BatchController.prototype);
  controller.spool={append(){},confirmed(){assert.fail('unconfirmed response');}};
  controller.owned=async()=>{};
  controller.update=async()=>{throw Error('ACK_UNKNOWN');};
  controller.analyzer={call:async()=>assert.fail('must not parse or advance')};
  await assert.rejects(controller.exchange({sequence:1,step:{}}),/ACK_UNKNOWN/);
});
