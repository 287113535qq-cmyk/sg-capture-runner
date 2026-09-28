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
  for(const modify of [f=>f.campaign.validationLimit=10,f=>f.campaign.enabled=false,f=>f.hold(),f=>f.other(),
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
