"""Independent original-XML cash coin validator; mapping is not admission.

Official Mini/Minor/Major symbols retain their signed original values. Init
JPV supplies display factors; this validator never treats those factors as TW.
The natural 15-frame retrigger prefix is unfinished. Terminal tests are synthetic.
"""
from pyramids_retrigger_review import PyramidsRetriggerSequence
from pyramids_free_review import SOURCE
from round_fields import check, params, amount

EXTENSION = SOURCE + '-pyramids-cash-coins-v1'


def has_cash_coins(raw):
    steps = raw.get('steps', [])
    if raw.get('sourceKey') != SOURCE or not steps:
        return False
    first = params(steps[0]['responsePayload'])
    if first.get('FID') not in {'1', '1|'} or first.get('TFG') != '10':
        return False
    retrigger = any(amount(params(s['responsePayload']).get('TFG', '0')) > 10 for s in steps[1:])
    return any(row.split(';')[2:3] in (['-4'], ['-2'])
               or retrigger and row.split(';')[2:3] == ['-3']
               for step in steps for segment in params(step['responsePayload']).get('GSD', '').split('#')
               if segment.startswith('CL~') for row in segment[3:].split('|'))


class PyramidsCoinSequence(PyramidsRetriggerSequence):
    def reviewed_negative_coin(self, key, index, value):
        return key == 'CL' and index > 0 and value in (-4, -3, -2)

    def sequence(self, raw):
        next_request = super().sequence(raw)
        # Actual prefix binds the uncredited base balance to cumulative TW.
        # No new value is computed from a signed symbol or display multiplier.
        start = amount(raw.get('startBalanceRaw'))
        previous_win = 0
        for i, step in enumerate(raw['steps']):
            p = params(step['responsePayload'])
            win, balance, available = (amount(p[k]) for k in ('TW', 'B', 'AB'))
            check(win >= previous_win and balance == start - 20 + win,
                  'PYRAMIDS_COIN_CUMULATIVE_MONEY')
            check(available == (balance if int(p['NFG']) == 0 else start - 20),
                  'PYRAMIDS_COIN_AVAILABLE_BALANCE')
            if 'responseBalance' in step:
                # GDM account balance is AB during the uncredited feature.
                # B includes cumulative TW; at a reviewed cash exit both agree.
                check(amount(step['responseBalance']) == available, 'PYRAMIDS_COIN_RESPONSE_BALANCE')
            previous_win = win
        return next_request

    def review(self, raw):
        next_request = self.sequence(raw)
        result = {'nextRequestHypothesis': next_request, 'complete': next_request is None,
                  'captureAuthorization': False, 'sourceRequests': 0,
                  'naturalCoinTerminalObserved': False, 'mappingRegistered': True}
        if next_request is None:
            result['settlement'] = super().settled(raw)
        return result
