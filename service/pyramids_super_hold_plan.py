"""Independent repair scope; preserves the settled allocation and old records."""
import re
from store import require,digest

def pyramids_super_hold_plan(base,p):
    require(p.get('schema')=='sg-formal-repair-pyramids-v6' and p.get('gameId')==32721
        and p.get('group')=='secondary' and p.get('workerOffset')==20
        and base.get('gameId')==32721 and base.get('trialId')=='sg_r1_20260928_32721'
        and base.get('phase')==1 and base.get('buy')==0 and base.get('target')==299850
        and p.get('basePlanHash')==digest(base) and p.get('completePreserved')==5111
        and p.get('remainingComplete')==294739 and p.get('historicalBaseline')==150
        and p.get('totalTarget')==300000 and p.get('maxSequence')==600000
        and p.get('sessionRotation')=='closed-batches-v1'
        and p.get('oldProfileHash')=='f9fe107deffc81d8ebc86a00d9819987001e599bfe115890e4705f3bc8eb82a8'
        and p.get('sourceRun')=='36941485498:1'
        and p.get('sourceCommit')=='6a9d39684e1433cbba1c361044f57c8ee25787d3'
        and p.get('retirementKey')=='count-shared-close:sg_r1_20260928_32721:36941485498:1:complete'
        and p.get('controlReadMode')=='compact-worker-v1'
        and p.get('gatewayHash')=='a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e'
        and p.get('recordsHash')=='4fb9e24fb9ded80ff45904791293a52742aa2a063572f83529b83d5611675d6a'
        and p.get('featureProfile')=='pyramids-super-hold-cash-v1'
        and p.get('stateWriteMode')=='versioned-delta-v1'
        and isinstance(p.get('activation'),str) and re.fullmatch(r'[a-f0-9]{64}',p['activation']), 'PYRAMIDS_SUPER_HOLD_REPAIR_SCOPE')
    plan={**base,'countAllocation':p['activation'],'featureProfile':p['featureProfile']}
    require(digest(plan)==p.get('planHash') and not plan.get('demoGeneration') and not plan.get('sessionLayout'),'PYRAMIDS_SUPER_HOLD_REPAIR_PLAN')
    return plan
