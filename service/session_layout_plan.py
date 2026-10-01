"""Independent layout-plan validation; grants no source or runtime authority."""
import re
from store import require, digest


def session_layout_plan(base, profile):
    rhino=profile.get('schema')=='sg-session-layout-rhino-v1'
    require((rhino or profile.get('schema') == 'sg-session-layout-profile-v1')
        and base.get('gameId') == profile.get('gameId') == (32799 if rhino else 32795)
        and base.get('trialId') == ('sg_r1_20261001_32799' if rhino else 'sg_r1_20260930_32795') and base.get('adapter') == ('rhino-wms-v1' if rhino else 'pearl-wms-v1')
        and base.get('target') == 300000 and base.get('phase') == 1 and base.get('buy') == 0
        and not base.get('countAllocation') and not base.get('demoGeneration')
        and profile.get('group') == 'primary' and profile.get('basePlanHash') == digest(base)
        and (profile.get('captureMinutes') == 20 if rhino else profile.get('featureProfile') == 'additive-free-awards-v2')
        and profile.get('maxSequence') == 600000
        and profile.get('sessionRotation') == 'closed-batches-v1', 'SESSION_PROFILE_SCOPE')
    count = profile.get('completePreserved')
    require(type(count) is int and (151 if rhino else 2596) <= count < base['target']
        and type(profile.get('remainingComplete')) is int and profile['remainingComplete'] == base['target'] - count
        and type(profile.get('newBetAllowance')) is int and profile['newBetAllowance'] == 0, 'SESSION_PROFILE_TARGET')
    for key in ('activation', 'parentActivation', 'parentProfileHash', 'sourceSpecHash', 'poolHash', 'campaignHash', 'sourcePermitHash'):
        require(isinstance(profile.get(key), str) and re.fullmatch('[a-f0-9]{64}', profile[key]), 'SESSION_PROFILE_IDENTITY')
    require(profile['activation'] != profile['parentActivation']
        and re.fullmatch(r'\d+:1', profile.get('sourceRun', ''))
        and re.fullmatch('[a-f0-9]{40}', profile.get('sourceCommit', '')), 'SESSION_PROFILE_PARENT')
    layout = profile.get('sessionLayout')
    require(isinstance(layout, dict) and set(layout) == {'schema', 'group', 'hosts', 'lanesPerHost'}
        and layout['schema'] == 'sg-independent-sessions-v1' and layout['group'] == 'primary'
        and type(layout['hosts']) is int and layout['hosts'] == 20
        and type(layout['lanesPerHost']) is int and layout['lanesPerHost'] in (2, 4), 'SESSION_LAYOUT_SCOPE')
    prior = profile.get('previousLanesPerHost')
    require(type(prior) is int and (prior, layout['lanesPerHost']) in ((1, 2), (2, 4)), 'SESSION_PROFILE_STEP')
    require(profile.get('comparisonHash') is None if prior == 1 else
        isinstance(profile.get('comparisonHash'), str) and re.fullmatch('[a-f0-9]{64}', profile['comparisonHash']), 'SESSION_PROFILE_COMPARISON')
    plan = {**base, **({} if rhino else {'maxSteps':1026,'featureProfile':profile['featureProfile']}),
            'countAllocation': profile['activation'], 'sessionLayout': dict(layout)}
    require(digest(plan) == profile.get('planHash'), 'SESSION_PROFILE_PLAN')
    return plan
