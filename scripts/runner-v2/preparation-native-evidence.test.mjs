import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {nativePreparationEvidence} from './preparation-native-evidence.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

test('native installation proof binds original bytes, exact scope and plan; missing games cannot acquire scope or source', () => {
  const plan = {gameId: 32719, runtimeGameId: 33119, trialId: 'fixture', target: 299900,
    database: 'sg_capture_staging_v1', productionGamePoolWrites: false};
  const manifest = {schema: 'sg-mongo-only-access-v2', database: 'sg_capture_staging_v1',
    legacyExportEnabled: false, metadataWritesEnabled: true, roundWritesEnabled: true,
    trials: {fixture: {gameId: 32719, runtimeGameId: 33119, target: 299900, group: 'secondary'}}};
  const manifestBytes = Buffer.from(JSON.stringify(manifest)), expectedGatewayHash = 'a'.repeat(64);
  const review = {manifestSHA: createHash('sha256').update(manifestBytes).digest('hex'), gatewaySHA: expectedGatewayHash,
    sourceRequests: 0, mongoWrites: 0, at: 1};
  const input = {root: process.cwd(), index: {games: []}, plans: {32719: plan}, manifestBytes, review, expectedGatewayHash};
  const result = nativePreparationEvidence(input);
  assert.equal(result.receipts.length, 1); assert.equal(result.rejected.length, 8);
  assert.equal(result.receipts[0].gate, 'native'); assert.deepEqual(result.bindings[32719], {group: 'secondary', planHash: hash(plan)});
  assert.equal(result.newBetAllowance, 0);
  assert.throws(() => nativePreparationEvidence({...input, manifestBytes: Buffer.from('{}')}), /PREPARATION_NATIVE_READBACK/);
  assert.throws(() => nativePreparationEvidence({...input, review: {...review, mongoWrites: 1}}), /PREPARATION_NATIVE_READBACK/);
  assert.equal(nativePreparationEvidence({...input, plans: {32719: {...plan, runtimeGameId: 1}}}).receipts.length, 0);
  assert.equal(nativePreparationEvidence({...input, plans: {32719: {...plan, target: 300000}}}).receipts.length, 0);
});
test('Mansion prepared count ceiling preserves original base binding and grants no source permission',()=>{
 const plan={gameId:32714,runtimeGameId:33114,trialId:'sg_r1_20260928_32714',target:299900,
  database:'sg_capture_staging_v1',productionGamePoolWrites:false};
 const manifest={schema:'sg-mongo-only-access-v2',legacyExportEnabled:false,metadataWritesEnabled:true,
  roundWritesEnabled:true,trials:{[plan.trialId]:{gameId:32714,runtimeGameId:33114,target:300000,maxSequence:600000,group:'primary'}}};
 const check=m=>{
  const manifestBytes=Buffer.from(JSON.stringify(m)),expectedGatewayHash='a'.repeat(64);
  return nativePreparationEvidence({root:process.cwd(),index:{games:[]},plans:{32714:plan},manifestBytes,
   review:{manifestSHA:createHash('sha256').update(manifestBytes).digest('hex'),gatewaySHA:expectedGatewayHash,sourceRequests:0,mongoWrites:0},expectedGatewayHash});
 };
 const r=check(manifest);assert.equal(r.receipts.length,1);assert.equal(r.newBetAllowance,0);
 assert.equal(r.bindings[32714].planHash,hash(plan));
 for(const bad of [{maxSequence:600001},{target:600000},{runtimeGameId:33118}]){
  const m=structuredClone(manifest);Object.assign(m.trials[plan.trialId],bad);assert.equal(check(m).receipts.length,0);
 }
});
