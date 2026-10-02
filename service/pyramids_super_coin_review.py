"""Reviewed SFGT + signed cash coins; natural eight-frame prefix is unfinished.

Compose only the fixed ten-free route and original Mini/Minor/Major projection.
No retrigger, hold transition, jackpot award or source permission is inferred.
"""
from pyramids_super_free_review import PyramidsSuperFreeSequence, has_super_free
from pyramids_free_review import SOURCE
from round_fields import check, params, amount

EXTENSION = SOURCE + '-pyramids-super-cash-coins-v1'

def has_super_coins(raw):
    return has_super_free(raw) and any(
        row.split(';')[2:3] in (['-4'], ['-3'], ['-2'])
        for step in raw.get('steps', [])
        for segment in params(step['responsePayload']).get('GSD', '').split('#')
        if segment.startswith('CL~') for row in segment[3:].split('|'))

class PyramidsSuperCoinSequence(PyramidsSuperFreeSequence):
    def reviewed_negative_coin(self, key, index, value):
        return key == 'CL' and index > 0 and value in (-4, -3, -2)

    def sequence(self, raw):
        next_request = super().sequence(raw)
        start, previous_win = amount(raw['startBalanceRaw']), 0
        for step in raw['steps']:
            p = params(step['responsePayload'])
            win, balance, available = (amount(p[k]) for k in ('TW', 'B', 'AB'))
            check(win >= previous_win and balance == start - 20 + win, 'PYRAMIDS_SUPER_COIN_MONEY')
            check(available == (balance if int(p['NFG']) == 0 else start - 20), 'PYRAMIDS_SUPER_COIN_AVAILABLE')
            if 'responseBalance' in step:
                check(amount(step['responseBalance']) == available, 'PYRAMIDS_SUPER_COIN_RESPONSE_BALANCE')
            previous_win = win
        return next_request
