import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied Super Coin close preserves 8391 records and never reissues an interrupted request',()=>{
 const p=JSON.parse(fs.readFileSync('config/count-close-pyramids-super-coin-20261002.json','utf8'));
 assert.equal(hash(p),'a8ec5be2ba5d9dcb9f270387f0a07dcbead444e82d266c321cd96e09a5e234d8');
 assert.equal(p.completePreserved,8391);assert.equal(p.sourceAllowance,0);assert.equal(p.abandonedAlready,1);
 assert.equal(p.sourceRun,'36961087858:1');assert.equal(p.recordsHash,'f776cc0581b6e43c96d72987a1ceaf56ec24470933566cbb44229fdb284bbef1');
});
