import test from 'node:test';
import assert from 'node:assert/strict';
import {preparedNextGameAllowed} from './prepared-next-game.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import fs from 'node:fs';
test('prepared next game requires its actual source permission and excludes bounded verification and same-game relay',async()=>{
 const profile={schema:'sg-prepared-count-profile-v1',trialId:'synthetic',activation:'a'.repeat(64)};
 const args={inputs:{role:'formal-count',formal_relay:'none'},profile,run:'123:1',commit:'b'.repeat(40)};
 const permit={schema:'sg-count-run-v1',run:args.run,commit:args.commit,activation:profile.activation,
  profileHash:hash(profile),captureMinutes:5,verificationWindow:true};
 args.store={get:async(_,key)=>{assert.equal(key,'count-run:synthetic:123:1');return {value:permit};}};
 assert.equal(await preparedNextGameAllowed(args),false);
 for(const minutes of [15,240]){permit.captureMinutes=minutes;permit.verificationWindow=false;assert.equal(await preparedNextGameAllowed(args),true);}
 assert.equal(await preparedNextGameAllowed({...args,inputs:{role:'formal-count',formal_relay:'same-allocation-v1'}}),false);
 assert.equal(await preparedNextGameAllowed({...args,profile:{schema:'legacy'}}),false);
 assert.equal(await preparedNextGameAllowed({...args,inputs:{role:'capture'}}),true);
 for(const field of ['run','commit','activation','profileHash']){
  const bad={...permit,[field]:'wrong'};
  await assert.rejects(preparedNextGameAllowed({...args,store:{get:async()=>({value:bad})}}),/SOURCE_PERMISSION/);
 }
 permit.verificationWindow=true;await assert.rejects(preparedNextGameAllowed(args),/NEXT_WINDOW/);
});
test('workflow keeps timers off while explicit prepared formal continuation reaches the independently protected controller',()=>{
 const workflow=fs.readFileSync('.github/workflows/trial-300k.yml','utf8');
 const next=workflow.split('- name: Continue next game with a fresh complete matrix')[1].split('- name: Stop scheduled continuation')[0];
 assert(next.includes("vars.SG_TRIAL_ENABLED == 'true' || (inputs.role == 'formal-count' && startsWith(inputs.formal_profile, 'formal-prepared-count-'))"));
 assert(next.includes('node scripts/runner-v2/continue-campaign.mjs'));
 const stop=workflow.split('- name: Stop scheduled continuation')[1];
 assert(stop.includes("&& !(inputs.role == 'formal-count' && startsWith(inputs.formal_profile, 'formal-prepared-count-'))"));
 // Scheduled capture remains guarded by the original disabled switch.
 assert(workflow.includes("github.event_name == 'schedule' && vars.SG_TRIAL_ENABLED == 'true'"));
});
