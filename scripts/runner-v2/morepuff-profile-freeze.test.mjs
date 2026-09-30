import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

test('applied More Puff profile remains immutable after interrupted pilot',()=>{
  const p=JSON.parse(fs.readFileSync('config/demo-pilot-morepuff-20260930.json','utf8'));
  assert.equal(hash(p),'9ed50c4e0376120e8a8f2a78a441c72e9a9b231498c7b0094202135076051ead');
  assert.equal(p.generation,'2ee463dade385a4e63b0e7b9a29d1ebbf0c69c64fdaf9ae95aaeec4c2f5d1b41');
  assert.equal(p.newBetAllowance,100);
  assert.equal(p.sourceClosureHash,'84fb63256be091668eb73ecfd3fea13bec38ae651118e8d4b408a53a188f2c6f');
});
