import assert from 'node:assert/strict';
import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
export const PYRAMIDS_LEGACY_HASH='72b7cdcaef7ef9ccfab1a417476bf420946d06efef4580fe840934cb2f87bb8b';
export function checkSecondaryNextProfile(p,plan){
 assert(p?.schema==='sg-demo-next-game-v1'&&p.group==='secondary'&&p.workerOffset===20
  &&p.gameId===32721&&p.fromGameId===32719&&plan.gameId===32721&&plan.runtimeGameId===33121
  &&plan.trialId==='sg_r1_20260928_32721'&&plan.buy===0&&plan.phase===1&&plan.target===299850
  &&p.sourceClosureHash==='6c4638ed879867f611a3aeffb6e97a40ba2b8cdeaa90d211f669711549c4425c'
  &&p.sourceRunKey==='capture-run:36765916285:1'&&p.completePreserved===1262&&p.abandonedAttempts===4
  &&p.newBetAllowance===100&&p.perWorker===5&&p.workers===20&&!p.sourceFormal&&!p.repairedCandidate&&!p.emptyCandidate,'SECONDARY_NEXT_SCOPE');
 const fixed=JSON.parse(fs.readFileSync('config/parked-pyramids-20261001.json','utf8')),s=p.legacyImport;
 assert(hash(fixed)==='c29872c827b7cd192d7424bf46b17108a173ee3175c9aa291299010e0cf7ba28'&&fixed.schema==='sg-pyramids-fixed-legacy-v1'&&fixed.gameId===plan.gameId&&fixed.planHash===hash(plan)
  &&fixed.archiveHash===PYRAMIDS_LEGACY_HASH&&fixed.complete===1262&&fixed.mongoCount===1102&&fixed.pending===4
  &&fixed.workerOffset===20&&fixed.batches.length===27&&s?.fixedLegacyHash===hash(fixed)
  &&s.archiveHash===fixed.archiveHash&&s.bytes===fixed.bytes&&s.complete===fixed.complete
  &&s.mongoCount===fixed.mongoCount&&s.pending===fixed.pending,'SECONDARY_NEXT_ARCHIVE_SCOPE');
 return fixed;
}
