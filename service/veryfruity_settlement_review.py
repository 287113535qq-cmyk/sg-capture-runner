"""Independent original-XML money evidence; no profile or source permission.

Display extensions are preserved. The cumulative wallet hypothesis is strict
and must pass natural canary evidence before capture admission.
"""
from pearl_fields import parse, one, REQUEST_HEADER
from round_fields import amount, check
from veryfruity_review import uint
from veryfruity_action_review import review_actions


def review_settlement(raw, *, expected_header, stake_per_line, payline_count):
    check(set(expected_header) == REQUEST_HEADER - {'sessionID'}, 'VERYFRUITY_MONEY_IDENTITY')
    route = review_actions(raw, expected_header=expected_header)
    per_line, lines = uint(stake_per_line), uint(payline_count)
    check(per_line > 0 and 0 < lines <= 100, 'VERYFRUITY_MONEY_STAKE')
    stake = amount(per_line * lines)
    start = amount(raw.get('startBalanceRaw'))
    check(start >= stake, 'VERYFRUITY_MONEY_BALANCE')
    total = 0
    for step in raw['steps']:
        check(amount(step.get('elapsedMs')) <= 300000, 'VERYFRUITY_MONEY_TIMING')
        q, r = parse(step['requestPayload']), parse(step['responseXml'])
        check(q.attrib == {'type': step['msgId']} and r.attrib == {'type': step['msgId']},
              'VERYFRUITY_MONEY_REQUEST')
        h = one(q, 'Header')
        check(set(h.attrib) == REQUEST_HEADER, 'VERYFRUITY_MONEY_IDENTITY')
        logic = step['msgId'] == 'Logic'
        check(sorted(n.tag for n in q) == sorted(['Header', 'AccountData'] +
              (['Stake', 'PaylineCount'] if logic else [])), 'VERYFRUITY_MONEY_REQUEST')
        account = one(q, 'AccountData')
        c = one(account, 'CurrencyMultiplier')
        check(not account.attrib and len(account) == 1 and not c.attrib and not len(c)
              and c.text == '1', 'VERYFRUITY_MONEY_CURRENCY')
        if logic:
            bet, count = one(q, 'Stake'), one(q, 'PaylineCount')
            check(not len(bet) and bet.attrib == {'perLine': stake_per_line, 'total': str(stake)}
                  and not len(count) and count.attrib == {'count': payline_count}, 'VERYFRUITY_MONEY_STAKE')
            g = one(r, 'GameResult')
            check(g.get('stake') == str(stake) and g.get('stakePerLine') == stake_per_line
                  and g.get('paylineCount') == payline_count, 'VERYFRUITY_MONEY_STAKE')
            total = amount(total + uint(g.get('totalWin')))
            check(uint(one(g, 'BGInfo').get('totalWagerWin')) == total, 'VERYFRUITY_MONEY_CUMULATIVE')
        balances = one(r, 'Balances')
        cash = one(balances, 'Balance')
        check(not balances.attrib and len(balances) == 1 and not len(cash)
              and set(cash.attrib) == {'name', 'value'} and cash.get('name') == 'CASH_BALANCE',
              'VERYFRUITY_MONEY_BALANCE')
        balance = uint(cash.get('value'))
        check(balance == start - stake + total, 'VERYFRUITY_MONEY_MOVEMENT')
    return {'nextRequestHypothesis': route['nextRequestHypothesis'],
            'endGameAcknowledged': route['endGameAcknowledged'],
            'moneyEvidenceVerified': True, 'complete': False, 'captureAuthorization': False,
            'requiresNaturalCanary': True, 'betRaw': stake, 'winRaw': total,
            'startBalanceRaw': start, 'endBalanceRaw': balance,
            'classificationStatus': 'pending', 'bonus': None}
