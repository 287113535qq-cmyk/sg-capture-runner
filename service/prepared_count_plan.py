"""Independent binding of an exact prepared formal profile; no source client."""
import re
from store import require,digest

def prepared_count_plan(base,profile,authorization):
    require(profile.get('schema')=='sg-prepared-count-profile-v1'
        and authorization.get('schema')=='sg-prepared-count-authorization-v1'
        and authorization.get('profileHash')==digest(profile)
        and authorization.get('gameId')==base.get('gameId')
        and authorization.get('trialId')==base.get('trialId')
        and authorization.get('basePlanHash')==digest(base)
        and authorization.get('activation')==profile.get('activation'),'PREPARED_COUNT_AUTHORIZATION')
    require(type(base.get('buy')) is int and base['buy']==0 and type(base.get('phase')) is int and base['phase']==1
        and 'demoGeneration' not in base and 'countAllocation' not in base
        and profile.get('gameId')==base['gameId'] and profile.get('trialId')==base['trialId']
        and profile.get('group')==authorization.get('group') and profile['group'] in ('primary','secondary')
        and profile.get('basePlanHash')==digest(base)
        and type(profile.get('completePreserved')) is int and 0<=profile['completePreserved']<300000
        and type(profile.get('targetComplete')) is int and profile['targetComplete']==300000
        and profile.get('remainingComplete')==300000-profile['completePreserved']
        and type(profile.get('maxSequence')) is int and profile['maxSequence']==600000
        and profile.get('sessionRotation')=='closed-batches-v1'
        and type(profile.get('newBetAllowance')) is int and profile['newBetAllowance']==0
        and profile.get('requiresNewSession') is True
        and type(profile.get('createdAt')) is int and type(profile.get('expiresAt')) is int
        and profile['expiresAt']-profile['createdAt']==7200000,'PREPARED_COUNT_PROFILE')
    for field in ('activation','preparationProofHash','failureEvidenceHash','sceneHash','recordsHash','closureHash'):
        require(isinstance(profile.get(field),str) and re.fullmatch('[a-f0-9]{64}',profile[field]),'PREPARED_COUNT_BINDING')
    if 'repairParent' in profile:
        parent=profile['repairParent']
        require(isinstance(parent,dict)
            and re.fullmatch('[a-f0-9]{64}',parent.get('activation',''))
            and parent['activation']!=profile['activation']
            and re.fullmatch('[a-f0-9]{64}',parent.get('specHash',''))
            and re.fullmatch('[a-f0-9]{40}',parent.get('sourceCommit',''))
            and re.fullmatch('[0-9]+:1',parent.get('sourceRun',''))
            and any(parent.get('closureKey')==f"count-{kind}-close:{base['trialId']}:{parent['sourceRun']}:complete"
                    for kind in ('shared','parked','prepared')),'PREPARED_REPAIR_PARENT')
    plan={**base,'target':300000,'countAllocation':profile['activation']}
    if 'actionContract' in profile:
        from huff_action_fields import SOURCE, ACTION_VERSION, CONTRACT_HASH
        require(base.get('gameId')==32714 and base.get('sourceKey')==SOURCE
            and base.get('betRaw')==500 and base.get('maxSteps')==100
            and profile['actionContract']==dict(version=ACTION_VERSION,hash=CONTRACT_HASH),
            'PREPARED_ACTION_CONTRACT')
        plan.update(featureProfile=ACTION_VERSION,actionContractHash=CONTRACT_HASH)
    require(profile.get('planHash')==digest(plan),'PREPARED_COUNT_PLAN_CHANGED')
    return plan
