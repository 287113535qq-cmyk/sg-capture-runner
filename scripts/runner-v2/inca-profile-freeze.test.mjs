import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {protocolHash} from './protocol-resume.mjs';

test('applied Inca pilot, zero-source correction and closure remain immutable',()=>{
  const profiles={
    'demo-pilot-inca-20261001.json':'b785d28c1ce4cf6bc855a202ee6f6fdd9a8e274ac7f33e1f7be068eaed148c82',
    'demo-runtime-inca-20261001.json':'f380dafa349a356faec70a24774c4e9114ea240ef6b7048512033aae91dd1ec0',
    'demo-close-inca-20261001.json':'9a7ebcab33b0d3398b7f9ccd5ab6b62451439e8a3ebd852149746b84763e0fbd',
  };
  for(const [name,hash] of Object.entries(profiles))
    assert.equal(protocolHash(JSON.parse(fs.readFileSync(new URL('../../config/'+name,import.meta.url)))),hash);
});
