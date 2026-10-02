"""Independent repair scope; preserves the settled allocation and old records."""
import re
from store import require,digest

def pyramids_retrigger_plan(base,p):
    require(p.get('schema')=='sg-formal-repair-pyramids-v8' and p.get('gameId')==32721
        and p.get('group')=='secondary' and p.get('workerOffset')==20
        and base.get('gameId')==32721 and base.get('trialId')=='sg_r1_20260928_32721'
        and base.get('phase')==1 and base.get('buy')==0 and base.get('target')==299850
        and p.get('basePlanHash')==digest(base) and p.get('completePreserved')==5787
        and p.get('remainingComplete')==294063 and p.get('historicalBaseline')==150
        and p.get('totalTarget')==300000 and p.get('maxSequence')==600000
        and p.get('sessionRotation')=='closed-batches-v1'
        and p.get('oldProfileHash')=='ea7929295dc8f5098b2d392262b563cf4158c87051987c8c71e62cd9b727fcf9'
        and p.get('sourceRun')=='36951574835:1'
        and p.get('sourceCommit')=='e2383403cb09d36c34aafcdbc49d9a1948831a06'
        and p.get('retirementKey')=='count-shared-close:sg_r1_20260928_32721:36951574835:1:complete'
        and p.get('controlReadMode')=='compact-worker-v1'
        and p.get('gatewayHash')=='a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e'
        and p.get('recordsHash')=='656c64a4430f731a2afb31110756bb79a01988bb5602f7c6edb29d0b1dbb8433'
        and p.get('featureProfile')=='pyramids-ten-retrigger-v1'
        and p.get('stateWriteMode')=='versioned-delta-v1'
        and isinstance(p.get('activation'),str) and re.fullmatch(r'[a-f0-9]{64}',p['activation']), 'PYRAMIDS_RETRIGGER_REPAIR_SCOPE')
    plan={**base,'countAllocation':p['activation'],'featureProfile':p['featureProfile']}
    require(digest(plan)==p.get('planHash') and not plan.get('demoGeneration') and not plan.get('sessionLayout'),'PYRAMIDS_RETRIGGER_REPAIR_PLAN')
    return plan
