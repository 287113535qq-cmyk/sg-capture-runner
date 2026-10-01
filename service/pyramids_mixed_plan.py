"""Independent repair scope; preserves the settled allocation and old records."""
import re
from store import require,digest

def pyramids_mixed_plan(base,p):
    require(p.get('schema')=='sg-formal-repair-pyramids-v4' and p.get('gameId')==32721
        and p.get('group')=='secondary' and p.get('workerOffset')==20
        and base.get('gameId')==32721 and base.get('trialId')=='sg_r1_20260928_32721'
        and base.get('phase')==1 and base.get('buy')==0 and base.get('target')==299850
        and p.get('basePlanHash')==digest(base) and p.get('completePreserved')==3627
        and p.get('remainingComplete')==296223 and p.get('historicalBaseline')==150
        and p.get('totalTarget')==300000 and p.get('maxSequence')==600000
        and p.get('sessionRotation')=='closed-batches-v1'
        and p.get('oldProfileHash')=='5c7278ed911ed73ca082e611e8556909704e979b9b6447d29591ec8f8cf6a411'
        and p.get('sourceRun')=='36860241790:1'
        and p.get('sourceCommit')=='d2d38028883eef3a609ba3209e19785857a54e56'
        and p.get('retirementKey')=='formal-stopped-retire:sg_r1_20260928_32721:23a2419605be82e9bf0b6c359a501bc47b0c2b1015e7b9de8ceb5d88c03f7c62:complete'
        and p.get('featureProfile')=='pyramids-free-hold-v1'
        and p.get('stateWriteMode')=='versioned-delta-v1'
        and isinstance(p.get('activation'),str) and re.fullmatch(r'[a-f0-9]{64}',p['activation']), 'PYRAMIDS_MIXED_REPAIR_SCOPE')
    plan={**base,'countAllocation':p['activation'],'featureProfile':p['featureProfile']}
    require(digest(plan)==p.get('planHash') and not plan.get('demoGeneration') and not plan.get('sessionLayout'),'PYRAMIDS_MIXED_REPAIR_PLAN')
    return plan
