"""Offline FSInfo difference review for Very Fruity; no capture admission.

This reviews parsed fields independently of the permissive display parser.
It deliberately supplies no normalized round, money settlement or source profile.
"""
import re

from round_fields import check

CLIENT_SHA256 = '73d7979bc75f7d7c15748ce85bb02866592d61051bbf2b42a569be91fda02ab2'
FREE_FIELDS = frozenset({'freeSpinNumber', 'freeSpinsTotal', 'fsWinnings', 'originalScatterWin'})


def uint(value):
    check(isinstance(value, str) and len(value) <= 16 and re.fullmatch(r'0|[1-9][0-9]*', value) is not None,
          'VERYFRUITY_INVALID_INTEGER')
    result = int(value)
    check(result <= 9007199254740991, 'VERYFRUITY_UNSAFE_INTEGER')
    return result


def review_free_prefix(frames, *, step_limit=1000):
    """Return a route hypothesis, never a complete or source-authorized round.

    Total increments are observed facts, not a fixed assumed initial award.
    A changed total is reported as needing award review and not accepted as a
    verified retrigger. Max-win and counter-overrun exits remain unreviewed.
    """
    check(isinstance(step_limit, int) and not isinstance(step_limit, bool)
          and 1 <= step_limit <= 1000, 'VERYFRUITY_REVIEW_LIMIT')
    check(isinstance(frames, list) and 0 < len(frames) <= step_limit,
          'VERYFRUITY_REVIEW_STEPS')
    session = None
    previous = None
    for index, frame in enumerate(frames):
        check(isinstance(frame, dict) and set(frame) == {'requestSession', 'responseSession', 'FSInfo'},
              'VERYFRUITY_REVIEW_SHAPE')
        request_session, response_session = frame['requestSession'], frame['responseSession']
        check(all(isinstance(v, str) and 0 < len(v) <= 1024 for v in (request_session, response_session)),
              'VERYFRUITY_REVIEW_SESSION')
        check(session is None or request_session == session, 'VERYFRUITY_REVIEW_SESSION')
        check(response_session == request_session, 'VERYFRUITY_SESSION_ROTATION_NOT_REVIEWED')
        session = response_session
        free = frame['FSInfo']
        check(isinstance(free, dict) and set(free) == FREE_FIELDS, 'VERYFRUITY_FREE_FIELDS')
        values = {key: uint(value) for key, value in free.items()}
        current, total = values['freeSpinNumber'], values['freeSpinsTotal']
        check(0 < total <= step_limit and current <= total, 'VERYFRUITY_FREE_COUNTERS')
        if index == 0:
            check(current == 0, 'VERYFRUITY_TRIGGER_NOT_REVIEWED')
        if previous is not None:
            pc, pt, pw = previous
            check(pc < pt and current == pc + 1, 'VERYFRUITY_FREE_PROGRESS')
            check(total == pt, 'VERYFRUITY_RETRIGGER_NOT_REVIEWED')
            check(values['fsWinnings'] >= pw, 'VERYFRUITY_FREE_WIN_REGRESSION')
        previous = current, total, values['fsWinnings']
    return {'nextRequestHypothesis': 'EndGame' if current == total else 'Logic',
            'counterTerminalObserved': current == total,
            'complete': False, 'captureAuthorization': False,
            'requiresOriginalXmlAndMoneyReview': True}
