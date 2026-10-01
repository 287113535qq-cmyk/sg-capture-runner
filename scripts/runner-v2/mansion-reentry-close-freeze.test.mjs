import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';
test('Mansion repaired pilot close freezes 24 used and 76 foregone',()=>{assert.equal(hash(JSON.parse(fs.readFileSync('config/demo-close-mansion-reentry-20261001.json'))),'e93934eae2638eec400e95f4143ef00c494807783ecdd8233d459ec5e5ea42b7');});
