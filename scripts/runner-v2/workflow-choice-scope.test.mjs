import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('independent evidence closure profiles reach the validated controller without a stale enum',()=>{
 const text=fs.readFileSync('.github/workflows/demo-maintenance.yml','utf8').replace(/\r\n/g,'\n');
 const input=text.split('      evidence_profile:\n')[1].split(/\n      [a-z_]+:/)[0];
 assert(input.includes('type: string')&&!input.includes('options:'));
 assert(text.includes('SG_EVIDENCE_CLOSE_PROFILE: ${{ inputs.evidence_profile }}'));
 const control=fs.readFileSync('scripts/runner-v2/count-evidence-close-control.mjs','utf8');
 assert(control.includes('EVIDENCE_PROFILE_FILE')&&control.includes('EVIDENCE_CONTROL_SCOPE')
  &&control.includes('EVIDENCE_RUNTIME_CHANGED')&&control.includes('EVIDENCE_SOURCE_IDENTITY'));
});
test('source and no-source maintenance use explicit disabled choices, not empty enum members',()=>{
 for(const path of ['.github/workflows/trial-300k.yml','.github/workflows/demo-maintenance.yml']){
  const text=fs.readFileSync(path,'utf8');assert(!/options:\s*\[[^\]\n]*(?:''|"")/.test(text));
  assert(text.includes("SG_COUNT_RUNTIME_PROFILE: ${{ inputs.runtime_profile != 'none' && inputs.runtime_profile || '' }}")||text.includes("inputs.runtime_profile != 'none' && inputs.runtime_profile || ''"));
 }
 const source=fs.readFileSync('.github/workflows/trial-300k.yml','utf8').replace(/\r\n/g,'\n');
 assert(source.includes('options: [none, same-allocation-v1]'));
 assert(source.includes("type: string\n        default: ''"));
 assert(source.includes("inputs.formal_relay == 'same-allocation-v1'"));
});
