"""Independent Inca FID1 ten-free validator; no source permission.

Official isolated free routing reviewed; all continuation/terminal frames synthetic.
HoldNSpin, mixed FIDs, retriggers and alternate nested counters remain rejected.
"""
import xml.etree.ElementTree as ET

from native_nextgen_fields import NativeNextgenFields
from round_fields import check, params, VERSION, nextgen, amount

SOURCE = 'hyperchargedincajungle96-round-one-base-v1'
EXTENSION = SOURCE + '-inca-ten-free-v1'


def feature_type(raw):
    return any(params(s['responsePayload']).get('FID') in {'1', '1|'} for s in raw['steps'])


class IncaSequence(NativeNextgenFields):
    def __init__(self, plan):
        check(plan.get('gameId') == 32719 and plan.get('sourceKey') == SOURCE, 'INCA_PROFILE_REQUIRED')
        super().__init__(plan)

    def validate_gsd(self, gsd, index):
        check(set(gsd) <= {'BGRS','IIFS','VA','NWI','PWI','FGTS','FGRS','CFGC'}, 'INCA_UNREVIEWED_GSD')
        check('IIFS' not in gsd or gsd['IIFS'] == ('1' if index == 0 else '0'), 'INCA_UNREVIEWED_GSD')

    def sequence(self, raw):
        check(raw.get('protocol') == 'nextgen' and raw.get('sourceKey') == SOURCE, 'INCA_PROFILE_REQUIRED')
        steps = raw.get('steps')
        check(isinstance(steps, list) and 0 < len(steps) <= 100, 'INVALID_ROUND_STEPS')
        check(feature_type(raw), 'INCA_FREE_REVIEW_REQUIRED')
        previous, player = None, None
        for i, step in enumerate(steps):
            p = params(step['responsePayload'])
            check(step.get('msgId') == ('BET' if i == 0 else 'FREE_GAME'), 'INCA_SEQUENCE_MISMATCH')
            check(p.get('FID') in {'1', '1|'}, 'UNKNOWN_TRIAL_FEATURE')
            check(not any(k.startswith(('FS_', 'NFR_', 'CFR_', 'CFP_')) for k in p)
                  and not any(k in p for k in ('CFG', 'ABPM', 'SB')), 'UNKNOWN_TRIAL_FEATURE')
            gsd = {}
            for item in p.get('GSD', '').split('#'):
                if not item:
                    continue
                bits = item.split('~')
                check(len(bits) == 2 and bits[0] and bits[0] not in gsd, 'INVALID_INCA_GSD')
                gsd[bits[0]] = bits[1]
            self.validate_gsd(gsd, i)
            check(p.get('FRBAL','0') == '0', 'INCA_UNREVIEWED_FREE_ROUNDS')
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
            check(all(k in p for k in ('NFG', 'TFG', 'CFGG')), 'INCA_MISSING_COUNTER')
            n, t, c = (amount(p[k]) for k in ('NFG', 'TFG', 'CFGG'))
            check(t == 10 and t == n + c and 0 <= n <= 10 and 0 <= c <= 10, 'INCA_COUNTERS')
            check(p.get('GCT', '0') == '0', 'UNSUPPORTED_INCA_TERMINATION')
            check(('FGRS' not in gsd or amount(gsd['FGRS']) == n)
                  and ('CFGC' not in gsd or amount(gsd['CFGC']) == c), 'UNSUPPORTED_INCA_NESTED_COUNTER')
            if previous is None:
                check(n > 0 and c == 0 and p.get('IFG') == '0', 'INCA_EMPTY_TRIGGER')
            else:
                pn, pt, pc = previous
                check(pn > 0 and c == pc + 1 and t == pt and n == pn - 1, 'INCA_PROGRESS')
                if n == 0:
                    check(pn == 1 and t == pt, 'INCA_TERMINAL')
            previous = n, t, c
        return {'MSGID': 'FREE_GAME'} if previous[0] else None

    def next_request(self, raw):
        return self.sequence(raw)

    def settled(self, raw):
        check(raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion') == VERSION, 'TRIAL_PROFILE_REQUIRED')
        check(self.sequence(raw) is None and len(raw['steps']) > 1, 'INCOMPLETE_ROUND')
        end, win, kind, declared = nextgen(raw)
        stake = amount(raw.get('startBalanceRaw')) - end + win
        check(stake == self.plan['betRaw'] == 20 and (declared is None or declared == stake), 'TRIAL_ACTUAL_COST_MISMATCH')
        return {'complete':True,'betRaw':stake,'endBalanceRaw':end,'totalWinRaw':win,'sourceRequests':0,'captureAuthorized':False}
