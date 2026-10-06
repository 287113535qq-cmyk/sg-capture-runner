"""Independent conversion of an already independently verified SG record.

No database, networking, source continuation, type remapping or new credit.
"""
import copy
import re

VERSION = 'sg-simulate-delivery-v1'

def business_document(record, binding, campaign):
    assert record['fixtureOnly'] is False and record['raw']['fixtureOnly'] is False
    assert all(record[k] == binding[k] for k in ('trialId', 'gameId', 'runtimeGameId'))
    assert re.fullmatch('[a-f0-9]{64}', record['_id']) and re.fullmatch('[a-f0-9]{64}', record['contentHash'])
    assert binding['database'] == 'sg_' + binding['runtimeSlug'] and re.fullmatch('sg_[a-z0-9_-]+', binding['database'])
    tags = binding['rtp']
    assert isinstance(tags, list) and tags and all(type(t) is int and t >= 0 for t in tags)
    assert tags == sorted(set(tags))
    f, steps = record['normalized'], record['raw']['steps']
    m = f['money']
    assert all(type(m[k]) is int and m[k] >= 0 for k in ('startBalanceRaw', 'endBalanceRaw', 'totalWinRaw', 'betRaw'))
    assert m['betRaw'] > 0 and m['endBalanceRaw'] == m['startBalanceRaw'] - m['betRaw'] + m['totalWinRaw']
    assert all(record[k] == f[k] for k in ('bet', 'mul', 'buy', 'bonus', 'roundFieldsVersion'))
    assert f['bet'] == m['betRaw'] / 100 and f['mul'] >= 0 and f['buy'] == 0
    assert type(f['bonus']) is int and f['bonus'] >= 0
    assert f['primaryBonusKind'] in ('none', 'freeGame', 'feature', 'freeFeature')
    assert steps and steps[-1]['responseBalance'] == m['endBalanceRaw']
    assert campaign == 'sg_' + str(record['gameId']) + '-' + binding['queueId']
    assert type(record['shardId']) is int and 0<=record['shardId']<20
    return {'_id': record['_id'][:24], 'bonus': f['bonus'], 'buy': f['buy'], 'bet': f['bet'],
            'mul': f['mul'], 'rtp': copy.deepcopy(tags), 'gameId': binding['runtimeGameId'],
            'data': {'gameId': binding['runtimeGameId'], 'runtimeSlug': binding['runtimeSlug'],
                     'startBalance': m['startBalanceRaw'] / 100, 'endBalance': m['endBalanceRaw'] / 100,
                     'totalWin': m['totalWinRaw'] / 100, 'roundFieldsVersion': f['roundFieldsVersion'],
                     'money': copy.deepcopy(m), 'stepCount': len(steps), 'msgIds': [s['msgId'] for s in steps],
                     'steps': copy.deepcopy(steps), 'primaryBonusKind': f['primaryBonusKind'],
                     'specialKinds': [] if f['primaryBonusKind'] == 'none' else [f['primaryBonusKind']],
                     'enhancedBetLevel': 0, 'enhancedBetLabel': '', 'isFreeChoiceRound': False,
                     'freeChoiceOptionIndex': 0, 'freeChoiceOptionCount': 0, 'captureCampaignId': campaign,
                     'captureWorkerIndex': record['shardId']+1, 'captureNativeShardId':record['shardId'], 'captureRecordId': record['_id'],
                     'captureContentHash': record['contentHash'], 'captureTrialId': record['trialId'],
                     'captureTransformVersion': VERSION}}
