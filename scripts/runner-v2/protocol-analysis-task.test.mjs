import test from 'node:test';import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';import {observeProtocolTask} from './protocol-analysis-task.mjs';
test('analysis observes unknown fields without changing source evidence or granting capture',()=>{
 const evidence={steps:[{response:{unknownDisplay:3}},{response:{unknownDisplay:4}}]},before=hash(evidence);
 const r=observeProtocolTask({schema:'sg-offline-protocol-task-v1',gameId:1,rawHash:before,evidence});
 assert.equal(hash(evidence),before);assert.equal(r.captureAuthorization,false);assert.equal(r.classification,null);
 assert.equal(r.fields.find(f=>f.field==='steps[].response.unknownDisplay').occurrences,2);
 assert.throws(()=>observeProtocolTask({schema:'sg-offline-protocol-task-v1',gameId:1,rawHash:'a'.repeat(64),evidence}),/INPUT_CHANGED/);
});
