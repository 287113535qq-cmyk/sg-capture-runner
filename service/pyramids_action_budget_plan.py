"""Independent resource authorization; never upgrades the applied parent."""
import re
from store import require, digest
from pyramids_action_fields import ACTION_VERSION, CONTRACT_HASH


def pyramids_action_budget_plan(base, p):
    required = {
        'schema':'sg-formal-action-budget-profile-v1','gameId':32721,'group':'secondary','workerOffset':20,
        'basePlanHash':digest(base),'completePreserved':49593,'remainingComplete':250257,'historicalBaseline':150,
        'totalTarget':300000,'maxSequence':600000,'sessionRotation':'closed-batches-v1','sourceAllowance':0,
        'oldProfileHash':'c86e5cb9a5c68b9952497503accbdd107c3f89d86395063513c77914b377355b',
        'sourceRun':'36973608232:1','sourceCommit':'9aafef9ac94300c02ce74bb83db7eb97dfcef00d',
        'retirementKey':'count-shared-close:sg_r1_20260928_32721:36973608232:1:complete',
        'retirementHash':'25ca1a912e0c94f80ca4bf2ba735f442302441da92345e1dadd9bac90397a32a',
        'nativeRetirementHash':'7f6ab90a6fab39b0e7c045fecaf0201b6550b09b4d4ce0cc65af6fdcee63516e',
        'closureProfileHash':'796e445b4dd8f20e1e8c7500d01d9c899b725526781ba7f809842eff48c39468',
        'recordsHash':'e448065b7a853be8a0f9fa269ca367858945453b5c14b1f9af277dc4b7f05cc7',
        'oldSpecHash':'21e39490c85e4653474db892a6485cf21ad9865ef08ea65afdffbf36823d8307',
        'controlReadMode':'compact-worker-v1','stateWriteMode':'versioned-delta-v1',
        'gatewayHash':'a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e',
        'featureProfile':ACTION_VERSION,'actionContractHash':CONTRACT_HASH,'classificationMode':'independent-journal',
        'actionResourceBudget':{'maxFrames':1026,'maxRawBytes':4194304},
        'canary':{'captureMinutes':5,'observationMinutes':5,'maxWorkers':20,'maxBatchesPerWorker':1,
                  'maxPaidPerWorker':100,'maxPaidRequests':2000,'lanesPerHost':1,
                  'automaticRelay':False,'requiresNewSession':True}}
    require(base.get('gameId') == 32721 and base.get('trialId') == 'sg_r1_20260928_32721'
            and base.get('phase') == 1 and base.get('buy') == 0 and base.get('target') == 299850
            and all(p.get(k) == v for k, v in required.items()) and isinstance(p.get('activation'), str)
            and re.fullmatch(r'[a-f0-9]{64}', p['activation']), 'ACTION_BUDGET_SCOPE')
    plan = {**base, 'countAllocation':p['activation'], 'featureProfile':ACTION_VERSION,
            'actionContractHash':CONTRACT_HASH, 'maxSteps':1026,
            'actionResourceBudget':dict(required['actionResourceBudget'])}
    require(digest(plan) == p.get('planHash') and not plan.get('demoGeneration')
            and not plan.get('sessionLayout'), 'ACTION_BUDGET_PLAN')
    return plan
