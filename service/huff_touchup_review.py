"""Pure, fail-closed Touch Up sequence validation. No source permission.

Pinned client 67bcebfd...ffa4e93d: FID2 is Touch Up, NFG maps to ib.Ye,
CFGG to ib.Jd. FreegameTransitionOut can enter MansionIntro via VY
(FRAMEWINS=-100), or re-enter free games via Dj (Deed/HardHat combination).
This candidate rejects both exits and every unreviewed feature transition.
HuffFields may consume this validation; independent finite profile admission
still controls whether a live source request is allowed.
"""
from huff_feature_review import SOURCE, inspect_frame, game_state
from round_fields import check, params, amount

KNOWN_GSD = {'MMBG', 'BRS', 'BGHHPOS', 'BMS', 'VA', 'HHPOS', 'BWC', 'BWS',
             'FEAT', 'NEXTFRAMES', 'MMW', 'PCFID', 'FRAMES', 'PREVFRAMES', 'FRAMEWINS'}

EXTENSION = SOURCE + '-touchup-cash-v1'


def has_touchup(raw):
    return raw.get('sourceKey') == SOURCE and any(
        '2' in params(s['responsePayload']).get('FID', '').split('|') for s in raw['steps'])


def _numbers(value, separator, signed=False):
    import re
    check(isinstance(value, str) and bool(value), 'HUFF_MISSING_BOARD')
    pattern = r'-?[0-9]+' if signed else r'[0-9]+'
    parts = value.split(separator)
    check(all(re.fullmatch(pattern, p) for p in parts), 'HUFF_INVALID_BOARD')
    result = [int(p) for p in parts]
    check(all(abs(p) <= 9007199254740991 for p in result), 'HUFF_INVALID_BOARD')
    return result


def review_touchup(plan, raw):
    check(isinstance(raw, dict) and raw.get('sourceKey') == SOURCE
          and raw.get('protocol') == 'nextgen', 'HUFF_PROFILE_REQUIRED')
    steps = raw.get('steps')
    check(isinstance(steps, list) and 2 <= len(steps) <= 8, 'HUFF_TOUCHUP_LENGTH')
    player = None
    for index, step in enumerate(steps):
        check(step.get('msgId') == ('BET' if index == 0 else 'FREE_GAME'),
              'HUFF_SEQUENCE_MISMATCH')
        s = inspect_frame(plan, step)  # exact request, XML, money and inventory
        p, req = params(step['responsePayload']), params(step['requestPayload'])
        g = game_state(p.get('GSD', ''))
        check(set(g) <= KNOWN_GSD, 'HUFF_UNKNOWN_TOUCHUP_FIELD')
        check(p.get('FRBAL', '0') == '0' and not any(k in p for k in ('SB', 'FRTR', 'FRTW', 'BUY_IN'))
              and not any(k.startswith(('CFR_', 'CFP_', 'FR_')) for k in p),
              'HUFF_UNREVIEWED_FEATURE_PROTOCOL')
        check('GCT' not in p and p.get('RID') == '0', 'HUFF_REPLAY_NOT_ALLOWED')
        check(amount(step.get('elapsedMs')) <= 300000, 'INVALID_TRIAL_TIMING')
        check(player is None or player == req['PID'], 'SESSION_CHANGED_MID_ROUND')
        player = req['PID']
        board = _numbers(g.get('VA'), ',')
        check(len(board) == 15 and all(v <= 15 for v in board), 'HUFF_INVALID_BOARD')
        check(not (board.count(13) >= 3 and board.count(14) >= 6),
              'HUFF_COMBINED_EXIT_NOT_ADAPTED')
        if 'FRAMEWINS' in g:
            wins = _numbers(g['FRAMEWINS'], '|', signed=True)
            frames = _numbers(g.get('FRAMES'), '|')
            check(len(wins) == len(frames) == 15, 'HUFF_INVALID_FRAME_AWARDS')
            check(all(w >= 0 for w in wins), 'HUFF_FRAME_EXIT_NOT_ADAPTED')
        if index == 0:
            check(s['featureIds'] == [0] and not s['previousFeatureIds']
                  and s['replayFeatureId'] is None and g.get('MMBG') == '1'
                  and not g.get('MMW') and p['IFG'] == '0'
                  and s['counters'] == {'NFG': 1, 'TFG': 1, 'CFGG': 0},
                  'HUFF_TOUCHUP_TRIGGER_REQUIRED')
        elif index == 1:
            check(s['featureIds'] == [2] and s['previousFeatureIds'] == [0]
                  and s['replayFeatureId'] == 0 and g.get('MMBG') == '1'
                  and bool(g.get('MMW'))
                  and s['counters'] == {'NFG': 6, 'TFG': 6, 'CFGG': 0},
                  'HUFF_TOUCHUP_AWARD_REQUIRED')
        else:
            check(s['featureIds'] == [2] and s['previousFeatureIds'] in ([], [2])
                  and s['replayFeatureId'] == 2 and g.get('MMBG') in (None, '0')
                  and not g.get('MMW'), 'HUFF_TOUCHUP_TRANSITION_NOT_ADAPTED')
            check(s['counters'] == {'NFG': 7-index, 'TFG': 6, 'CFGG': index-1},
                  'HUFF_TOUCHUP_PROGRESS_NOT_ADAPTED')
            check('FRAMEWINS' in g and 'FRAMES' in g, 'HUFF_MISSING_FRAME_AWARDS')
    complete = len(steps) == 8
    if complete:
        start, end, win = amount(raw.get('startBalanceRaw')), amount(p['B']), amount(p['TW'])
        check(start-end+win == 500 and end == amount(p['AB']), 'HUFF_SETTLEMENT_MISMATCH')
    return {'schema': 'sg-huff-touchup-candidate-v1',
            'candidateComplete': complete, 'clientNext': None if complete else 'FREE_GAME',
            'captureAuthorized': False, 'sourceRequests': 0,
            'naturalTerminalObserved': False}
