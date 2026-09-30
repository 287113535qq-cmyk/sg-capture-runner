import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {gameForShard} from './demo-sessions.mjs';

// New identity per reviewed formal activation and process owner. Registration
// still proves that every earlier batch is closed; this never resumes a session.
export function nextgenCountGame(base,plan,worker,owner){
 assert(plan.gameId===32721&&plan.runtimeGameId===33121&&plan.trialId==='sg_r1_20260928_32721'
  &&plan.phase===1&&plan.buy===0&&!plan.demoGeneration&&/^[a-f0-9]{64}$/.test(plan.countAllocation??'')
  &&Number.isInteger(worker)&&worker>=20&&worker<40
  &&/^\d+:1:[a-zA-Z0-9_-]+:[a-f0-9-]{36}$/.test(owner??''),'NEXTGEN_COUNT_SESSION_SCOPE');
 const game=gameForShard(base,worker,plan.trialId,plan);
 return {...game,sessionId:base.sessionId.slice(0,5)+createHmac('sha256',base.sessionId+'@'+base.operatorId)
  .update(`sg-nextgen-count-session-v1:${plan.trialId}:${plan.countAllocation}:${worker}:${owner}`).digest('hex').slice(0,32)};
}
