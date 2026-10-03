import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparationRevision} from './preparation-revision.mjs';
import {preparationHandlers} from './preparation-handlers.mjs';

// Review bytes already obtained through the fixed read-only manifest path.
// This is reusable installation evidence, not a live resource/source permit.
export function nativePreparationEvidence({root, index, plans, manifestBytes, review, expectedGatewayHash}) {
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  assert(review?.sourceRequests === 0 && review.mongoWrites === 0
    && review.manifestSHA === createHash('sha256').update(manifestBytes).digest('hex')
    && /^[a-f0-9]{64}$/.test(expectedGatewayHash) && review.gatewaySHA === expectedGatewayHash,
    'PREPARATION_NATIVE_READBACK');
  assert(manifest.schema === 'sg-mongo-only-access-v2' && manifest.legacyExportEnabled === false
    && manifest.metadataWritesEnabled === true && manifest.roundWritesEnabled === true
    && (manifest.database === undefined || manifest.database === 'sg_capture_staging_v1'), 'PREPARATION_NATIVE_BOUNDARY');
  const receipts = [], bindings = {}, rejected = [];
  for (const gameId of Object.keys(preparationHandlers).map(Number)) {
    const plan = plans[gameId], scope = manifest.trials?.[plan?.trialId];
    const preparedCountScope=gameId===32714&&plan?.trialId==='sg_r1_20260928_32714'
      &&plan.target===299900&&scope?.target===300000&&scope.maxSequence===600000;
    if (!plan || !scope || scope.gameId !== gameId || scope.runtimeGameId !== plan.runtimeGameId
      || (scope.target !== plan.target&&!preparedCountScope) || !['primary', 'secondary'].includes(scope.group)
      || plan.database !== 'sg_capture_staging_v1' || plan.productionGamePoolWrites !== false) {
      rejected.push({gameId, reason: 'PREPARATION_NATIVE_FIXED_SCOPE_MISSING'}); continue;
    }
    const {revisionHash} = preparationRevision(root, gameId, index.games.find(g => g.gameId === gameId));
    receipts.push({schema: 'sg-preparation-gate-v1', gate: 'native', gameId, revisionHash,
      verified: true, sourceAllowance: 0, supportingHashes: [review.manifestSHA, review.gatewaySHA, hash(plan)],
      nativeScope: {trialId: plan.trialId, ...scope}, reviewedAt: review.at});
    bindings[gameId] = {planHash: hash(plan), group: scope.group};
  }
  return {receipts, bindings, rejected, sourceRequests: 0, mongoWrites: 0, newBetAllowance: 0};
}
