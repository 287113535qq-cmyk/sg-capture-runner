import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied Pearl formal activation preserves its pilot credit and immutable authorization',()=>{
 const p=JSON.parse(fs.readFileSync('config/formal-count-pearl-20260930.json','utf8'));
 assert.equal(hash(p),'cdc311002ba6b1ad78948ea7114458e9217466ad58032da627a68b680c8050c5');
 assert.equal(p.activation,'efd6874b4fec039bb420030b34bcce06213bdd12fbfbd8c83d85f8a0a6ca7c18');
 assert.equal(p.completePreserved,100);assert.equal(p.remainingComplete,299900);
 assert.equal(p.maxSequence,600000);assert.equal(p.sourceRunKey,'capture-run:36724417766:1');
 assert.equal(p.sourceProfileHash,'135cf98bdca0329fa370a8d48dabc1246222d564e6e2f5090f5310410b94db73');
});
