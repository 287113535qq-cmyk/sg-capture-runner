import test from 'node:test';
import assert from 'node:assert/strict';
import {preparedNextGameAllowed} from './prepared-next-game.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
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
