import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('MorePuff AG closure freezes39 spent including1 abandoned and61 foregone with no new source quota',()=>{
 const p=JSON.parse(fs.readFileSync('config/demo-close-morepuff-20260930.json','utf8'));
 assert.equal(hash(p),'f9a661e3f1cc602285c9f1fe48a5f7775ac5a41d8de01276452a37eb3f7be346');
 assert.equal(p.newBetAllowance,0);assert.equal(p.completePreserved,91);
 assert.equal(p.usedByWorker.reduce((a,b)=>a+b,0),39);assert.equal(p.completeByWorker.reduce((a,b)=>a+b,0),38);
 assert.equal(p.sourceRunKey,'capture-run:36684942513:1');
 assert.equal(p.sourceProfileHash,'9ed50c4e0376120e8a8f2a78a441c72e9a9b231498c7b0094202135076051ead');
});
