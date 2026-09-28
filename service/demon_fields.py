"""32739 reaction spins and the client's explicit FID=1|0| free mode.

The client routes both through FREE_GAME and ends on NFG=0. NFG may
stay constant or increase; TFG/CFGG reset at a mode transition. Other
FID stacks remain unsupported. This module does not resume parked state.
"""
import xml.etree.ElementTree as ET

from native_nextgen_fields import NativeNextgenFields
from round_fields import VERSION, FieldError, amount, check, derive, params

SOURCE = 'thedemoncodecap250c96-round-one-base-v1'
EXTENSION = SOURCE + '-demon-free-v1'
CLIENT_SHA256 = 'c3327610020e409155c59cd19ff22d3aec5251f4a1f57d478d2ac80baf14295c'


def feature_type(raw):
    special = False
    for step in raw['steps']:
        fid = params(step['responsePayload']).get('FID', '')
        check(fid in {'', '0', '0|', '1|0|'}, 'UNKNOWN_TRIAL_FEATURE')
        special |= fid == '1|0|'
    return 'demonFreeGames' if special else None


class DemonFields(NativeNextgenFields):
    def __init__(self, plan):
        check(plan.get('gameId') == 32739 and plan.get('sourceKey') == SOURCE,
              'DEMON_PROFILE_REQUIRED')
        super().__init__(plan)

    def state(self, step):
        check(isinstance(step, dict), 'INVALID_TRIAL_FRAME')
        msg = step.get('msgId')
        self.request_params(step.get('requestPayload'), msg)
        p = params(step.get('responsePayload'))
        check(p.get('MSGID') == msg, 'MESSAGE_ID_MISMATCH')
        fid = p.get('FID', '')
        check(fid in {'', '0', '0|', '1|0|'} and not any(
            key.startswith(('FS_', 'NFR_')) for key in p)
            and 'CFG' not in p and 'ABPM' not in p, 'UNKNOWN_TRIAL_FEATURE')
        for key in ('B', 'AB', 'TW'):
            amount(p.get(key))
        check(p.get('IFG') in {'0', '1'}, 'INVALID_NEXTGEN_STATE')
        check(msg != 'FREE_GAME' or p['IFG'] == '1', 'INVALID_FREE_GAME_STATE')
        counters = {key: amount(p[key]) if key in p else None for key in ('NFG', 'TFG', 'CFGG')}
        check(all(value is None or value <= 100 for value in counters.values()), 'TRIAL_FREE_LIMIT')
        if msg == 'FREE_GAME' or fid == '1|0|' or counters['NFG']:
            check(all(value is not None for value in counters.values()), 'DEMON_MISSING_FREE_COUNTER')
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
        return {'fid': fid, **counters}

    def frame(self, step):
        return self.state(step)['NFG'] or 0

    def _sequence(self, raw):
        check(isinstance(raw, dict) and raw.get('sourceKey') == SOURCE
              and raw.get('protocol') == 'nextgen', 'DEMON_PROFILE_REQUIRED')
        steps = raw.get('steps')
        check(isinstance(steps, list) and 0 < len(steps) <= 100, 'INVALID_ROUND_STEPS')
        next_msg, player, previous = 'BET', None, None
        replay = False
        for step in steps:
            check(next_msg is not None and step.get('msgId') == next_msg, 'DEMON_SEQUENCE_MISMATCH')
            current = self.state(step)
            pid = params(step['requestPayload'])['PID']
            check(player is None or player == pid, 'SESSION_CHANGED_MID_ROUND')
            player = pid
            # A response announcing FID1 must be followed by a FREE_GAME.
            # The final response can clear FID; it is still that replay.
            replay |= previous is not None and previous['fid'] == '1|0|' and step['msgId'] == 'FREE_GAME'
            if current['fid'] == '1|0|' and (previous is None or previous['fid'] != '1|0|'):
                check(current['NFG'] is not None and current['NFG'] > 0, 'DEMON_EMPTY_FREE_TRIGGER')
            next_msg = 'FREE_GAME' if current['NFG'] else None
            previous = current
        return next_msg, replay

    def next_request(self, raw):
        next_msg, _ = self._sequence(raw)
        return {'MSGID': next_msg} if next_msg else None

    def settled(self, raw):
        check(raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion') == VERSION,
              'TRIAL_PROFILE_REQUIRED')
        next_msg, replay = self._sequence(raw)
        check(next_msg is None, 'INCOMPLETE_ROUND')
        check(feature_type(raw) is None or replay, 'DEMON_MISSING_FREE_REPLAY')
        fields = derive(raw)
        check(fields['money']['betRaw'] == self.plan['betRaw'] and fields['buy'] == 0,
              'TRIAL_ACTUAL_COST_MISMATCH')
        return fields
