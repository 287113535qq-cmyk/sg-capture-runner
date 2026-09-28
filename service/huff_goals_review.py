"""Pinned, offline 32717 routing evidence. Never authorizes source requests.

FID 2 is Wheel in this client, not 32714's Touch Up free feature. Replay
FEAT and NEXTTRIGGER are separate state; do not invent bonus IDs from FID.
"""
import re
import xml.etree.ElementTree as ET

from huff_feature_review import digest, game_state
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError, amount, check, params

SOURCE = 'huffnlotsofpuffgoals96-round-one-base-v1'
CLIENT_SHA256 = 'f41a7744c5d2d5f966fa3c9c2ccf0b77ac3fc0d68614f985518090d3e3fbed7f'
CLIENT_MODES = {0: 'FreeSpin', 1: 'BaseGame', 2: 'Wheel'}  # Client line 3220.
REPLAYS = {'FG', 'BUZZSAW', 'MANSION', 'MEGAHAT'}
TRIGGERS = {'WHEEL1', 'WHEEL2', 'FG', 'BUZZSAW'}
WHEEL_RESULTS = {'MINI', 'MINOR', 'MAJOR', 'GRAND', 'SUPER', 'MANSION', 'MEGAHAT'}


def feature_ids(value):
    check(isinstance(value, str), 'GOALS_INVALID_FID')
    if not value:
        return []
    check(re.fullmatch(r'[0-9]+(?:\|[0-9]+)*\|?', value) is not None, 'GOALS_INVALID_FID')
    result = [amount(part) for part in value.rstrip('|').split('|')]
    check(len(result) <= 2 and len(set(result)) == len(result), 'GOALS_UNREVIEWED_FEATURE_SLOTS')
    check(all(i in CLIENT_MODES for i in result), 'GOALS_UNKNOWN_FEATURE_ID')
    return result


def inspect_frame(plan, step):
    check(plan.get('gameId') == 32717 and plan.get('sourceKey') == SOURCE,
          'GOALS_REVIEW_PROFILE_REQUIRED')
    check(isinstance(step, dict), 'INVALID_TRIAL_FRAME')
    msg = step.get('msgId')
    NativeNextgenFields(plan).request_params(step.get('requestPayload'), msg)
    p = params(step.get('responsePayload'))
    check(p.get('MSGID') == msg, 'MESSAGE_ID_MISMATCH')
    text = step.get('responseXml')
    check(isinstance(text, str) and len(text) < 262144 and '<!DOCTYPE' not in text.upper()
          and '<!ENTITY' not in text.upper(), 'INVALID_TRIAL_XML')
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        raise FieldError('INVALID_TRIAL_XML') from None
    check(root.tag.upper() == 'GDMRESPONSE' and str(root.findtext('SUCCESS')).lower() == 'true'
          and root.findtext('PAYLOAD') == step['responsePayload'], 'TRIAL_XML_EVIDENCE_MISMATCH')
    check(not any(k.startswith(('FS_', 'NFR_')) for k in p)
          and 'CFG' not in p and 'ABPM' not in p, 'GOALS_UNREVIEWED_FEATURE_PROTOCOL')
    for key in ('B', 'AB', 'TW'):
        amount(p.get(key))
    check(p.get('IFG') in {'0', '1'}, 'INVALID_NEXTGEN_STATE')
    check(msg != 'FREE_GAME' or p['IFG'] == '1', 'INVALID_FREE_GAME_STATE')
    ids = feature_ids(p.get('FID', ''))
    counters = {k: amount(p[k]) if k in p else None for k in ('NFG', 'TFG', 'CFGG')}
    check(all(v is None or v <= 100 for v in counters.values()), 'TRIAL_FREE_LIMIT')
    if msg == 'FREE_GAME' or ids or counters['NFG']:
        check(all(v is not None for v in counters.values()), 'GOALS_MISSING_FEATURE_COUNTER')
    gsd = game_state(p.get('GSD', ''))
    replay, trigger, wheel = (gsd.get(k) for k in ('FEAT', 'NEXTTRIGGER', 'WHSLICE'))
    check(replay in {None, ''} or replay in REPLAYS, 'GOALS_UNKNOWN_REPLAY_FEATURE')
    check(trigger in {None, ''} or trigger in TRIGGERS, 'GOALS_UNKNOWN_NEXT_TRIGGER')
    check(wheel in {None, ''} or wheel in WHEEL_RESULTS, 'GOALS_UNKNOWN_WHEEL_RESULT')
    # WheelIntro explicitly sends FREE_GAME at line 2861; ordinary free
    # continuation uses NFG at 2337/2341-2342. This is evidence, not a permit.
    hint = 'FREE_GAME' if counters['NFG'] else None
    return {'message': msg, 'evidenceHash': digest(step), 'featureIds': ids,
            'clientModeNames': [CLIENT_MODES[i] for i in ids], 'fidPresent': 'FID' in p,
            'counters': counters, 'replayName': replay, 'nextTrigger': trigger,
            'wheelResult': wheel, 'wheelTablePresent': bool(gsd.get('WH1')),
            'secondWheelTablePresent': bool(gsd.get('WH2')),
            'wheelIntroObserved': ids[:1] == [2] and trigger in {'WHEEL1', 'WHEEL2'},
            'counterSumConsistent': None if any(v is None for v in counters.values())
                else counters['TFG'] == counters['CFGG'] + counters['NFG'],
            'clientContinuationHint': hint, 'settlementVerified': False,
            'captureAuthorized': False}


def review_round(plan, raw):
    check(isinstance(raw, dict) and raw.get('sourceKey') == SOURCE
          and raw.get('protocol') == 'nextgen', 'GOALS_REVIEW_PROFILE_REQUIRED')
    steps = raw.get('steps')
    check(isinstance(steps, list) and 0 < len(steps) <= 100, 'INVALID_ROUND_STEPS')
    frames, player, extensions = [], None, 0
    for index, step in enumerate(steps):
        check(isinstance(step, dict) and step.get('msgId') == ('BET' if index == 0 else 'FREE_GAME'),
              'MULTIPLE_PAID_ROUNDS')
        frame = inspect_frame(plan, step)
        current = params(step['requestPayload'])['PID']
        check(player is None or player == current, 'SESSION_CHANGED_MID_ROUND')
        player = current
        if frames:
            check(frames[-1]['clientContinuationHint'] == 'FREE_GAME', 'UNEXPECTED_FREE_CONTINUATION')
            before, after = frames[-1]['counters']['TFG'], frame['counters']['TFG']
            extensions += int(before is not None and after is not None and after > before)
        frames.append(frame)
    return {'schema': 'sg-huff-goals-review-v1', 'gameId': 32717, 'rawHash': digest(raw),
            'clientSha256': CLIENT_SHA256, 'frames': frames,
            'observedFeatureIds': sorted({i for f in frames for i in f['featureIds']}),
            'observedReplayNames': sorted({f['replayName'] for f in frames if f['replayName']}),
            'totalCounterIncreases': extensions,
            'clientContinuationHint': frames[-1]['clientContinuationHint'],
            'settlementVerified': False, 'captureAuthorized': False,
            'officialSourceRequests': 0, 'databaseWrites': 0}
