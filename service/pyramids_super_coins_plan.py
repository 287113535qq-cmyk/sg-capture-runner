"""Independent repair scope; preserves the settled allocation and old records."""
import re
from store import require,digest

def pyramids_super_coins_plan(base,p):
    require(p.get('schema')=='sg-formal-repair-pyramids-v10' and p.get('gameId')==32721
        and p.get('group')=='secondary' and p.get('workerOffset')==20
        and base.get('gameId')==32721 and base.get('trialId')=='sg_r1_20260928_32721'
        and base.get('phase')==1 and base.get('buy')==0 and base.get('target')==299850
        and p.get('basePlanHash')==digest(base) and p.get('completePreserved')==8391
        and p.get('remainingComplete')==291459 and p.get('historicalBaseline')==150
        and p.get('totalTarget')==300000 and p.get('maxSequence')==600000
        and p.get('sessionRotation')=='closed-batches-v1'
        and p.get('oldProfileHash')=='8f387e5caf6a563cb10cab7fc62f657ed4af3eaae280844f3cf1a8297ff90f0d'
        and p.get('sourceRun')=='36961087858:1'
        and p.get('sourceCommit')=='dd058f848725f776ae7d8eb1e37b31a2000d9b20'
        and p.get('retirementKey')=='count-parked-close:sg_r1_20260928_32721:36961087858:1:complete'
        and p.get('controlReadMode')=='compact-worker-v1'
        and p.get('gatewayHash')=='a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e'
        and p.get('recordsHash')=='f776cc0581b6e43c96d72987a1ceaf56ec24470933566cbb44229fdb284bbef1'
        and p.get('featureProfile')=='pyramids-super-cash-coins-v1'
        and p.get('stateWriteMode')=='versioned-delta-v1'
        and isinstance(p.get('activation'),str) and re.fullmatch(r'[a-f0-9]{64}',p['activation']), 'PYRAMIDS_SUPER_COINS_REPAIR_SCOPE')
    plan={**base,'countAllocation':p['activation'],'featureProfile':p['featureProfile']}
    require(digest(plan)==p.get('planHash') and not plan.get('demoGeneration') and not plan.get('sessionLayout'),'PYRAMIDS_SUPER_COINS_REPAIR_PLAN')
    return plan
