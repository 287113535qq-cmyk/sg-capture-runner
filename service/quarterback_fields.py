"""32836 standalone Foam Finger and fixed Pick A Ball selection.

The cached client sends GSD.featureData[0], not the clicked finger index.
FID1 instead sends the client-defined constant 1. Stacked or free-triggered
features remain reviewable unknown protocols; they cannot settle as standalone.
"""
import re
import xml.etree.ElementTree as ET

from native_nextgen_fields import NativeNextgenFields
from round_fields import VERSION, FieldError, amount, check, derive, params

SOURCE = 'quarterbackfieldsofglory96-round-one-base-v1'
EXTENSION = SOURCE + '-foam-pick-v1'
PICK_EXTENSION = SOURCE + '-pick-a-ball-v1'

def is_pick(raw):
    return any(params(s['responsePayload']).get('FID') in {'1', '1|'} or
               (s['msgId'].startswith('FEATURE_') and params(s['requestPayload']).get('CFG') == '1')
               for s in raw['steps'])
CLIENT_SHA256 = '43c79de4ffeeebec57ab1a0c7765b47a310d489f82a589bd69be4a495be233a2'
GAME_CLIENT_SHA256 = '789a750fbcc2e3539d1257a3926908c04f5d478cf957b5464b691f06d79fb3ec'
REQUEST = {'GN': 'quarterbackfieldsofglory96', 'BPR': '1', 'RB': '5'}


def is_foam(raw):
    # Historical internal name; now detects either reviewed natural pick path.
    return any(step.get('msgId', '').startswith('FEATURE_') or
               params(step['responsePayload']).get('FID') in {'1', '1|', '2', '2|'} for step in raw['steps'])


def gsd(text):
    check(isinstance(text, str), 'FOAM_MISSING_GSD')
    result = {}
    for part in text.split('#'):
        if not part:
            continue
        pair = part.split('~')
        check(len(pair) == 2 and pair[0] and pair[0] not in result, 'FOAM_AMBIGUOUS_GSD')
        result[pair[0]] = pair[1]
    return result


