"""Independent repair scope; preserves the settled allocation and old records."""
import re
from store import require,digest

def pyramids_cash_coins_plan(base,p):
    require(p.get('schema')=='sg-formal-repair-pyramids-v9' and p.get('gameId')==32721
        and p.get('group')=='secondary' and p.get('workerOffset')==20
        and base.get('gameId')==32721 and base.get('trialId')=='sg_r1_20260928_32721'
        and base.get('phase')==1 and base.get('buy')==0 and base.get('target')==299850
        and p.get('basePlanHash')==digest(base) and p.get('completePreserved')==7503
        and p.get('remainingComplete')==292347 and p.get('historicalBaseline')==150
        and p.get('totalTarget')==300000 and p.get('maxSequence')==600000
        and p.get('sessionRotation')=='closed-batches-v1'
        and p.get('oldProfileHash')=='9b5be7e5e018d9be4c7c09adda0dcac84bbae82c75e3d3c4d5c1fcc1b4982a34'
        and p.get('sourceRun')=='36955443358:1'
        and p.get('sourceCommit')=='3a4efb77f104cb23306b635ccfdddbd1daa5340d'
        and p.get('retirementKey')=='count-parked-close:sg_r1_20260928_32721:36955443358:1:complete'
        and p.get('controlReadMode')=='compact-worker-v1'
        and p.get('gatewayHash')=='a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e'
        and p.get('recordsHash')=='11f76cc6db83acfc439ddb4cea67ed1e842fc2312db2d3ee03c6a1fc38cbe5f6'
        and p.get('featureProfile')=='pyramids-cash-coins-v1'
        and p.get('stateWriteMode')=='versioned-delta-v1'
        and isinstance(p.get('activation'),str) and re.fullmatch(r'[a-f0-9]{64}',p['activation']), 'PYRAMIDS_CASH_COINS_REPAIR_SCOPE')
    plan={**base,'countAllocation':p['activation'],'featureProfile':p['featureProfile']}
    require(digest(plan)==p.get('planHash') and not plan.get('demoGeneration') and not plan.get('sessionLayout'),'PYRAMIDS_CASH_COINS_REPAIR_PLAN')
    return plan
