// Real GitHub -> restricted Mongo-only gateway check. It writes only bounded
// diagnostic metadata in the newly authorized state/journal collections.
import assert from 'node:assert/strict';
import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {repositories} from '../trial/runner-group.mjs';

const transport=connectGateway(),gate=new ResourceGate();
const store=new RunnerState({transport,gate,deadline:Date.now()+180_000});
try {
  const hello=await transport.request('hello');
  assert.equal(hello.group,repositories[process.env.GITHUB_REPOSITORY].name);
  assert.equal(hello.captureLogicOnServer,false);
  await store.writable();
  const key=`validation:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}`;
  const value={kind:'gateway-validation',sourceRequests:0,officialRounds:0};
  const journal=await store.create('journal',key,value,{immutable:true});
  assert.deepEqual(journal.value,value);
  const before=await store.create('state',key,{...value,stage:0});
  const updated=await store.cas('state',key,before,{...value,stage:1});assert(updated);
  assert.equal(await store.cas('state',key,before,{...value,stage:2}),null);
  assert.equal((await store.get('state',key)).value.stage,1);
  console.log(JSON.stringify({gateway:'mongo-only-v2',group:hello.group,resourceGate:gate.status(),
    metadataReadback:true,staleVersionRejected:true,sourceRequests:0,officialRoundWrites:0}));
} finally {transport.close();}
