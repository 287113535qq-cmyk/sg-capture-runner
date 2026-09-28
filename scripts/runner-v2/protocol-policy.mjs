// Explicit incident contracts, not a caller-selectable generic recovery.
import assert from 'node:assert/strict';
export function protocolPolicy(gameId){
  const policy={
    32739:{id:'demon-32739-20260929',group:'primary',offset:0,complete:164,pending:6,
      specialBatch:5,specialSequence:432,next:{MSGID:'FREE_GAME'}},
    32836:{id:'quarterback-32836-20260929',group:'secondary',offset:20,complete:42,pending:1,
      specialBatch:2,specialSequence:113,next:{MSGID:'FEATURE_START',CFG:'2'}}
  }[gameId];
  assert(policy,'WRONG_PROTOCOL_RECOVERY');return policy;
}
