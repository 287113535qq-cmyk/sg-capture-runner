"""Jinzita standalone FID1. FGRS/CFGC must agree with outer free counters.

Mixed HoldNSpin/free transitions and forced game termination are not supported.
"""
import xml.etree.ElementTree as ET

from native_nextgen_fields import NativeNextgenFields
from free_game_counters import advance_free_game_counters
from round_fields import check, params, VERSION, derive, amount

SOURCE = 'hyperchargedjinzita96-round-one-base-v1'
EXTENSION = SOURCE + '-jinzita-free-v1'


def feature_type(raw):
    return any(params(s['responsePayload']).get('FID') in {'1', '1|'} for s in raw['steps'])


class JinzitaSequence(NativeNextgenFields):
    def __init__(self, plan):
        check(plan.get('gameId') == 32720 and plan.get('sourceKey') == SOURCE, 'JINZITA_PROFILE_REQUIRED')
        super().__init__(plan)

    def sequence(self, raw):
        check(raw.get('protocol') == 'nextgen' and raw.get('sourceKey') == SOURCE, 'JINZITA_PROFILE_REQUIRED')
        steps = raw.get('steps')
        check(isinstance(steps, list) and 0 < len(steps) <= 100, 'INVALID_ROUND_STEPS')
        # Historical standalone wild respin receipts keep their original rules.
        if not feature_type(raw):
            return super().next_request(raw)
        previous, player = None, None
        for i, step in enumerate(steps):
            p = params(step['responsePayload'])
            check(step.get('msgId') == ('BET' if i == 0 else 'FREE_GAME'), 'JINZITA_SEQUENCE_MISMATCH')
            check(p.get('FID') in {'1', '1|'}, 'UNKNOWN_TRIAL_FEATURE')
            check(not any(k.startswith(('FS_', 'NFR_', 'CFR_', 'CFP_')) for k in p)
                  and not any(k in p for k in ('CFG', 'ABPM', 'SB')), 'UNKNOWN_TRIAL_FEATURE')
            gsd = {}
            for item in p.get('GSD', '').split('#'):
                if not item:
                    continue
                bits = item.split('~')
                check(len(bits) == 2 and bits[0] and bits[0] not in gsd, 'INVALID_JINZITA_GSD')
                gsd[bits[0]] = bits[1]
            check('CFG' not in gsd and gsd.get('FID', '[]') == '[]', 'UNKNOWN_TRIAL_FEATURE')
            request = self.request_params(step['requestPayload'], step['msgId'])
            check(player is None or player == request['PID'], 'SESSION_CHANGED_MID_ROUND')
            player = request['PID']
            check(p.get('MSGID') == step['msgId'], 'MESSAGE_ID_MISMATCH')
            check(p.get('IFG') in {'0', '1'} and (i == 0 or p['IFG'] == '1'), 'INVALID_FREE_GAME_STATE')
            for key in ('B', 'AB', 'TW'):
                amount(p.get(key))
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
            check(all(k in p for k in ('NFG', 'TFG', 'CFGG')), 'JINZITA_MISSING_COUNTER')
            n, t, c = (amount(p[k]) for k in ('NFG', 'TFG', 'CFGG'))
            check(max(n, t, c) <= 100 and t == n + c, 'JINZITA_COUNTERS')
            check(p.get('GCT', '0') == '0', 'UNSUPPORTED_JINZITA_TERMINATION')
            check(('FGRS' not in gsd or amount(gsd['FGRS']) == n)
                  and ('CFGC' not in gsd or amount(gsd['CFGC']) == c), 'UNSUPPORTED_JINZITA_NESTED_COUNTER')
            if previous is None:
                check(n > 0 and c == 0 and p.get('IFG') == '0', 'JINZITA_EMPTY_TRIGGER')
            else:
                pn, pt, pc = previous
                advance_free_game_counters({'total':pt,'remaining':pn,'played':pc},
                                           {'total':t,'remaining':n,'played':c},maximum=100)
            previous = n, t, c
        return {'MSGID': 'FREE_GAME'} if previous[0] else None

    def next_request(self, raw):
        return self.sequence(raw)

    def settled(self, raw):
        if not feature_type(raw):
            return super().settled(raw)
        check(raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion') == VERSION, 'TRIAL_PROFILE_REQUIRED')
        check(self.sequence(raw) is None and len(raw['steps']) > 1, 'INCOMPLETE_ROUND')
        fields = derive(raw)
        check(fields['buy'] == 0 and fields['money']['betRaw'] == self.plan['betRaw'], 'TRIAL_ACTUAL_COST_MISMATCH')
        return fields
