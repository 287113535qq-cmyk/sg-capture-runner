"""Independent FID1 adapter; activation requires a separate reviewed permission.

32820 independent FID1 free spins. Cascade, Beaver Bonus and picker branches
remain unsupported. Missing protocol counters are never UI-defaulted to zero.
"""
import xml.etree.ElementTree as ET

from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError, VERSION, amount, check, nextgen, params, derive

SOURCE = 'beaverlasvegas96-round-one-base-v1'
EXTENSION = SOURCE + '-beaver-free-v1'
CFG1_EXTENSION = SOURCE + '-beaver-free-cfg1-v2'


def feature_type(raw):
    return any(params(step['responsePayload']).get('FID') in {'1', '1|'} for step in raw['steps'])


def cfg1_type(raw):
    return any(gsd_parts(params(step['responsePayload']).get('GSD', '')).get('CFG') == '1'
               for step in raw['steps'])


def gsd_parts(text):
    check(isinstance(text, str), 'INVALID_BEAVER_GSD')
    result = {}
    for item in text.split('#'):
        if not item:
            continue
        bits = item.split('~')
        check(len(bits) == 2 and bits[0] and bits[0] not in result, 'AMBIGUOUS_BEAVER_GSD')
        result[bits[0]] = bits[1]
    return result


class BeaverSequence(NativeNextgenFields):
    def __init__(self, plan):
        check(plan.get('gameId') == 32820 and plan.get('sourceKey') == SOURCE,
              'BEAVER_PROFILE_REQUIRED')
        super().__init__(plan)

    def state(self, step):
        check(isinstance(step, dict), 'INVALID_TRIAL_FRAME')
        msg = step.get('msgId')
        request = self.request_params(step.get('requestPayload'), msg)
        p = params(step.get('responsePayload'))
        check(p.get('MSGID') == msg, 'MESSAGE_ID_MISMATCH')
        fid = p.get('FID', '')
        check(fid in {'', '0', '0|', '1', '1|'}, 'UNKNOWN_TRIAL_FEATURE')
        check(not any(k.startswith(('FS_', 'NFR_', 'CFR_', 'CFP_')) for k in p)
              and 'CFG' not in p and 'ABPM' not in p and 'SB' not in p,
              'UNKNOWN_TRIAL_FEATURE')
        gsd = gsd_parts(p.get('GSD', ''))
        # Historical FID0 Beaver Bonus replays already use GSD.CFG=0.
        # Keep that old branch, but never combine it with the new FID1 branch.
        check('CFG' not in gsd or (gsd['CFG'] == '0' and fid in {'0', '0|'})
              or (gsd['CFG'] == '1' and fid in {'1', '1|'}),
              'UNSUPPORTED_BEAVER_NESTED_FEATURE')
        for key in ('B', 'AB', 'TW'):
            amount(p.get(key))
        check(p.get('IFG') in {'0', '1'} and (msg != 'FREE_GAME' or p['IFG'] == '1'),
              'INVALID_FREE_GAME_STATE')
        counts = {k: amount(p[k]) if k in p else None for k in ('NFG', 'TFG', 'CFGG')}
        check(all(v is None or v <= 100 for v in counts.values()), 'TRIAL_FREE_LIMIT')
        if msg == 'FREE_GAME' or fid in {'1', '1|'} or counts['NFG']:
            check(all(v is not None for v in counts.values()), 'BEAVER_MISSING_FREE_COUNTER')
        xml = step.get('responseXml')
        check(isinstance(xml, str) and len(xml) < 262144 and '<!DOCTYPE' not in xml.upper()
              and '<!ENTITY' not in xml.upper(), 'INVALID_TRIAL_XML')
        try:
            root = ET.fromstring(xml)
        except ET.ParseError:
            raise FieldError('INVALID_TRIAL_XML') from None
        check(root.tag.upper() == 'GDMRESPONSE' and str(root.findtext('SUCCESS')).lower() == 'true'
              and root.findtext('PAYLOAD') == step['responsePayload'], 'TRIAL_XML_EVIDENCE_MISMATCH')
        check(amount(step.get('elapsedMs')) <= 300000, 'INVALID_TRIAL_TIMING')
        return {'fid': fid, 'pid': request['PID'], 'beaverActive': gsd.get('CFG') == '0',
                'cfg1': gsd.get('CFG') == '1', **counts}

    def sequence(self, raw):
        check(raw.get('protocol') == 'nextgen' and raw.get('sourceKey') == SOURCE,
              'BEAVER_PROFILE_REQUIRED')
        steps = raw.get('steps')
        check(isinstance(steps, list) and 0 < len(steps) <= 100, 'INVALID_ROUND_STEPS')
        next_msg, player, special, replay = 'BET', None, False, False
        saw_beaver = False
        saw_cfg1 = False
        previous = None
        for step in steps:
            check(next_msg is not None and step.get('msgId') == next_msg, 'BEAVER_SEQUENCE_MISMATCH')
            current = self.state(step)
            check(player is None or current['pid'] == player, 'SESSION_CHANGED_MID_ROUND')
            player = current['pid']
            active = current['fid'] in {'1', '1|'}
            saw_cfg1 |= current['cfg1']
            if saw_cfg1:
                n, t, c = (current[k] for k in ('NFG', 'TFG', 'CFGG'))
                check(None not in (n, t, c) and t == n + c, 'BEAVER_CFG1_COUNTERS')
                if previous is not None:
                    check(c == previous['CFGG'] + 1 and t >= previous['TFG'], 'BEAVER_CFG1_PROGRESS')
                    if n == 0:
                        check(previous['NFG'] == 1 and t == previous['TFG'], 'BEAVER_CFG1_TERMINAL')
            saw_beaver |= current['beaverActive']
            check(not ((special or active) and saw_beaver), 'UNSUPPORTED_BEAVER_NESTED_FEATURE')
            if active and (previous is None or previous['fid'] not in {'1', '1|'}):
                check(previous is None, 'UNSUPPORTED_BEAVER_NESTED_FEATURE')
                check(current['NFG'] is not None and current['NFG'] > 0, 'BEAVER_EMPTY_FREE_TRIGGER')
            if special and not active:
                check(current['NFG'] == 0, 'UNSUPPORTED_BEAVER_NESTED_FEATURE')
            replay |= previous is not None and previous['fid'] in {'1', '1|'} and step['msgId'] == 'FREE_GAME'
            special |= active
            next_msg = 'FREE_GAME' if current['NFG'] else None
            previous = current
        return next_msg, special, replay

    def next_request(self, raw):
        msg, _, _ = self.sequence(raw)
        return {'MSGID': msg} if msg else None

    def settlement_evidence(self, raw):
        check(raw.get('roundFieldsVersion') == VERSION, 'ROUND_FIELDS_VERSION_REQUIRED')
        msg, special, replay = self.sequence(raw)
        check(msg is None and (not special or replay), 'INCOMPLETE_ROUND')
        end, win, kind, _ = nextgen(raw)
        stake = amount(raw.get('startBalanceRaw')) - end + win
        check(stake == self.plan['betRaw'], 'TRIAL_ACTUAL_COST_MISMATCH')
        return {'betRaw': stake, 'totalWinRaw': win, 'endBalanceRaw': end,
                'kind': kind, 'independentFid1': special}

    def settled(self, raw):
        check(raw.get('fixtureOnly') is False, 'TRIAL_PROFILE_REQUIRED')
        self.settlement_evidence(raw)
        fields = derive(raw)
        check(fields['buy'] == 0, 'TRIAL_ACTUAL_COST_MISMATCH')
        return fields
