from store import require, digest
import re

def pyramids_major_plan(base, profile):
    p = profile
    require(p.get('schema') == 'sg-formal-repair-pyramids-v3' and p.get('gameId') == 32721
        and p.get('group') == 'secondary' and p.get('workerOffset') == 20
        and base.get('gameId') == 32721 and base.get('trialId') == 'sg_r1_20260928_32721'
        and base.get('phase') == 1 and base.get('buy') == 0 and base.get('target') == 299850
        and p.get('basePlanHash') == digest(base) and p.get('completePreserved') == 3211
        and p.get('remainingComplete') == 296639 and p.get('historicalBaseline') == 150
        and p.get('totalTarget') == 300000 and p.get('maxSequence') == 600000
        and p.get('sessionRotation') == 'closed-batches-v1'
        and p.get('oldProfileHash') == '1c7f256253480053168458a38b49e133a76240448416f7689b14753f439c7552'
        and p.get('sourceRun') == '36848037333:1' and p.get('sourceCommit') == '4c13485557529aba9dc7657487e7d9b75634f2b4'
        and p.get('retirementKey') == 'count-shared-close:sg_r1_20260928_32721:36848037333:1:complete'
        and p.get('featureProfile') == 'pyramids-free-major-v1'
        and isinstance(p.get('activation'), str) and re.fullmatch(r'[a-f0-9]{64}',p['activation']), 'PYRAMIDS_MAJOR_REPAIR_SCOPE')
    plan = {**base, 'countAllocation': p['activation']}
    require(digest(plan) == p.get('planHash') and not plan.get('demoGeneration') and not plan.get('sessionLayout'), 'PYRAMIDS_MAJOR_REPAIR_PLAN')
    return plan
