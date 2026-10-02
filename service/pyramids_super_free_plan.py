"""Independent repair scope; preserves the settled allocation and old records."""
import re
from store import require,digest

def pyramids_super_free_plan(base,p):
    require(p.get('schema')=='sg-formal-repair-pyramids-v7' and p.get('gameId')==32721
        and p.get('group')=='secondary' and p.get('workerOffset')==20
        and base.get('gameId')==32721 and base.get('trialId')=='sg_r1_20260928_32721'
        and base.get('phase')==1 and base.get('buy')==0 and base.get('target')==299850
        and p.get('basePlanHash')==digest(base) and p.get('completePreserved')==5713
        and p.get('remainingComplete')==294137 and p.get('historicalBaseline')==150
        and p.get('totalTarget')==300000 and p.get('maxSequence')==600000
        and p.get('sessionRotation')=='closed-batches-v1'
        and p.get('oldProfileHash')=='140025dee8b6f121c08e3f8b71d50c326db627c556529049ba850e64d249294f'
        and p.get('sourceRun')=='36946815410:1'
        and p.get('sourceCommit')=='72b02e1a85d9bcfa92e246dd3dbedffefa38568e'
        and p.get('retirementKey')=='count-parked-close:sg_r1_20260928_32721:36946815410:1:complete'
        and p.get('controlReadMode')=='compact-worker-v1'
        and p.get('gatewayHash')=='a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e'
        and p.get('recordsHash')=='16db53f48d254a8ba850a3628859693ff4096dfeaeefac39f47833b3327be432'
        and p.get('featureProfile')=='pyramids-super-free-v1'
        and p.get('stateWriteMode')=='versioned-delta-v1'
        and isinstance(p.get('activation'),str) and re.fullmatch(r'[a-f0-9]{64}',p['activation']), 'PYRAMIDS_SUPER_FREE_REPAIR_SCOPE')
    plan={**base,'countAllocation':p['activation'],'featureProfile':p['featureProfile']}
    require(digest(plan)==p.get('planHash') and not plan.get('demoGeneration') and not plan.get('sessionLayout'),'PYRAMIDS_SUPER_FREE_REPAIR_PLAN')
    return plan
