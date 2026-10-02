import test from 'node:test';import assert from 'node:assert/strict';
import {reviewCaptureHandoff} from './capture-handoff.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparationGates} from './preparation-inventory.mjs';
function fixture(id,group){
 const proof={schema:'sg-reusable-preparation-v1',gameId:id,sourceAllowance:0,revisionHash:'a'.repeat(64),gates:Object.fromEntries(preparationGates.map(g=>[g,{verified:true,evidenceHash:'b'.repeat(64)}]))};
 const profile={schema:'sg-demo-next-game-v1',gameId:id,group,generation:'c'.repeat(64),createdAt:10,expiresAt:1000,newBetAllowance:100,workers:20,perWorker:5,workerOffset:group==='primary'?0:20,basePlan:{gameId:id,buy:0,phase:1,mode:'demo'}};
 return {profile,receipt:{schema:'sg-capture-ready-handoff-v1',gameId:id,group,generation:profile.generation,commit:'d'.repeat(40),profile:'demo-pilot-reviewed.json',profileHash:hash(profile),preparationProof:proof,preparationProofHash:hash(proof)}};
}
test('handoff handles independently reviewed games in both groups without dispatching or minting quota',()=>{
 for(const [id,group] of [[32812,'secondary'],[32760,'primary']]){const {profile,receipt}=fixture(id,group);const r=reviewCaptureHandoff(receipt,profile,20);assert.equal(r.dispatched,false);assert.equal(r.sourceAllowance,0);assert.equal(r.receipt.gameId,id);}
});
test('expired/changed profile, missing proof and path traversal never become dispatch tasks',()=>{
 const {profile,receipt}=fixture(1,'primary');assert.throws(()=>reviewCaptureHandoff(receipt,profile,1001),/STALE/);
 for(const mutate of [r=>r.profile='../secret.json',r=>delete r.preparationProof,r=>r.group='secondary',r=>r.profileHash='f'.repeat(64)]){const r=structuredClone(receipt);mutate(r);assert.throws(()=>reviewCaptureHandoff(r,profile,20));}
});
