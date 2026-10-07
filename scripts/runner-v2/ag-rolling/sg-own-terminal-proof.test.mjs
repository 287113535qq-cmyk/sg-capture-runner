import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {ownTerminalProof} from './sg-own-terminal.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {rebaseResumeManifest} from './sg-resume-manifest.mjs';
const book=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')),corpus=[];
for(const game of ['32708','32715']){
 test(`resume ${game} preserves own campaign, quota and old data through exact proof`,()=>{
  const plan=book.plans[game],proof=book.proofs[game],{previousPlan,previousProof}=ownTerminalProof(plan,proof);
  const entry={gameId:game,planHash:queueHash(previousPlan),adapterProofHash:queueHash(previousProof),campaignId:'same-campaign',target:300000,baseline:12783};
  const f={previous:{manifest:[entry]},previousPlans:{plans:{[game]:previousPlan},proofs:{[game]:previousProof}},plans:{plans:{[game]:plan},proofs:{[game]:proof}}};
  const before=queueHash(f),expected={...entry,planHash:queueHash(plan),adapterProofHash:queueHash(proof)};
  assert.deepEqual(rebaseResumeManifest(f),[expected]);assert.equal(queueHash(f),before);
  assert.throws(()=>rebaseResumeManifest({...f,completedGameIds:[game]}),/COMPLETED_ADAPTER_CHANGED/);
  const x=structuredClone(f);x.previousPlans.proofs[game].acceptedBaseRounds--;x.previous.manifest[0].adapterProofHash=queueHash(x.previousPlans.proofs[game]);
  assert.throws(()=>rebaseResumeManifest(x));corpus.push({plan,proof,accepted:true});
 });
 test(`proof ${game} rejects borrowed history, evidence, counts and altered old proof`,()=>{
  const p=book.plans[game];
  for(const damage of [x=>x.ownTerminalEvidence.previousProofHash='f'.repeat(64),x=>x.ownTerminalEvidence.nativeEvidenceHash='e'.repeat(64),
   x=>x.ownTerminalEvidence.ordinaryRows=99,x=>x.acceptedBaseRounds--,x=>x.ownTerminalEvidence.wiringEvidence.actualCodecPythonRecordAndVerify=false,
   x=>{x.ownTerminalEvidence.wiringEvidence.ordinaryRows=99;const w=x.ownTerminalEvidence.wiringEvidence;delete w.evidenceHash;w.evidenceHash=queueHash(w);},
   x=>x.ownTerminalEvidence.failedRoundsCredited=1]){
   const proof=structuredClone(book.proofs[game]);damage(proof);assert.throws(()=>ownTerminalProof(p,proof));corpus.push({plan:p,proof,accepted:false});
  }
 });
}
test('independent Python proof gate matches all genuine and damaged bindings',()=>{
 const py=process.env.SG_TEST_PYTHON??'python3';
 const p=spawnSync(py,['-B','-c',`import json,sys
sys.path.insert(0,'service')
from own_terminal_fields import validate_proof
out=[]
for x in json.load(sys.stdin):
 try:validate_proof(x['plan'],x['proof']);out.append(True)
 except Exception:out.append(False)
print(json.dumps(out))`],{input:JSON.stringify(corpus),encoding:'utf8',timeout:20000});
 assert.equal(p.status,0,p.stderr);assert.deepEqual(JSON.parse(p.stdout),corpus.map(x=>x.accepted));
});
