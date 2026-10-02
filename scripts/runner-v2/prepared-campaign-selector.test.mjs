import test from 'node:test';import assert from 'node:assert/strict';
import {publishedPreparedSelector} from './prepared-campaign-selector.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {newInventory,preparationGates,claimPreparation,finishPreparation} from './preparation-inventory.mjs';
test('online published consumer fences exact plan, evidence and ownership; semantics are not a gate',async()=>{
 const evidence={},proof={schema:'sg-reusable-preparation-v1',gameId:2,sourceAllowance:0,revisionHash:'a'.repeat(64),gates:{}},refs={};
 for(const gate of preparationGates){const e={gameId:2,revisionHash:proof.revisionHash,gate,verified:true};const ref='config/preparation-evidence/'+hash(e)+'.json';refs[gate]=ref;evidence[ref]=e;proof.gates[gate]={verified:true,evidenceHash:hash(e)};}
 const inventory=newInventory([{gameId:2,name:'test'}]),claim=claimPreparation(inventory,{owner:'test',now:0});finishPreparation(inventory,claim,{status:'prepared',proof},1);
 const plans={2:{gameId:2,trialId:'fixture',target:100}};
 const publication={schema:'sg-prepared-publication-v1',sourceAllowance:0,inventory,bindings:{2:{group:'primary',planHash:hash(plans[2]),proofHash:hash(proof),evidence:refs}}};
 const select=()=>publishedPreparedSelector({publication,plans,readEvidence:async ref=>evidence[ref]});
 assert.equal(await select()({readyGameIds:[2],group:'primary'}),2);
 assert.equal(await select()({readyGameIds:[2],group:'secondary'}),null);
 assert.equal(await select()({readyGameIds:[],group:'primary'}),null);
 evidence[refs.settlement].verified=false;assert.equal(await select()({readyGameIds:[2],group:'primary'}),null);
});
