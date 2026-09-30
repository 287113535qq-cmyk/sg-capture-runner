import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {checkSecondaryNextProfile} from './secondary-next-profile.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
const fixed=JSON.parse(fs.readFileSync('config/parked-pyramids-20261001.json','utf8')),plan=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))[32721];
const candidate=()=>({schema:'sg-demo-next-game-v1',group:'secondary',workerOffset:20,gameId:32721,fromGameId:32719,
 sourceClosureHash:'6c4638ed879867f611a3aeffb6e97a40ba2b8cdeaa90d211f669711549c4425c',sourceRunKey:'capture-run:36765916285:1',
 completePreserved:1262,abandonedAttempts:4,newBetAllowance:100,perWorker:5,workers:20,
 legacyImport:{fixedLegacyHash:hash(fixed),archiveHash:fixed.archiveHash,bytes:fixed.bytes,complete:1262,mongoCount:1102,pending:4}});
test('secondary next binds the closed Inca source and exact Pyramids archive without expanding other games',()=>{
 assert.deepEqual(checkSecondaryNextProfile(candidate(),plan),fixed);
 for(const change of [{gameId:32719},{fromGameId:32718},{group:'primary'},{workerOffset:0},{sourceClosureHash:'0'.repeat(64)},
  {sourceRunKey:'capture-run:1:1'},{completePreserved:1261},{abandonedAttempts:3},{newBetAllowance:171},{sourceFormal:true},{repairedCandidate:true}])
  assert.throws(()=>checkSecondaryNextProfile({...candidate(),...change},plan));
 for(const change of [{fixedLegacyHash:'0'.repeat(64)},{bytes:fixed.bytes+1},{mongoCount:1101},{pending:3},{archiveHash:'0'.repeat(64)}]){
  const p=candidate();Object.assign(p.legacyImport,change);assert.throws(()=>checkSecondaryNextProfile(p,plan));
 }
 for(const change of [{target:299900},{runtimeGameId:33119},{buy:1},{trialId:'other'}])assert.throws(()=>checkSecondaryNextProfile(candidate(),{...plan,...change}));
});
