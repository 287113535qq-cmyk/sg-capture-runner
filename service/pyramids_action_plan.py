"""Independent admission for action capture, never a legacy profile upgrade."""
import re
from store import require,digest
from pyramids_action_fields import ACTION_VERSION,CONTRACT_HASH

def pyramids_action_plan(base,p):
    required={'schema':'sg-formal-action-profile-v1','gameId':32721,'group':'secondary','workerOffset':20,
        'basePlanHash':digest(base),'completePreserved':16913,'remainingComplete':282937,'historicalBaseline':150,
        'totalTarget':300000,'maxSequence':600000,'sessionRotation':'closed-batches-v1',
        'oldProfileHash':'758c973008b947c479c083b7eae4d1592fd23ae16022891162a17f1e015dc094',
        'sourceRun':'36963756989:1','sourceCommit':'4c22abda58d86233776496c2d05942a9a4ef5a62',
        'retirementKey':'count-shared-close:sg_r1_20260928_32721:36963756989:1:complete',
        'retirementHash':'cf8acdd48080eb818de3afc2a3ccdf4667e91f90c1b65b0a918ee1360d4b1517',
        'recordsHash':'493099eb67e9e5ef20346762ba3098707adda51460a4e6f4dbc256a62cc091e4',
        'controlReadMode':'compact-worker-v1','stateWriteMode':'versioned-delta-v1',
        'gatewayHash':'a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e',
        'featureProfile':ACTION_VERSION,'actionContractHash':CONTRACT_HASH,'classificationMode':'independent-journal'}
    require(base.get('gameId')==32721 and base.get('trialId')=='sg_r1_20260928_32721'
        and base.get('phase')==1 and base.get('buy')==0 and base.get('target')==299850
        and all(p.get(k)==v for k,v in required.items()) and isinstance(p.get('activation'),str)
        and re.fullmatch(r'[a-f0-9]{64}',p['activation']),'PYRAMIDS_ACTION_REPAIR_SCOPE')
    plan={**base,'countAllocation':p['activation'],'featureProfile':ACTION_VERSION,'actionContractHash':CONTRACT_HASH}
    require(digest(plan)==p.get('planHash') and not plan.get('demoGeneration') and not plan.get('sessionLayout'),
            'PYRAMIDS_ACTION_REPAIR_PLAN')
    return plan
