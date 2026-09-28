"""Offline feature evidence for 32714; deliberately not a capture adapter.

Pinned client: 67bcebfd2f16477c8c3b2686b6e10b70f41bde3579d929e89e04e321ffa4e93d.
FID describes the client's feature slots; GSD.FEAT describes the replay feature.
Preserve both. Recognizing either does not establish a complete settlement chain.
No runtime entry point imports this module and no result authorizes a request.
"""
import hashlib
import json
import re
import xml.etree.ElementTree as ET

from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError, amount, check, params

SOURCE = 'huffnpuffmoneymansionhighlimit96-round-one-base-v1'
CLIENT_SHA256 = '67bcebfd2f16477c8c3b2686b6e10b70f41bde3579d929e89e04e321ffa4e93d'
FEATURE_NAMES = ('MONEY_MANSION_FS', 'HARD_HAT_FS', 'TOUCH_UP_FS',
                 'HOME_IMPROVEMENT_FS', 'MANSION_FS')
REPLAY_NAMES = {'MMANSION': 0, 'HARDHAT': 1, 'PAINT': 2, 'HOMEIMP': 3, 'MANSION': 4}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                                    ensure_ascii=False).encode()).hexdigest()


def feature_ids(value):
    check(isinstance(value, str), 'HUFF_INVALID_FID')
    if value == '':
        return []
    check(re.fullmatch(r'[0-9]+(?:\|[0-9]+)*\|?', value) is not None, 'HUFF_INVALID_FID')
    ids = [amount(part) for part in value.rstrip('|').split('|')]
    check(len(ids) <= 2 and len(set(ids)) == len(ids), 'HUFF_UNREVIEWED_FEATURE_SLOTS')
    check(all(index < len(FEATURE_NAMES) for index in ids), 'HUFF_UNKNOWN_FEATURE_ID')
    return ids


def game_state(value):
    check(isinstance(value, str), 'HUFF_INVALID_GSD')
    result = {}
    for part in value.split('#'):
        if not part:
            continue
        key, separator, data = part.partition('~')
        check(separator and key and key not in result, 'HUFF_AMBIGUOUS_GSD')
        result[key] = data
    return result


def inspect_frame(plan, step):
    check(plan.get('gameId') == 32714 and plan.get('sourceKey') == SOURCE,
          'HUFF_REVIEW_PROFILE_REQUIRED')
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
          and 'CFG' not in p and 'ABPM' not in p, 'HUFF_UNREVIEWED_FEATURE_PROTOCOL')
    for key in ('B', 'AB', 'TW'):
        amount(p.get(key))
    check(p.get('IFG') in {'0', '1'}, 'INVALID_NEXTGEN_STATE')
    check(msg != 'FREE_GAME' or p['IFG'] == '1', 'INVALID_FREE_GAME_STATE')
    counters = {key: amount(p[key]) if key in p else None for key in ('NFG', 'TFG', 'CFGG')}
    check(all(value is None or value <= 100 for value in counters.values()), 'TRIAL_FREE_LIMIT')
    ids = feature_ids(p.get('FID', ''))
    gsd = game_state(p.get('GSD', ''))
    previous = feature_ids(gsd.get('PCFID', ''))
    replay = gsd.get('FEAT')
    check(replay is None or replay in REPLAY_NAMES, 'HUFF_UNKNOWN_REPLAY_FEATURE')
    mansion = gsd.get('MMBG')
    check(mansion in {None, '0', '1'}, 'HUFF_INVALID_MANSION_FLAG')
    if msg == 'FREE_GAME' or any(i > 0 for i in ids) or counters['NFG']:
        check(all(value is not None for value in counters.values()), 'HUFF_MISSING_FEATURE_COUNTER')
    # Client lines 3186/3192-3193 route FID0+MMBG to MansionIntro. Line
    # 2785 requests FREE_GAME only when the MMW result is not yet present.
    # MMBG remains 1 on the real terminal FID0 frame: it is not a spin counter.
    mansion_without_result = ids[:1] == [0] and mansion == '1' and not gsd.get('MMW')
    return {'message': msg, 'evidenceHash': digest(step), 'featureIds': ids, 'fidPresent': 'FID' in p,
            'featureNames': [FEATURE_NAMES[i] for i in ids],
            'previousFeatureIds': previous,
            'replayFeatureId': None if replay is None else REPLAY_NAMES[replay],
            'replayFeatureName': None if replay is None else FEATURE_NAMES[REPLAY_NAMES[replay]],
            'counters': counters, 'mansionFlag': mansion,
            'mansionResultPresent': bool(gsd.get('MMW')),
            'clientContinuationHint': 'FREE_GAME' if counters['NFG'] or mansion_without_result else None,
            'combinationObserved': len(ids) > 1 or len(previous) > 1,
            'settlementVerified': False, 'captureAuthorized': False}


def review_round(plan, raw):
    check(isinstance(raw, dict) and raw.get('sourceKey') == SOURCE
          and raw.get('protocol') == 'nextgen', 'HUFF_REVIEW_PROFILE_REQUIRED')
    steps = raw.get('steps')
    check(isinstance(steps, list) and 0 < len(steps) <= 100, 'INVALID_ROUND_STEPS')
    frames, player = [], None
    for index, step in enumerate(steps):
        check(isinstance(step, dict) and step.get('msgId') == ('BET' if index == 0 else 'FREE_GAME'),
              'MULTIPLE_PAID_ROUNDS')
        frame = inspect_frame(plan, step)
        current = params(step['requestPayload'])['PID']
        check(player is None or player == current, 'SESSION_CHANGED_MID_ROUND')
        player = current
        if frames:
            check(frames[-1]['clientContinuationHint'] == 'FREE_GAME', 'UNEXPECTED_FREE_CONTINUATION')
        frames.append(frame)
    return {'schema': 'sg-huff-feature-review-v1', 'gameId': 32714, 'rawHash': digest(raw),
            'clientSha256': CLIENT_SHA256, 'frames': frames,
            'observedFeatureIds': sorted({i for f in frames for i in f['featureIds']}),
            'observedReplayIds': sorted({f['replayFeatureId'] for f in frames if f['replayFeatureId'] is not None}),
            'clientContinuationHint': frames[-1]['clientContinuationHint'],
            'settlementVerified': False, 'captureAuthorized': False,
            'officialSourceRequests': 0, 'databaseWrites': 0}
