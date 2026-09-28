import test from 'node:test';
import assert from 'node:assert/strict';
import {canContinueAfterChildFailure as next} from './campaign-continuation.mjs';
const protocol={protocolParkingEnabled:true,globalPaused:false,activeGame:32714,reason:'ACTIVE_GAME_REQUIRES_REVIEW'};
test('only formal capture may continue after its protocol stop',()=>{
  assert.equal(next(protocol,32714,'0'),true);
  assert.equal(next(protocol,32714,'10'),false);
  assert.equal(next(protocol,32717,'0'),false);
  assert.equal(next({...protocol,protocolParkingEnabled:false},32714,'0'),false);
});
test('a late worker joins the next game only after the old one is parked',()=>{
  assert.equal(next({...protocol,activeGame:32720,reason:null,parkedGames:[32714]},32714,'0'),true);
  assert.equal(next({...protocol,activeGame:32720,reason:null,parkedGames:[]},32714,'0'),false);
});
test('global storage/source/disk stops always win over parking',()=>{
  assert.equal(next({...protocol,globalPaused:true,parkedGames:[32714]},32714,'0'),false);
  assert.equal(next({...protocol,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW'},32714,'0'),false);
});
