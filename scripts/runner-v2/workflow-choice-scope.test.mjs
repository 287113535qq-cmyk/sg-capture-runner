import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('source and no-source maintenance use explicit disabled choices, not empty enum members',()=>{
 for(const path of ['.github/workflows/trial-300k.yml','.github/workflows/demo-maintenance.yml']){
  const text=fs.readFileSync(path,'utf8');assert(!/options:\s*\[[^\]\n]*(?:''|"")/.test(text));
  assert(text.includes("SG_COUNT_RUNTIME_PROFILE: ${{ inputs.runtime_profile != 'none' && inputs.runtime_profile || '' }}")||text.includes("inputs.runtime_profile != 'none' && inputs.runtime_profile || ''"));
 }
 const source=fs.readFileSync('.github/workflows/trial-300k.yml','utf8');
 assert(source.includes('options: [none, same-allocation-v1]'));
 assert(source.includes("type: string\n        default: ''"));
 assert(source.includes("inputs.formal_relay == 'same-allocation-v1'"));
});
