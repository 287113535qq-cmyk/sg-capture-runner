"""More Puff FID2 Wheel: only independently settled cash exits.

Further free/combined feature outcomes are explicit adapter gaps. Actual wheel
terminal payloads have not yet been observed; synthetic boundaries are not proof
that the whole game can enter formal capture.
"""
import xml.etree.ElementTree as ET
from native_nextgen_fields import NativeNextgenFields
from round_fields import check, params, amount, derive, VERSION

SOURCE = 'huffnmorepuffhighlimit96-round-one-base-v1'
EXTENSION = SOURCE + '-wheel-cash-v1'
CASH = {0, 2, 7, 8, 11}
GSD_KEYS = {'BWS', 'BRS', 'BMS', 'ABW', 'buyInPrice', 'FMS', 'WHSTOP', 'WHEELSPIN',
            'WHJPM', 'FRAMES', 'PREVFRAMES', 'FRAMEWINS', 'HHSHIFTPOS', 'VA',
            'BSSHIFTPOS', 'FEAT_WIN', 'HHPOS', 'BSPOS', 'FEAT', 'BWC'}


def feature_type(raw):
    return any('2' in params(s['responsePayload']).get('FID', '').split('|') for s in raw['steps'])


class MorepuffSequence(NativeNextgenFields):
    def __init__(self, plan):
        check(plan.get('gameId') == 32718 and plan.get('sourceKey') == SOURCE, 'MOREPUFF_PROFILE_REQUIRED')
        super().__init__(plan)

    def wheel_frame(self, step, i):
        msg = 'FREE_GAME' if i else 'BET'
        check(step.get('msgId') == msg, 'MESSAGE_ID_MISMATCH')
        q = self.request_params(step.get('requestPayload'), msg)
        p = params(step.get('responsePayload'))
        check(p.get('MSGID') == msg, 'MESSAGE_ID_MISMATCH')
        check(not any(k in p for k in ('CFG', 'ABPM', 'SB', 'FRTR', 'FRTW', 'BUY_IN'))
              and p.get('FRBAL', '0') == '0'
              and not any(k.startswith(('FS_', 'NFR_', 'CFR_', 'CFP_', 'FR_')) for k in p), 'UNKNOWN_TRIAL_FEATURE')
        check(p.get('GCT', '0') == '0', 'MOREPUFF_FEATURE_NOT_ADAPTED')
        check(p.get('IFG') in {'0', '1'}, 'INVALID_FREE_GAME_STATE')
        for k in ('B', 'AB', 'TW'):
            amount(p.get(k))
        xml = step.get('responseXml')
        check(isinstance(xml, str) and len(xml) < 262144 and '<!DOCTYPE' not in xml.upper()
              and '<!ENTITY' not in xml.upper(), 'INVALID_TRIAL_XML')
        try:
            root = ET.fromstring(xml)
        except ET.ParseError:
            check(False, 'INVALID_TRIAL_XML')
        check(root.tag.upper() == 'GDMRESPONSE' and str(root.findtext('SUCCESS')).lower() == 'true'
              and root.findtext('PAYLOAD') == step['responsePayload'], 'TRIAL_XML_EVIDENCE_MISMATCH')
        check(amount(step.get('elapsedMs')) <= 300000, 'INVALID_TRIAL_TIMING')
        g = {}
        for item in p.get('GSD', '').split('#'):
            if not item:
                continue
            bits = item.split('~')
            check(len(bits) == 2 and bits[0] and bits[0] not in g, 'INVALID_MOREPUFF_GSD')
            g[bits[0]] = bits[1]
        check(set(g) <= GSD_KEYS, 'UNKNOWN_TRIAL_FEATURE')
        check(not any(k in g for k in ('FEAT', 'FRAMES', 'PREVFRAMES', 'FRAMEWINS', 'HHSHIFTPOS',
                                      'FEAT_WIN', 'HHPOS', 'buyInPrice', 'FMS')), 'MOREPUFF_FEATURE_NOT_ADAPTED')
        symbols = [amount(v) for v in g.get('VA', '').split(',') if v]
        check(len(symbols) == 15, 'MISSING_WHEEL_SYMBOLS')
        check(not (symbols.count(13) >= 3 and symbols.count(14) >= 6), 'MOREPUFF_FEATURE_NOT_ADAPTED')
        n, t, c = (amount(p.get(k)) for k in ('NFG', 'TFG', 'CFGG'))
        check(t == n + c and t == 1 and n <= 1 and c <= 1, 'MOREPUFF_FEATURE_NOT_ADAPTED')
        return p, q, g, n, c

    def sequence(self, raw):
        check(raw.get('protocol') == 'nextgen' and raw.get('sourceKey') == SOURCE, 'MOREPUFF_PROFILE_REQUIRED')
        if not feature_type(raw):
            return super().next_request(raw)
        steps = raw['steps']
        check(1 <= len(steps) <= 2, 'MOREPUFF_FEATURE_NOT_ADAPTED')
        p, q, g, n, c = self.wheel_frame(steps[0], 0)
        check(p.get('FID') in {'2', '2|'} and n == 1 and c == 0 and p['IFG'] == '0'
              and p.get('RID') == '0' and 'WHSTOP' not in g, 'MOREPUFF_FEATURE_NOT_ADAPTED')
        if len(steps) == 1:
            return {'MSGID': 'FREE_GAME'}
        last, request, gsd, n, c = self.wheel_frame(steps[1], 1)
        check(request['PID'] == q['PID'], 'SESSION_CHANGED_MID_ROUND')
        check(last.get('FID') in {'0', '0|', '1', '1|'}, 'MOREPUFF_FEATURE_NOT_ADAPTED')
        check(amount(gsd.get('WHSTOP')) in CASH, 'MOREPUFF_FEATURE_NOT_ADAPTED')
        check(n == 0 and c == 1, 'INCOMPLETE_ROUND')
        return None

    def next_request(self, raw):
        return self.sequence(raw)

    def settled(self, raw):
        if not feature_type(raw):
            return super().settled(raw)
        check(raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion') == VERSION, 'TRIAL_PROFILE_REQUIRED')
        check(self.sequence(raw) is None and len(raw['steps']) == 2, 'INCOMPLETE_ROUND')
        fields = derive(raw)
        check(fields['buy'] == 0 and fields['money']['betRaw'] == self.plan['betRaw'], 'TRIAL_ACTUAL_COST_MISMATCH')
        return fields
