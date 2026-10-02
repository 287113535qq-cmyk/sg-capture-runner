import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

test('applied Super Free cash-coin repair admission keeps the original remaining target and closed parent',()=>{
 const profile=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-super-coins-20261002.json','utf8'));
 assert.equal(hash(profile),'758c973008b947c479c083b7eae4d1592fd23ae16022891162a17f1e015dc094');
 assert.equal(profile.completePreserved,8391);
 assert.equal(profile.remainingComplete,291459);
 assert.equal(profile.sourceRun,'36961087858:1');
 assert.equal(profile.recordsHash,'f776cc0581b6e43c96d72987a1ceaf56ec24470933566cbb44229fdb284bbef1');
});
