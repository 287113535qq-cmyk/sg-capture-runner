"""32651 continuation contract, transcribed from its saved official client.

FEATURE_START deliberately omits FS/CFG. State therefore comes from the entire
durable exchange history, never from a missing NFG in one response. Positions
are visited in numeric order; prize values are never used to choose a position.
See docs/squid-jackpot-protocol.md for source locations and recovery evidence.
"""
import re
import xml.etree.ElementTree as ET
from native_nextgen_fields import NativeNextgenFields
from round_fields import amount, check, params, derive, VERSION

SOURCE = 'squidgameonemoregame96-round-one-base-v1'
EXTENSION = SOURCE + '-jackpot-v1'


class SquidFields(NativeNextgenFields):
    def request_params(self, payload, msg):
        if msg in {'BET', 'FREE_GAME'}:
            return super().request_params(payload, msg)
        p = params(payload)
        check(msg in {'FEATURE_START', 'FEATURE_PICK', 'FEATURE_END'}, 'TRIAL_MESSAGE_NOT_ALLOWED')
        expected = {'GN': self.plan['runtimeSlug'], 'MSGID': msg, 'CFG': '1'}
        if msg == 'FEATURE_PICK':
            check(re.fullmatch(r'1\|(?:[1-9]|1[0-5])\|(?:[0-9]|1[0-4])', p.get('FP', '')) is not None,
                  'INVALID_JACKPOT_PICK')
            expected['FP'] = p['FP']
        check({k:v for k,v in p.items() if k != 'PID'} == expected, 'FIRST_ROUND_REQUEST_MODE')
        check(p.get('PID', '').startswith('gdmgcm') and 6 < len(p['PID']) < 512, 'TRIAL_SESSION_REQUIRED')
        return p

    def frame(self, step):
        msg = step.get('msgId'); self.request_params(step.get('requestPayload'), msg)
        p = params(step.get('responsePayload'))
        check(p.get('MSGID') == msg, 'MESSAGE_ID_MISMATCH')
        check(p.get('FID', '') in {'', '0', '0|', '1|', '1|0|'}, 'UNKNOWN_TRIAL_FEATURE')
        check(p.get('CFG', '1') == '1' and 'ABPM' not in p, 'UNKNOWN_TRIAL_FEATURE')
        check(all(k.endswith('_1') for k in p if k.startswith(('FS_', 'NFR_', 'FTV_', 'FPM_', 'CFR_', 'CFP_'))),
              'UNKNOWN_TRIAL_FEATURE')
        for key in ('B', 'AB', 'TW'): amount(p.get(key))
        if 'NFG' in p: check(amount(p['NFG']) <= 100, 'TRIAL_FREE_LIMIT')
        check(p.get('IFG') in {'0', '1'}, 'INVALID_NEXTGEN_STATE')
        if msg == 'FREE_GAME': check(p['IFG'] == '1' and 'NFG' in p, 'INVALID_FREE_GAME_STATE')
        text = step.get('responseXml')
        check(isinstance(text, str) and len(text) < 262144 and '<!DOCTYPE' not in text.upper()
              and '<!ENTITY' not in text.upper(), 'INVALID_TRIAL_XML')
        try: root = ET.fromstring(text)
        except ET.ParseError: check(False, 'INVALID_TRIAL_XML')
        check(root.tag.upper() == 'GDMRESPONSE' and str(root.findtext('SUCCESS')).lower() == 'true'
              and root.findtext('PAYLOAD') == step['responsePayload'], 'TRIAL_XML_EVIDENCE_MISMATCH')
        check(amount(step.get('elapsedMs')) <= 300000, 'INVALID_TRIAL_TIMING')
        return p

    def next_request(self, raw):
        check(raw.get('sourceKey') == SOURCE, 'TRIAL_PROFILE_REQUIRED')
        steps = raw['steps']; check(len(steps) <= 100, 'INVALID_ROUND_STEPS')
        next_request = {'MSGID': 'BET'}
        player = None; remaining = 0; picks = None; made = 0; started = False
        for step in steps:
            check(next_request is not None, 'MULTIPLE_PAID_ROUNDS')
            msg = step.get('msgId'); request = self.request_params(step.get('requestPayload'), msg)
            check(all(request.get(k) == v for k,v in next_request.items()), 'JACKPOT_SEQUENCE_MISMATCH')
            check(player is None or player == request['PID'], 'SESSION_CHANGED_MID_ROUND'); player = request['PID']
            p = self.frame(step)
            if 'NFG' in p: remaining = amount(p['NFG'])
            if msg == 'BET' and '1' in p.get('FID', '').split('|'):
                check(p.get('CFG') == '1' and p.get('FS_1') == '0' and p.get('NFR_1') == '1'
                      and p.get('FPM_1') == '|', 'UNKNOWN_JACKPOT_TRIGGER')
                parts = p.get('FTV_1', '').removesuffix('|').rstrip(';').split(';')
                values = [amount(v) for v in parts]
                check(len(values) >= 3 and 1 <= values[1] <= 15 and values[2] == values[1]
                      and len(values) == 3 + values[2], 'INVALID_JACKPOT_PICK_COUNT')
                picks = values[1]
            elif msg == 'FEATURE_START':
                started = True  # Official client sets this manually; response lacks FS.
            elif msg == 'FEATURE_PICK':
                made += 1
            elif msg == 'FEATURE_END':
                picks = None  # Official client clears PickFeature after successful END.
            elif msg == 'FREE_GAME':
                check('1' not in p.get('FID', '').split('|'), 'UNEXPECTED_JACKPOT_RETRIGGER')
            if picks is not None:
                next_request = {'MSGID':'FEATURE_START', 'CFG':'1'} if not started else (
                    {'MSGID':'FEATURE_PICK', 'CFG':'1', 'FP':f'1|{made+1}|{made}'} if made < picks else
                    {'MSGID':'FEATURE_END', 'CFG':'1'})
            else:
                next_request = {'MSGID':'FREE_GAME'} if remaining else None
        return next_request

    def settled(self, raw):
        check(raw.get('fixtureOnly') is False and raw.get('protocol') == 'nextgen'
              and raw.get('roundFieldsVersion') == VERSION, 'TRIAL_PROFILE_REQUIRED')
        check(raw['steps'] and self.next_request(raw) is None, 'INCOMPLETE_ROUND')
        fields = derive(raw)
        check(fields['money']['betRaw'] == self.plan['betRaw'] and fields['buy'] == 0, 'TRIAL_ACTUAL_COST_MISMATCH')
        return fields
