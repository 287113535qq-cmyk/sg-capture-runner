"""32636 ordinary/free chain, pinned to reviewed client and real retriggers."""
import re
from native_nextgen_fields import NativeNextgenFields
from round_fields import check, params, amount

SOURCE = 'richlittlepiggiesworldclass96-round-one-base-v1'
SIZE2_EXTENSION = SOURCE + '-size2-free-v1'

def has_size2(raw):
    return raw.get('sourceKey')==SOURCE and any(any(x.startswith(('PGS2~','GE2~')) for x in params(st['responsePayload']).get('GSD','').split('#')) for st in raw.get('steps',[]))

GSD_KEYS = set('WWW MSR VA MSRNAME CONAMES CO WM FGEW RW RT CW WCP WCS SCP GE WWCTA WWCITE RTR BT RSTA RPI RSAS ITFG WWP WWTI PBG PWG RE WCE0 PWCS0 PRG WWPI WT WWTP BE GT JS JO PJS JW WWCP RSS RSCT PRPI PGS4 GE4 PGG EP4 PGS2 GE2 WWFITE WWFWAE'.split())


class PiggiesFields(NativeNextgenFields):
    def sequence(self, raw):
        check(raw.get('sourceKey') == SOURCE and raw.get('protocol') == 'nextgen'
              and raw.get('fixtureOnly') is False, 'PIGGIES_PROFILE_REQUIRED')
        steps = raw.get('steps')
        check(isinstance(steps, list) and 0 < len(steps) <= 100, 'INVALID_ROUND_STEPS')
        size2 = has_size2(raw)
        previous = None
        session = None
        for i, step in enumerate(steps):
            n = self.frame(step)  # XML, message, exact mode, timing and money syntax.
            p, q = params(step['responsePayload']), params(step['requestPayload'])
            check(step['msgId'] == ('FREE_GAME' if i else 'BET'), 'MULTIPLE_PAID_ROUNDS')
            check(session is None or session == q['PID'], 'SESSION_CHANGED_MID_ROUND')
            session = q['PID']
            check(p.get('GCT', '0') == '0' and p.get('FRBAL', '0') == '0'
                  and not any(k in p for k in ('SB', 'FRTR', 'FRTW', 'BUY_IN'))
                  and not any(k.startswith(('CFR_', 'CFP_', 'FR_')) for k in p), 'PIGGIES_FEATURE_NOT_ADAPTED')
            keys = []
            for item in filter(None, p.get('GSD', '').split('#')):
                parts = item.split('~')
                check(len(parts) == 2 and parts[0] in GSD_KEYS and parts[0] not in keys,
                      'PIGGIES_FEATURE_NOT_ADAPTED')
                keys.append(parts[0])
            g=dict(item.split('~') for item in p.get('GSD','').split('#') if item)
            if size2:
                check(g.get('GT')=='1' and g.get('BT')=='1' and g.get('PGG')=='1'
                      and not any(k in g for k in ('PGS4','GE4','EP4')), 'PIGGIES_SIZE_TWO_COMBINATION')
                check(i>0 or ('PGS2' in g and 'GE2' in g), 'PIGGIES_SIZE_TWO_TRIGGER')
            if 'PGS2' in g or 'GE2' in g:
                check(g.get('GT')=='1' and g.get('BT')=='1' and g.get('PGG')=='1'
                      and 'PGS4' not in g and 'GE4' not in g and 'EP4' not in g
                      and 'PGS2' in g and 'GE2' in g, 'PIGGIES_SIZE_TWO_COMBINATION')
                check(re.fullmatch(r'-?[0-9]+',g['PGS2']) is not None
                      and abs(int(g['PGS2']))<=9007199254740991, 'PIGGIES_SIZE_TWO_COUNTER')
                amount(g['GE2'])
            check(p['IFG'] == ('1' if i else '0'), 'INVALID_FREE_GAME_STATE')
            if n or i:
                t, c = amount(p.get('TFG')), amount(p.get('CFGG'))
                check(t == n + c and 0 < t <= 99, 'PIGGIES_COUNTER_MISMATCH')
                if i:
                    pn, pt, pc = previous
                    check(pn > 0 and c == pc + 1 and t >= pt and n == pn - 1 + t - pt,
                          'PIGGIES_COUNTER_MISMATCH')
                else:
                    check(c == 0 and amount(p.get('FGT')) == n, 'PIGGIES_COUNTER_MISMATCH')
            else:
                t, c = amount(p.get('TFG', '0')), amount(p.get('CFGG', '0'))
                check(t == c == 0 and amount(p.get('FGT', '0')) == 0, 'PIGGIES_COUNTER_MISMATCH')
            check(not i or previous[0] > 0, 'UNEXPECTED_FREE_CONTINUATION')
            previous = n, t, c
        if not previous[0]:
            check(amount(p['B']) == amount(p['AB']), 'UNRECONCILED_FINAL_BALANCE')
            check(amount(raw.get('startBalanceRaw')) - amount(p['B']) + amount(p['TW']) == 100,
                  'TRIAL_ACTUAL_COST_MISMATCH')
        return {'MSGID': 'FREE_GAME'} if previous[0] else None

    def next_request(self, raw):
        return self.sequence(raw)

    def settled(self, raw):
        check(self.sequence(raw) is None, 'INCOMPLETE_ROUND')
        return super().settled(raw)
