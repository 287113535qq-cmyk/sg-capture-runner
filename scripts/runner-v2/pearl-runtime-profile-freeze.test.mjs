import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied zero-source Pearl runtime correction cannot reset allocation or its failure identity',()=>{
 const p=JSON.parse(fs.readFileSync('config/formal-runtime-pearl-20260930.json','utf8'));
 assert.equal(hash(p),'9a5be043fb51ef8e01db7f41e80831eddbb55d8b2050f744ee4bf226d034141b');
 assert.equal(p.sourceRun,'36728815536:1');assert.equal(p.fromCommit,'7200e7b74df1eb29e86c0b74d1940dfab2449557');
 assert.equal(p.profileHash,'cdc311002ba6b1ad78948ea7114458e9217466ad58032da627a68b680c8050c5');
 assert.equal(p.activation,'efd6874b4fec039bb420030b34bcce06213bdd12fbfbd8c83d85f8a0a6ca7c18');
});
