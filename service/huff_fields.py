"""32714 ordinary/Money Mansion/Hard Hat continuation and settlement.

The pinned client sends FREE_GAME for Hard Hat while NFG is positive. A
Money Mansion intro needs one FREE_GAME when MMBG is set but MMW is absent.
Other named features remain rejected until their own sequence is validated.
The field inventory alone never authorizes a continuation or settlement.
"""
from huff_feature_review import SOURCE, inspect_frame, game_state, feature_ids
from native_nextgen_fields import NativeNextgenFields
from round_fields import VERSION, amount, check, derive, params
from huff_touchup_review import has_touchup, review_touchup
from huff_retrigger_review import has_retrigger, review as review_retrigger

EXTENSION = SOURCE + '-hard-hat-v1'


def feature_type(raw):
    """Add a type only to newly supported Hard Hat chains; keep old hashes."""
    if has_retrigger(raw):
        return 'hardHatRetrigger'
    if has_touchup(raw):
        # Sequence validation is performed before settlement. This separate
        # mapping never rewrites historical ordinary/Hard Hat receipts.
        return 'moneyMansionTouchUp'
    hard_hat = mansion = False
    for step in raw['steps']:
        p = params(step['responsePayload'])
        ids = feature_ids(p.get('FID', ''))
        gsd = game_state(p.get('GSD', ''))
        check(set(ids) <= {0, 1} and gsd.get('FEAT') in {None, 'MMANSION', 'HARDHAT'},
              'HUFF_FEATURE_NOT_ADAPTED')
        hard_hat |= 1 in ids or gsd.get('FEAT') == 'HARDHAT'
        mansion |= (0 in ids and amount(p.get('NFG', '0')) > 0) \
            or gsd.get('FEAT') == 'MMANSION' or gsd.get('MMBG') == '1'
    return ('hardHatAndMoneyMansion' if mansion else 'hardHat') if hard_hat else None


class HuffFields(NativeNextgenFields):
    def __init__(self, plan):
        check(plan.get('gameId') == 32714 and plan.get('sourceKey') == SOURCE,
              'HUFF_PROFILE_REQUIRED')
        super().__init__(plan)

    def state(self, step):
        state = inspect_frame(self.plan, step)
        # Inventory recognizes more client modes than this capture adapter.
        check(set(state['featureIds'] + state['previousFeatureIds']) <= {0, 1}
              and state['replayFeatureId'] in {None, 0, 1}, 'HUFF_FEATURE_NOT_ADAPTED')
        check(amount(step.get('elapsedMs')) <= 300000, 'INVALID_TRIAL_TIMING')
        return state

    def frame(self, step):
        state = self.state(step)
        return state['counters']['NFG'] or 0

    def next_request(self, raw):
        if has_retrigger(raw):
            result = review_retrigger(raw)
            return {'MSGID':result['next']} if result['next'] else None
        if has_touchup(raw):
            result = review_touchup(self.plan, raw)
            return {'MSGID': result['clientNext']} if result['clientNext'] else None
        check(isinstance(raw, dict) and raw.get('sourceKey') == SOURCE
              and raw.get('protocol') == 'nextgen', 'HUFF_PROFILE_REQUIRED')
        steps = raw.get('steps')
        check(isinstance(steps, list) and 0 < len(steps) <= 100, 'INVALID_ROUND_STEPS')
        next_msg, player = 'BET', None
        for step in steps:
            check(next_msg is not None and step.get('msgId') == next_msg,
                  'HUFF_SEQUENCE_MISMATCH')
            state = self.state(step)
            current = params(step['requestPayload'])['PID']
            check(player is None or player == current, 'SESSION_CHANGED_MID_ROUND')
            player = current
            counters = state['counters']
            mansion_pending = state['featureIds'][:1] == [0] \
                and state['mansionFlag'] == '1' and not state['mansionResultPresent']
            next_msg = 'FREE_GAME' if counters['NFG'] or mansion_pending else None
            if step['msgId'] == 'BET' and 1 in state['featureIds']:
                check(counters['NFG'] is not None and counters['NFG'] > 0,
                      'HUFF_MISSING_HARD_HAT_CONTINUATION')
        return {'MSGID': next_msg} if next_msg else None

    def settled(self, raw):
        check(raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion') == VERSION,
              'TRIAL_PROFILE_REQUIRED')
        check(self.next_request(raw) is None, 'INCOMPLETE_ROUND')
        kind = feature_type(raw)
        if kind in {'hardHat', 'hardHatAndMoneyMansion'}:
            check(any(step['msgId'] == 'FREE_GAME'
                      and game_state(params(step['responsePayload']).get('GSD', '')).get('FEAT') == 'HARDHAT'
                      for step in raw['steps']), 'HUFF_MISSING_HARD_HAT_REPLAY')
        if kind == 'hardHatAndMoneyMansion':
            check(any(step['msgId'] == 'FREE_GAME'
                      and game_state(params(step['responsePayload']).get('GSD', '')).get('FEAT') == 'MMANSION'
                      for step in raw['steps']), 'HUFF_MISSING_MANSION_REPLAY')
        fields = derive(raw)
        check(fields['money']['betRaw'] == self.plan['betRaw'] and fields['buy'] == 0,
              'TRIAL_ACTUAL_COST_MISMATCH')
        return fields
