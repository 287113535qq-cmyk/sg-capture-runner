import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

test('applied Mansion profile retains its independent generation and allowance',()=>{
  const p=JSON.parse(fs.readFileSync('config/demo-pilot-mansion-20260930.json','utf8'));
  assert.equal(hash(p),'f7d70be05456a74883a1adc1b0d691d27be07d79f2845d5b799d681afed04741');
  assert.equal(p.generation,'5fdf8176e3e509055cf642aae40a3676e3c91efc90e442ef87a4206a9525de81');
  assert.equal(p.newBetAllowance,100);
  assert.equal(p.sourceClosureHash,'73a71436e57a076bfba810b3bcd35f52afb76c1c32b26d0ad7ed8b0aecf438e4');
});
