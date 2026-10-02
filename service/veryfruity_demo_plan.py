"""Independent finite action pilot scope. No formal count permission."""
import re
from store import require,digest
from veryfruity_action_fields import SOURCE,ACTION_VERSION,CONTRACT_HASH

def veryfruity_demo_plan(base,p):
    require(isinstance(base,dict) and base.get('gameId')==32812 and base.get('runtimeGameId')==33172
        and base.get('trialId')=='sg_r1_20261003_32812' and base.get('runnerGroup')=='secondary'
        and base.get('adapter')==SOURCE and base.get('sourceKey')==SOURCE and base.get('protocol')=='wms'
        and base.get('featureProfile')==ACTION_VERSION and base.get('actionContractHash')==CONTRACT_HASH
        and base.get('buy')==0 and base.get('mode')=='demo' and base.get('betRaw')==20
        and base.get('target')==300000 and base.get('maxSteps')==1026 and base.get('workers')==20,'VERYFRUITY_DEMO_BASE')
    require(p.get('schema')=='sg-demo-next-game-v1' and p.get('group')=='secondary' and p.get('workerOffset')==20
        and p.get('gameId')==32812 and p.get('fromGameId')==32721 and p.get('completePreserved')==0
        and p.get('abandonedAttempts')==0 and p.get('newBetAllowance')==100 and p.get('perWorker')==5
        and p.get('workers')==20 and not any(p.get(k) for k in ('legacyImport','repairedCandidate','sourceClosureHash'))
        and p.get('oldPlanHash')==digest(base) and p.get('emptyCandidate',{}).get('schema')=='sg-empty-demo-candidate-v1', 'VERYFRUITY_DEMO_PROFILE')
    ref=p.get('sourceFormal',{})
    require(ref.get('schema')=='sg-formal-source-boundary-v1' and ref.get('kind')=='complete'
        and ref.get('plan',{}).get('gameId')==32721 and ref.get('plan',{}).get('trialId')=='sg_r1_20260928_32721'
        and ref.get('planHash')==digest(ref.get('plan')) and p.get('sourcePlanHash')==ref['planHash']
        and ref.get('proofKey')=='game-audit:sg_r1_20260928_32721'
        and p.get('sourceCommit')==ref.get('commit') and p.get('sourceRunKey')=='capture-run:'+str(ref.get('run'))
        and all(isinstance(ref.get(k),str) and re.fullmatch('[a-f0-9]{64}',ref[k]) for k in ('proofHash','campaignHash','poolHash','specHash','runPermitHash')), 'VERYFRUITY_DEMO_SOURCE')
    require(isinstance(p.get('generation'),str) and re.fullmatch('[a-f0-9]{64}',p['generation'])
        and p.get('expiresAt',0)-p.get('createdAt',0)==7200000,'VERYFRUITY_DEMO_GENERATION')
    plan={**base,'demoGeneration':p['generation']}
    require(p.get('planHash')==digest(plan),'VERYFRUITY_DEMO_PLAN');return plan
