"""Strict native Book of Sevens demo/base adapter. All analysis is offline."""
import xml.etree.ElementTree as ET
from round_fields import derive, params, check, amount, VERSION

SOURCE = 'bookofsevens96-base-v1'
SLUG = 'bookofsevens96'

def request_params(payload, msg):
    p = params(payload)
    check(set(p) == {'GN','PID','MSGID','AP','BPL','LB'}, 'TRIAL_REQUEST_KEYS')
    check(p['GN'] == SLUG and p['MSGID'] == msg and p['AP'] == 'false'
          and p['BPL'] == '5' and p['LB'] == '5', 'TRIAL_REQUEST_MODE')
    check(p['PID'].startswith('gdmgcm') and 6 < len(p['PID']) < 512, 'TRIAL_SESSION_REQUIRED')
    return p

def frame(step):
    check(isinstance(step, dict), 'INVALID_TRIAL_FRAME')
    msg = step.get('msgId')
    check(msg in {'BET','FREE_GAME'}, 'TRIAL_MESSAGE_NOT_ALLOWED')
    request_params(step.get('requestPayload'), msg)
    p = params(step.get('responsePayload'))
    check(p.get('MSGID') == msg, 'MESSAGE_ID_MISMATCH')
    check(p.get('FID', '0|') in {'0','0|',''}, 'UNKNOWN_TRIAL_FEATURE')
    check(not any(k.startswith(('FS_', 'NFR_')) for k in p), 'UNKNOWN_TRIAL_FEATURE')
    check(p.get('BPL') == '5' and p.get('LB') == '5', 'TRIAL_RESPONSE_MODE')
    check('CFG' not in p and 'ABPM' not in p, 'UNKNOWN_TRIAL_FEATURE')
    for key in ('B','AB','TW'):
        amount(p.get(key))
    remaining = amount(p.get('NFG', '0'))
    check(remaining <= 100, 'TRIAL_FREE_LIMIT')
    check(p.get('IFG') in {'0','1'}, 'INVALID_NEXTGEN_STATE')
    if msg == 'FREE_GAME':
        check(p['IFG'] == '1' and 'NFG' in p, 'INVALID_FREE_GAME_STATE')
    text = step.get('responseXml')
    check(isinstance(text, str) and len(text) < 262144 and '<!DOCTYPE' not in text.upper()
          and '<!ENTITY' not in text.upper(), 'INVALID_TRIAL_XML')
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        check(False, 'INVALID_TRIAL_XML')
    check(root.tag.upper() == 'GDMRESPONSE' and str(root.findtext('SUCCESS')).lower() == 'true'
          and root.findtext('PAYLOAD') == step['responsePayload'], 'TRIAL_XML_EVIDENCE_MISMATCH')
    check(amount(step.get('elapsedMs')) <= 300000, 'INVALID_TRIAL_TIMING')
    return remaining

def settled(raw):
    check(raw.get('fixtureOnly') is False and raw.get('protocol') == 'nextgen'
          and raw.get('sourceKey') == SOURCE and raw.get('roundFieldsVersion') == VERSION, 'TRIAL_PROFILE_REQUIRED')
    steps = raw['steps']
    check(0 < len(steps) <= 100 and steps[0]['msgId'] == 'BET', 'INVALID_ROUND_STEPS')
    prior = None
    player = None
    for i, step in enumerate(steps):
        check(step['msgId'] == ('BET' if i == 0 else 'FREE_GAME'), 'MULTIPLE_PAID_ROUNDS')
        if i:
            check(prior > 0, 'UNEXPECTED_FREE_CONTINUATION')
        prior = frame(step)
        pid = params(step['requestPayload'])['PID']
        check(player is None or player == pid, 'SESSION_CHANGED_MID_ROUND')
        player = pid
    check(prior == 0, 'INCOMPLETE_ROUND')
    fields = derive(raw)
    check(fields['money']['betRaw'] == 25 and fields['buy'] == 0, 'TRIAL_ACTUAL_COST_MISMATCH')
    return fields
