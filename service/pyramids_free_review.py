"""Independent Pyramids FID1 ten-free validator; no source permission.

Official isolated free routing and saved first free response reviewed; terminal remains synthetic.
HoldNSpin, mixed FIDs, retriggers and alternate nested counters remain rejected.
"""
import xml.etree.ElementTree as ET

from native_nextgen_fields import NativeNextgenFields
from round_fields import check, params, VERSION, nextgen, amount

SOURCE = 'hyperchargedpyramidsofra96-round-one-base-v1'
EXTENSION = SOURCE + '-pyramids-ten-free-v1'


def feature_type(raw):
    return any(params(s['responsePayload']).get('FID') in {'1', '1|'} for s in raw['steps'])


class PyramidsFreeSequence(NativeNextgenFields):
    reviewed_free_total = 10
    extra_gsd = frozenset()
    def __init__(self, plan):
        check(plan.get('gameId') == 32721 and plan.get('sourceKey') == SOURCE, 'PYRAMIDS_FREE_PROFILE_REQUIRED')
        super().__init__(plan)

    def validate_gsd(self, gsd, index):
        check(set(gsd) <= {'BGRS','IIFS','VA','FGRS','CFGC','FGVABN','BGCL','CL','CLBN','FSRS'} | self.extra_gsd, 'PYRAMIDS_FREE_UNREVIEWED_GSD')
        # Original PZa/rC also maps free-frame CL. Ancillary CLBN/FSRS/IIFS
        # do not affect the official projection; accept only reviewed shapes.
        if 'CLBN' in gsd:
            check(index > 0 and 'CL' in gsd and gsd['CLBN'] == gsd['CL'], 'PYRAMIDS_FREE_COIN_ALIAS')
        if 'FSRS' in gsd:
            stops = gsd['FSRS'].split(';')
            if stops[-1] == '': stops.pop()
            check(index > 0 and len(stops) == 5 and all(v.isascii() and v.isdigit()
                  and int(v) <= 9007199254740991 for v in stops), 'PYRAMIDS_FREE_STOPS')
        unreviewed_coin = False
        for key in ('BGCL','CL'):
            if key not in gsd:
                continue
            rows = gsd[key].split('|')
            if rows[-1] == '': rows.pop()
            check(0 < len(rows) <= 15, 'PYRAMIDS_FREE_COIN')
            seen = set()
            for row in rows:
                cells = row.split(';')
                if cells[-1] == '': cells.pop()
                check(len(cells) == 3 and all(v.isascii() and v.isdigit() for v in cells[:2])
                      and (cells[2].isascii() and cells[2].isdigit() or cells[2] in {'-4','-3','-2'}), 'PYRAMIDS_FREE_COIN')
                x,y,value = map(int,cells)
                check(0 <= x < 3 and 0 <= y < 5 and value <= 9007199254740991 and (x,y) not in seen, 'PYRAMIDS_FREE_COIN')
                seen.add((x,y))
                unreviewed_coin |= value < 0 and not (getattr(self, 'reviewed_major', False)
                    and index > 0 and key == 'CL' and cells[2] == '-3')
        # Known official coin symbols are an adapter gap, not corrupt money.
        # Validate every position first so a malformed later coin stays a hard fault.
        check(not unreviewed_coin, 'PYRAMIDS_FREE_UNREVIEWED_COIN')
        if 'FGVABN' in gsd:
            from pyramids_hold_review import rows
            grid=rows(gsd['FGVABN'])
            check(len(grid)==5 and all(len(r)==3 and all(0<=x<=15 for x in r) for r in grid),'PYRAMIDS_FREE_GRID')
        check('IIFS' not in gsd or gsd['IIFS'] in ({'1'} if index == 0 else {'0','1'}), 'PYRAMIDS_FREE_UNREVIEWED_GSD')

    def sequence(self, raw):
        check(raw.get('protocol') == 'nextgen' and raw.get('sourceKey') == SOURCE, 'PYRAMIDS_FREE_PROFILE_REQUIRED')
        steps = raw.get('steps')
        check(isinstance(steps, list) and 0 < len(steps) <= 100, 'INVALID_ROUND_STEPS')
        check(feature_type(raw), 'PYRAMIDS_FREE_FREE_REVIEW_REQUIRED')
        previous, player, base_coins = None, None, None
        for i, step in enumerate(steps):
            p = params(step['responsePayload'])
            check(step.get('msgId') == ('BET' if i == 0 else 'FREE_GAME'), 'PYRAMIDS_FREE_SEQUENCE_MISMATCH')
            check(p.get('FID') in {'1', '1|'}, 'UNKNOWN_TRIAL_FEATURE')
            check(not any(k.startswith(('FS_', 'NFR_', 'CFR_', 'CFP_')) for k in p)
                  and not any(k in p for k in ('CFG', 'ABPM', 'SB', 'JPV')), 'UNKNOWN_TRIAL_FEATURE')
            gsd = {}
            for item in p.get('GSD', '').split('#'):
                if not item:
                    continue
                bits = item.split('~')
                check(len(bits) == 2 and bits[0] and bits[0] not in gsd, 'INVALID_PYRAMIDS_FREE_GSD')
                gsd[bits[0]] = bits[1]
            self.validate_gsd(gsd, i)
            # BGCL restores the base reel snapshot; a free response may repeat
            # the trigger snapshot, but must not introduce or change it.
            if i == 0:
                base_coins = gsd.get('BGCL')
            elif 'BGCL' in gsd:
                check(base_coins is not None and gsd['BGCL'] == base_coins, 'PYRAMIDS_BASE_COINS_CHANGED')
            check(p.get('FRBAL','0') == '0', 'PYRAMIDS_FREE_UNREVIEWED_FREE_ROUNDS')
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
            check(all(k in p for k in ('NFG', 'TFG', 'CFGG')), 'PYRAMIDS_FREE_MISSING_COUNTER')
            n, t, c = (amount(p[k]) for k in ('NFG', 'TFG', 'CFGG'))
            check(self.reviewed_free_total in (10,15) and t == self.reviewed_free_total and t == n + c and 0 <= n <= t and 0 <= c <= t, 'PYRAMIDS_FREE_COUNTERS')
            check(p.get('GCT', '0') == '0', 'UNSUPPORTED_PYRAMIDS_FREE_TERMINATION')
            check(('FGRS' not in gsd or amount(gsd['FGRS']) == n)
                  and ('CFGC' not in gsd or amount(gsd['CFGC']) == c), 'UNSUPPORTED_PYRAMIDS_FREE_NESTED_COUNTER')
            if previous is None:
                check(n > 0 and c == 0 and p.get('IFG') == '0', 'PYRAMIDS_FREE_EMPTY_TRIGGER')
            else:
                pn, pt, pc = previous
                check(pn > 0 and c == pc + 1 and t == pt and n == pn - 1, 'PYRAMIDS_FREE_PROGRESS')
                if n == 0:
                    check(pn == 1 and t == pt, 'PYRAMIDS_FREE_TERMINAL')
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
