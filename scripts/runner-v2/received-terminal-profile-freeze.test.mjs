import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied received terminal closure preserves299 complete with zero discarded terminal or new source quota',()=>{
 const p=JSON.parse(fs.readFileSync('config/count-close-prepared-evidence-20261003-terminal-ledger.json','utf8'));
 assert.equal(hash(p),'c9f1c13284b3d504b29a174cd75af4b25f7ffa72a021b2cfd3bf4b89e635978b');
 assert.equal(p.sourceRun,'37113408307:1');assert.equal(p.completePreserved,299);
 assert.equal(p.abandonedAttempts,0);assert.equal(p.sourceAllowance,0);assert.equal(p.terminalRecords.length,1);
});
