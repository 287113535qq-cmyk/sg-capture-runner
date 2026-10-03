import test from 'node:test';
import assert from 'node:assert/strict';
import {continueAfterGame} from './continue-core.mjs';
function fixture(){
  const campaign={enabled:true,validationLimit:0,games:[{game_id:1,status:'complete'},{game_id:2,status:'ready'}]};
  let created=false,dispatched=0,hold=false,other=false;
  return {campaign,dispatches:()=>dispatched,hold:()=>{hold=true;},other:()=>{other=true;},args:{runId:'123',attempt:'1',
    store:{get:async(c,k)=>({value:k==='campaign'?campaign:{gameId:1}}),writable:async()=>{}},
    transport:{request:async(op)=>{if(op==='global_holds')return [{value:{active:hold}},{value:{active:false}}];assert.equal(op,'create');const old=created;created=true;return {created:!old};}},
    github:{hasOtherRun:async()=>other,dispatch:async()=>{dispatched++;}}}};
}
test('whole-matrix continuation occurs once, and never for short capture, holds or existing queue',async()=>{
  for(const modify of [f=>f.campaign.validationLimit=10,f=>f.campaign.protocolValidation=true,f=>f.campaign.enabled=false,f=>f.hold(),f=>f.other(),
    f=>f.campaign.games[0].status='active',f=>f.campaign.games[1].status='needs-adapter']){
    const f=fixture();modify(f);assert.equal((await continueAfterGame(f.args)).continued,false);assert.equal(f.dispatches(),0);
  }
  const f=fixture();assert.equal((await continueAfterGame(f.args)).continued,true);
  assert.equal((await continueAfterGame(f.args)).continued,false);assert.equal(f.dispatches(),1);
});
test('uncertain dispatch is not resent automatically',async()=>{
  const f=fixture();let calls=0;f.args.github.dispatch=async()=>{calls++;throw Error('ACK_UNKNOWN');};
  await assert.rejects(continueAfterGame(f.args));assert.equal((await continueAfterGame(f.args)).continued,false);assert.equal(calls,1);
});

test('a parked protocol game continues once to the next ready game without reopening its source grant',async()=>{
  const f=fixture();f.campaign.games[0].status='parked-protocol';
  assert.equal((await continueAfterGame(f.args)).continued,true);
  assert.equal(f.campaign.games[0].status,'parked-protocol');
  assert.equal((await continueAfterGame(f.args)).continued,false);
  const short=fixture();short.campaign.games[0].status='parked-protocol';short.campaign.validationLimit=5;
  assert.equal((await continueAfterGame(short.args)).continued,false);
});

test('real continuation consumes the independent prepared selector before creating any dispatch intent',async()=>{
 const f=fixture();f.campaign.games[0].status='parked-protocol';
 f.args.group='primary';let checks=0;
 f.args.preparedSelector=async({group,readyGameIds})=>{checks++;assert.equal(group,'primary');assert.deepEqual(readyGameIds,[2]);return null;};
 assert.equal((await continueAfterGame(f.args)).reason,'PREPARED_INVENTORY_EMPTY');assert.equal(f.dispatches(),0);
 f.args.preparedSelector=async()=>2;assert.equal((await continueAfterGame(f.args)).continued,true);assert.equal(f.dispatches(),1);assert.equal(checks,1);
 const foreign=fixture();foreign.args.preparedSelector=async()=>3;await assert.rejects(continueAfterGame(foreign.args),/NOT_ADMITTED/);assert.equal(foreign.dispatches(),0);
});

test('continuation validates the next ledger before intent and binds dispatch inputs without retrying unknown acknowledgements',async()=>{
 const f=fixture();f.args.preparedSelector=async()=>2;
 f.args.prepareDispatch=async()=>{throw Error('COUNT_AUTHORIZATION');};
 await assert.rejects(continueAfterGame(f.args),/COUNT_AUTHORIZATION/);assert.equal(f.dispatches(),0);
 const inputs={role:'formal-count',formal_profile:'registered.json'};let received;
 f.args.prepareDispatch=async()=>inputs;f.args.github.dispatch=async value=>{received=value;throw Error('ACK_UNKNOWN');};
 await assert.rejects(continueAfterGame(f.args),/ACK_UNKNOWN/);assert.deepEqual(received,inputs);
 assert.equal((await continueAfterGame(f.args)).reason,'DISPATCH_ALREADY_ATTEMPTED');
});
