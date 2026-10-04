"""Offline, additive access manifest construction; never connects to Mongo."""
import copy
import re


def append_rolling_scopes(old, plans):
    assert old.get('schema') == 'sg-mongo-only-access-v2'
    assert old.get('metadataWritesEnabled') is True and old.get('roundWritesEnabled') is True
    assert plans.get('schema') == 'sg-ag-rolling-plan-registry-v1' and plans.get('sourceAllowance') == 0
    desired = copy.deepcopy(old)
    desired.update(rollingJournalBatchEnabled=True, rollingCleanupEnabled=True, rollingGameCountEnabled=True)
    added = {}
    for key, plan in plans['plans'].items():
        assert str(plan['gameId']) == key and plan['mode'] == 'demo' and plan['buy'] == 0
        assert plan['database'] == 'sg_capture_staging_v1' and plan['target'] == 300000
        trial = plan['trialId']
        assert re.fullmatch(r'sg_ag_r1_[0-9]{8}_' + key, trial)
        assert type(plan['runtimeGameId']) is int and plan['runtimeGameId'] > 0
        scope = {'group': 'primary', 'rolling': True, 'gameId': plan['gameId'],
                 'runtimeGameId': plan['runtimeGameId'], 'target': 300000, 'maxSequence': 300140}
        if trial in old['trials']:
            assert old['trials'][trial] == scope, 'AG_NATIVE_EXISTING_SCOPE_CHANGED'
        else:
            assert not any(s.get('rolling') is True and s.get('gameId') == plan['gameId']
                           for s in old['trials'].values()), 'AG_NATIVE_GAME_TRIAL_CHANGED'
            added[trial] = scope
            desired['trials'][trial] = copy.deepcopy(scope)
    assert all(desired['trials'][trial] == scope for trial, scope in old['trials'].items())
    return desired, added
