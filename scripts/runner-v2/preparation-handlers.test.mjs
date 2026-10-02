import test from 'node:test';import assert from 'node:assert/strict';
import {reviewedPreparation,preparationInputHash,preparationHandlers,preparationSourceHash} from './preparation-handlers.mjs';
import {preparationGates} from './preparation-inventory.mjs';
import fs from 'node:fs';
const revisionHash='a'.repeat(64);
const receipts=()=>preparationGates.map(gate=>({schema:'sg-preparation-gate-v1',gameId:32719,gate,revisionHash,verified:true,sourceAllowance:0,supportingHashes:['b'.repeat(64)]}));
test('reusable code identities agree across Windows and Linux without normalizing raw game replies',()=>{
 assert.equal(preparationSourceHash('code\r\nnext\r\n'),preparationSourceHash('code\nnext\n'));
 assert.notEqual(preparationSourceHash('code\n'),preparationSourceHash('changed\n'));
});
test('fixed handlers match the actual game catalog and executable check files',()=>{
 const games=JSON.parse(fs.readFileSync('config/games.json'));
 assert.equal(games.find(g=>g.gameId===32739).name,'The Demon Code');
 assert.equal(games.find(g=>g.gameId===32820).name,'Beaver Las Vegas');
 assert(preparationHandlers[32739].python.every(p=>p.includes('demon')));
 assert(preparationHandlers[32820].python.every(p=>p.includes('beaver')));
 for(const h of Object.values(preparationHandlers))for(const p of [...h.node,...h.python.map(n=>'service/tests/'+n)])assert(fs.existsSync(p),p);
});
test('all independent gates admit without a gameplay classification; missing or conflicting receipt never admits',()=>{
 assert.equal(reviewedPreparation({gameId:32719,revisionHash,receipts:receipts()}).status,'prepared');
 for(const gate of preparationGates){const rows=receipts().filter(r=>r.gate!==gate);assert.deepEqual(reviewedPreparation({gameId:32719,revisionHash,receipts:rows}).missingGates,[gate]);}
 assert.equal(reviewedPreparation({gameId:32719,revisionHash,receipts:[...receipts(),receipts()[0]]}).status,'blocked');
 assert.equal(reviewedPreparation({gameId:32719,revisionHash:'c'.repeat(64),receipts:receipts()}).status,'blocked');
});
test('continuous checks rerun for content changes, never for unchanged mtimes or classification',()=>{
 const args={gameId:32719,reference:{route:'reviewed'},fileHashes:{'a.py':'1'},evidenceHashes:['2']};
 const initial=preparationInputHash(args);assert.equal(initial,preparationInputHash(structuredClone(args)));
 assert.notEqual(initial,preparationInputHash({...args,fileHashes:{'a.py':'3'}}));
 assert.notEqual(initial,preparationInputHash({...args,evidenceHashes:['4']}));
 assert(preparationHandlers[32719].node.length>0);assert.equal(preparationHandlers[32775],undefined);
});
