"""Independent repair scope; preserves the settled allocation and old records."""
import re
from store import require,digest

def pyramids_fifteen_plan(base,p):
    require(p.get('schema')=='sg-formal-repair-pyramids-v5' and p.get('gameId')==32721
        and p.get('group')=='secondary' and p.get('workerOffset')==20
        and base.get('gameId')==32721 and base.get('trialId')=='sg_r1_20260928_32721'
        and base.get('phase')==1 and base.get('buy')==0 and base.get('target')==299850
        and p.get('basePlanHash')==digest(base) and p.get('completePreserved')==5024
        and p.get('remainingComplete')==294826 and p.get('historicalBaseline')==150
        and p.get('totalTarget')==300000 and p.get('maxSequence')==600000
        and p.get('sessionRotation')=='closed-batches-v1'
        and p.get('oldProfileHash')=='f32e340466c2c02d725b93e87a92a493f013157275f6ea7ff699d47712ee8892'
        and p.get('sourceRun')=='36937673870:1'
        and p.get('sourceCommit')=='a66e2c7ac642c87ecedbbe9ddde5194bcae4de36'
        and p.get('retirementKey')=='count-shared-close:sg_r1_20260928_32721:36937673870:1:complete'
        and p.get('controlReadMode')=='compact-worker-v1'
        and p.get('gatewayHash')=='a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e'
        and p.get('recordsHash')=='a030ea2977061f63db69493a19fd09233fff9b784d49cf5b8ca448f3206c45aa'
        and p.get('featureProfile')=='pyramids-fifteen-free-v1'
        and p.get('stateWriteMode')=='versioned-delta-v1'
        and isinstance(p.get('activation'),str) and re.fullmatch(r'[a-f0-9]{64}',p['activation']), 'PYRAMIDS_FIFTEEN_REPAIR_SCOPE')
    plan={**base,'countAllocation':p['activation'],'featureProfile':p['featureProfile']}
    require(digest(plan)==p.get('planHash') and not plan.get('demoGeneration') and not plan.get('sessionLayout'),'PYRAMIDS_FIFTEEN_REPAIR_PLAN')
    return plan
