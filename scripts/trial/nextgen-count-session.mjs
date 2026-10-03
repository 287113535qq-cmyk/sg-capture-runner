import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {gameForShard} from './demo-sessions.mjs';
import fs from 'node:fs';
import {protocolHash as hash} from '../runner-v2/protocol-resume.mjs';
import {preparedCountPlan} from '../runner-v2/prepared-count-plan.mjs';
import {preparedCountAuthorization} from '../runner-v2/prepared-count-authorization.mjs';

function preparedOwner(plan,worker,read){
 const name=`formal-prepared-count-${plan.gameId}-${plan.countAllocation}.json`;
 const authorization=preparedCountAuthorization(name,read),profile=read('config/'+name);
 const base=read('config/round-one-plans.json')[plan.gameId];
 assert(hash(preparedCountPlan(base,profile,authorization))===hash(plan),'NEXTGEN_COUNT_PREPARED_PLAN');
 const first=profile.group==='primary'?0:20;
 assert(worker>=first&&worker<first+20,'NEXTGEN_COUNT_PREPARED_OWNER');
}

// New identity per reviewed formal activation and process owner. Registration
// still proves that every earlier batch is closed; this never resumes a session.
export function nextgenCountGame(base,plan,worker,owner,read=file=>JSON.parse(fs.readFileSync(file,'utf8'))){
 assert(plan.phase===1&&plan.buy===0&&!plan.demoGeneration&&/^[a-f0-9]{64}$/.test(plan.countAllocation??'')
  &&Number.isInteger(worker)&&worker>=0&&worker<40
  &&/^\d+:1:[a-zA-Z0-9_-]+:[a-f0-9-]{36}$/.test(owner??''),'NEXTGEN_COUNT_SESSION_SCOPE');
 if(plan.gameId===32721){
  assert(plan.runtimeGameId===33121&&plan.trialId==='sg_r1_20260928_32721'
   &&worker>=20&&worker<40,'NEXTGEN_COUNT_SESSION_SCOPE');
 }else preparedOwner(plan,worker,read);
 const game=gameForShard(base,worker,plan.trialId,plan);
 return {...game,sessionId:base.sessionId.slice(0,5)+createHmac('sha256',base.sessionId+'@'+base.operatorId)
  .update(`sg-nextgen-count-session-v1:${plan.trialId}:${plan.countAllocation}:${worker}:${owner}`).digest('hex').slice(0,32)};
}
