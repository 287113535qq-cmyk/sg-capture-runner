"""Independent resource authorization; never upgrades the applied parent."""
import re
from store import require, digest
from pyramids_resume_action_fields import ACTION_VERSION, CONTRACT_HASH


def pyramids_resume_action_plan(base, p):
    required = {
        'schema':'sg-formal-direct-action-profile-v2','gameId':32721,'group':'secondary','workerOffset':20,
        'basePlanHash':digest(base),'completePreserved':143794,'remainingComplete':156056,'historicalBaseline':150,
        'totalTarget':300000,'maxSequence':600000,'sessionRotation':'closed-batches-v1','sourceAllowance':0,
        'oldProfileHash':'2bde56b5d7af4086256d3e3912630a1b6d137e751ab0ef34024ebb7b21d51f33',
        'sourceRun':'37008008283:1','sourceCommit':'68c1632aa90ad3219ab3dc9d686caeb585c0677a',
        'retirementKey':'count-shared-close:sg_r1_20260928_32721:37008008283:1:complete',
        'closureProfileHash':'6b27d1953e56bfbcbc840ca130963190c63a62b926c3ecbfd39b40299a91ccc8',
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
            and re.fullmatch(r'[a-f0-9]{64}', p['activation']), 'DIRECT_ACTION_SCOPE')
    require(all(isinstance(p.get(k), str) and re.fullmatch(r'[a-f0-9]{64}', p[k]) for k in
                ('retirementHash','nativeRetirementHash','recordsHash','oldSpecHash')), 'RESUME_ACTION_CLOSURE_BINDING')
    plan = {**base, 'countAllocation':p['activation'], 'featureProfile':ACTION_VERSION,
            'actionContractHash':CONTRACT_HASH, 'maxSteps':1026,
            'actionResourceBudget':dict(required['actionResourceBudget'])}
    require(digest(plan) == p.get('planHash') and not plan.get('demoGeneration')
            and not plan.get('sessionLayout'), 'DIRECT_ACTION_PLAN')
    return plan
