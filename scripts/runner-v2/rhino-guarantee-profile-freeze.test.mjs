import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {protocolHash as hash} from './protocol-resume.mjs';
test('applied Rhino repaired generation remains frozen',()=>{assert.equal(hash(JSON.parse(fs.readFileSync('config/demo-repair-rhino-guarantee-20261001.json'))),'d03dc36c60fa3bf208126fe7592d70ab16a74a32afe39844817fa160ac565433');});
