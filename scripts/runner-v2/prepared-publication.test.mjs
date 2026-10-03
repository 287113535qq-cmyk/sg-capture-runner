import test from 'node:test';import assert from 'node:assert/strict';
import {buildPreparedPublication} from './prepared-publication.mjs';
import {publishedPreparedSelector} from './prepared-campaign-selector.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparationGates} from './preparation-inventory.mjs';
test('complete reusable evidence publishes to the actual selector without requiring gameplay analysis',async()=>{
 const receipts={},gates={},gameId=1,revisionHash='a'.repeat(64),plan={gameId,trialId:'trial'};
 for(const gate of preparationGates){const r={schema:'sg-preparation-gate-v1',gameId,revisionHash,gate,
  verified:true,sourceAllowance:0,supportingHashes:['b'.repeat(64)]};receipts[hash(r)]=r;gates[gate]={verified:true,evidenceHash:hash(r)};}
 const proof={schema:'sg-reusable-preparation-v1',gameId,revisionHash,sourceAllowance:0,gates};
 const inventory={schema:'sg-preparation-inventory-v1',sourceAllowance:0,revision:1,
  tasks:[{gameId,status:'prepared',claim:null,proof,proofHash:hash(proof)}]};
 const options={inventory,resolvePlan:async()=>({plan,group:'secondary'}),readEvidence:async(_g,h)=>receipts[h]};
 const result=await buildPreparedPublication(options);
 const select=publishedPreparedSelector({publication:result.publication,plans:{1:plan},readEvidence:async ref=>result.evidence[ref]});
 assert.equal(await select({readyGameIds:[1],group:'secondary'}),1);
 assert.equal(await select({readyGameIds:[],group:'secondary'}),null);
 assert.equal(result.newBetAllowance,0);
 await assert.rejects(buildPreparedPublication({...options,readEvidence:async()=>null}),/PREPARED_BUILD_EVIDENCE/);
 const changed=structuredClone(inventory);changed.tasks[0].proof.gates.route.evidenceHash='c'.repeat(64);
 await assert.rejects(buildPreparedPublication({...options,inventory:changed}),/PREPARED_BUILD_PROOF/);
 const leaked=structuredClone(inventory),leakedReceipts=structuredClone(receipts);
 const bad={...receipts[leaked.tasks[0].proof.gates.route.evidenceHash],raw:'private original'};
 leakedReceipts[hash(bad)]=bad;leaked.tasks[0].proof.gates.route.evidenceHash=hash(bad);
 leaked.tasks[0].proofHash=hash(leaked.tasks[0].proof);
 await assert.rejects(buildPreparedPublication({...options,inventory:leaked,
  readEvidence:async(_g,h)=>leakedReceipts[h]}),/PREPARED_EVIDENCE_PRIVATE_FIELDS/);
});
