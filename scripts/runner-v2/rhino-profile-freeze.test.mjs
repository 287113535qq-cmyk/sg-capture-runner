import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';
test('applied Rhino pilot and 52 used plus 48 foregone close remain frozen',()=>{
 for(const [name,h]of [['demo-pilot-rhino-20261001.json','276a16364c16997f1279826a30a559ce611f411897d0a3e48530c61a792f8715'],['demo-close-rhino-20261001.json','1b39ed25a0998be577f30abc97b37cade06e31afd2f489969548c91920c25766']])assert.equal(hash(JSON.parse(fs.readFileSync('config/'+name,'utf8'))),h);
});