class QuarterbackFields(NativeNextgenFields):
    def __init__(self, plan):
        check(plan.get('gameId') == 32836 and plan.get('sourceKey') == SOURCE
              and plan.get('requestParams') == REQUEST and plan.get('betRaw') == 25,
              'FOAM_PROFILE_REQUIRED')
        super().__init__(plan)

    def request_params(self, payload, msg):
        if msg in {'BET', 'FREE_GAME'}:
            return super().request_params(payload, msg)
        p = params(payload)
        check(p.get('CFG') in {'1', '2'}, 'UNKNOWN_TRIAL_FEATURE')
        expected = {'GN': REQUEST['GN'], 'MSGID': msg, 'CFG': p['CFG']}
        check(msg in {'FEATURE_START', 'FEATURE_PICK', 'FEATURE_END'}, 'TRIAL_MESSAGE_NOT_ALLOWED')
        if msg == 'FEATURE_PICK':
            fp = p.get('FP', '').split('|')
            check(len(fp) == 3 and fp[0] == '0' and amount(fp[1]) == 1,
                  'FOAM_INVALID_PICK')
            amount(fp[2])
            check(p['CFG'] != '1' or p['FP'] == '0|1|1', 'PICK_BALL_INVALID_CHOICE')
            expected['FP'] = p['FP']
        check({k: v for k, v in p.items() if k != 'PID'} == expected, 'FIRST_ROUND_REQUEST_MODE')
        check(p.get('PID', '').startswith('gdmgcm') and 6 < len(p['PID']) < 512, 'TRIAL_SESSION_REQUIRED')
        return p

    def _frame(self, step, feature='2'):
        check(isinstance(step, dict), 'INVALID_TRIAL_FRAME')
        r = self.request_params(step.get('requestPayload'), step.get('msgId'))
        p = params(step.get('responsePayload'))
        check(p.get('MSGID') == step['msgId'], 'MESSAGE_ID_MISMATCH')
        check(p.get('FID', '') in {'', '0', '0|', feature, feature + '|'} and 'ABPM' not in p,
              'UNKNOWN_TRIAL_FEATURE')
        check(all(not re.match(r'^(FS|NFR|CFR|CFP|FTV|FPM)_', k) or k.endswith('_' + feature) for k in p),
              'UNKNOWN_TRIAL_FEATURE')
        check(p.get('CFG') in {None, '0', feature}, 'UNKNOWN_TRIAL_FEATURE')
        check(p.get('IFG') in {None, '0'}, 'UNKNOWN_TRIAL_FEATURE')
        # No free continuation or second feature has been reviewed in this path.
        check(all(amount(p[k]) == 0 for k in ('NFG', 'TFG', 'CFGG') if k in p), 'UNKNOWN_TRIAL_FEATURE')
        for k in ('B', 'AB', 'TW'):
            amount(p.get(k))
        for k in ('NFR_' + feature, 'CFR_' + feature, 'CFP_' + feature):
            if k in p:
                check(amount(p[k]) <= 1, 'UNKNOWN_TRIAL_FEATURE')
        check(p.get('FS_' + feature) in {None, '0', '1'}, 'UNKNOWN_TRIAL_FEATURE')
        text = step.get('responseXml')
        check(isinstance(text, str) and len(text) < 262144 and '<!DOCTYPE' not in text.upper()
              and '<!ENTITY' not in text.upper(), 'INVALID_TRIAL_XML')
        try:
            root = ET.fromstring(text)
        except ET.ParseError:
            raise FieldError('INVALID_TRIAL_XML') from None
        check(root.tag.upper() == 'GDMRESPONSE' and str(root.findtext('SUCCESS')).lower() == 'true'
              and root.findtext('PAYLOAD') == step['responsePayload'], 'TRIAL_XML_EVIDENCE_MISMATCH')
        check(amount(step.get('elapsedMs')) <= 300000, 'INVALID_TRIAL_TIMING')
        return r, p

    def _sequence(self, raw):
        check(raw.get('sourceKey') == SOURCE and raw.get('protocol') == 'nextgen', 'FOAM_PROFILE_REQUIRED')
        steps = raw.get('steps')
        check(isinstance(steps, list) and 0 < len(steps) <= 100, 'INVALID_ROUND_STEPS')
        if not is_foam(raw):
            # Full legacy validation, including paid-once and stable session.
            prior, player = None, None
            for i, step in enumerate(steps):
                check(step['msgId'] == ('BET' if i == 0 else 'FREE_GAME') and (not i or prior > 0),
                      'FOAM_SEQUENCE_MISMATCH')
                prior = super().frame(step)
                pid = params(step['requestPayload'])['PID']
                check(player is None or player == pid, 'SESSION_CHANGED_MID_ROUND')
                player = pid
            return ({'MSGID': 'FREE_GAME'} if prior else None), False
        check(len(steps) <= 4, 'FOAM_SEQUENCE_MISMATCH')
        feature = '1' if is_pick(raw) else '2'
        next_step, player, picked_value = {'MSGID': 'BET'}, None, None
        for i, step in enumerate(steps):
            r, p = self._frame(step, feature)
            check(next_step is not None and all(r.get(k) == v for k, v in next_step.items()), 'FOAM_SEQUENCE_MISMATCH')
            check(player is None or player == r['PID'], 'SESSION_CHANGED_MID_ROUND')
            player = r['PID']
            if i == 0:
                check(p.get('FID') in {feature, feature + '|'} and p.get('CFG') == feature and p.get('IFG') == '0'
                      and p.get('FS_' + feature) == '0' and p.get('NFR_' + feature) == '1'
                      and p.get('CFR_' + feature) == '0' and p.get('CFP_' + feature) == '0' and p.get('FPM_' + feature) == '|',
                      'UNKNOWN_TRIAL_FEATURE')
                next_step = {'MSGID': 'FEATURE_START', 'CFG': feature}
            elif i == 1:
                # The client reads CFP and featureData from START, even if FS
                # is omitted. Do not substitute BET data or choose a prize.
                check(p.get('CFG') == feature and p.get('CFP_' + feature) == '0', 'UNKNOWN_TRIAL_FEATURE')
                if feature == '1':
                    # Official Pick A Ball: all three visual buttons send 1.
                    # This fixed choice never reads prize/result fields.
                    picked_value = '1'
                else:
                    fields = gsd(p.get('GSD'))
                    check('featureData' in fields, 'UNKNOWN_TRIAL_FEATURE')
                    data = fields['featureData'].split(';')
                    check(1 <= len(data) <= 5 and all(re.fullmatch(r'[0-9]+', v) for v in data), 'FOAM_INVALID_FEATURE_DATA')
                    for value in data:
                        amount(value)
                    picked_value = data[0]  # Preserve the exact server-provided string.
                next_step = {'MSGID': 'FEATURE_PICK', 'CFG': feature, 'FP': '0|1|' + picked_value}
            elif i == 2:
                check(p.get('FID') in {feature, feature + '|'} and p.get('CFG') == feature and p.get('CFP_' + feature) == '1',
                      'UNKNOWN_TRIAL_FEATURE')
                next_step = {'MSGID': 'FEATURE_END', 'CFG': feature}
            else:
                # The client's receivedFeatureEnd -> panelEnd returns to spin
                # even with retained FID. Live END omits the entire feature
                # counter group; this is not a zero-filled counter response.
                if p.get('FID') in {feature, feature + '|'}:
                    counters = ('CFG', 'FS_' + feature, 'NFR_' + feature, 'CFR_' + feature, 'CFP_' + feature)
                    check(all(k not in p for k in counters) or
                          (p.get('NFR_' + feature) is not None and p.get('CFR_' + feature) is not None),
                          'FOAM_MISSING_END_COUNTERS')
                if 'NFR_' + feature in p:
                    check(amount(p['NFR_' + feature]) == 0 or p.get('CFR_' + feature) == p['NFR_' + feature], 'INCOMPLETE_ROUND')
                check(p.get('CFP_' + feature) in {None, '1'}, 'INCOMPLETE_ROUND')
                next_step = None
        return next_step, True

    def next_request(self, raw):
        return self._sequence(raw)[0]

    def settled(self, raw):
        check(raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion') == VERSION, 'TRIAL_PROFILE_REQUIRED')
        next_step, _ = self._sequence(raw)
        check(next_step is None, 'INCOMPLETE_ROUND')
        fields = derive(raw)
        check(fields['money']['betRaw'] == self.plan['betRaw'] and fields['buy'] == 0, 'TRIAL_ACTUAL_COST_MISMATCH')
        return fields


def feature_settlement(raw):
    """Game-specific END evidence; never weaken generic NFR protection."""
    adapter = QuarterbackFields({'gameId': 32836, 'sourceKey': SOURCE, 'requestParams': REQUEST, 'betRaw': 25})
    next_step, special = adapter._sequence(raw)
    check(special and next_step is None, 'INCOMPLETE_ROUND')
    final = params(raw['steps'][-1]['responsePayload'])
    end, win = amount(final['B']), amount(final['TW'])
    check(end == amount(final['AB']), 'UNRECONCILED_FINAL_BALANCE')
    if 'responseBalance' in raw['steps'][-1]:
        check(end == amount(raw['steps'][-1]['responseBalance']), 'UNRECONCILED_FINAL_BALANCE')
    check(amount(raw.get('startBalanceRaw')) - end + win == 25, 'TRIAL_ACTUAL_COST_MISMATCH')
    return end, win, 'feature', None
