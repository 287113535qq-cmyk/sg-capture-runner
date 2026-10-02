"""Independent original-XML ordinary cash candidate, not a capture profile.

Identity and stake are explicit review inputs; synthetic inputs never authorize
source use. Free, bonus, mystery and max-win responses are outside this scope.
"""
from pearl_fields import parse, one, REQUEST_HEADER
from round_fields import check, amount
from veryfruity_review import uint

SCHEMA = {
    'GameResponse': ('type', 'Header AccountData Balances GameResult'),
    'Header': ('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering', ''),
    'AccountData': ('', 'CurrencyMultiplier'), 'CurrencyMultiplier': ('', ''),
    'Balances': ('', 'Balance'), 'Balance': ('name value', ''),
    'GameResult': ('stake stakePerLine paylineCount totalWin betID', 'ReelResults BGInfo ScatterWinInfo'),
    'ReelResults': ('numSpins', 'ReelSpin'),
    'ReelSpin': ('freeSpin reelsetIndex spinIndex spinWins winCountPL winCountSC', 'ReelStops PaylineWin ScatterWin'),
    'ReelStops': ('', ''),
    'PaylineWin': ('index winVal awardIndex awardTableIndex', ''), 'ScatterWin': ('', ''),
    'BGInfo': ('totalWagerWin bgWinnings isMaxWin mysterySymbol', ''),
    'ScatterWinInfo': ('scatterCount totalWin', 'ScatterWin'),
}


def shape(node):
    check(node.tag in SCHEMA, 'VERYFRUITY_UNREVIEWED_XML')
    attrs, children = SCHEMA[node.tag]
    # ScatterWin has different attributes under ScatterWinInfo; caller verifies
    # that context explicitly before this generic recursive shape check.
    permitted = set(attrs.split()) | ({'index', 'win'} if node.tag == 'ScatterWin' else set())
    check(set(node.attrib) <= permitted and all(c.tag in children.split() for c in node),
          'VERYFRUITY_UNREVIEWED_XML')
    for child in node:
        shape(child)


def review_ordinary(raw, *, expected_header, stake_per_line, payline_count):
    check(isinstance(expected_header, dict) and set(expected_header) == REQUEST_HEADER - {'sessionID'}
          and all(isinstance(v, str) and len(v) <= 1024 for v in expected_header.values()),
          'VERYFRUITY_REVIEW_IDENTITY')
    check(expected_header.get('freePlay') == 'Y' and expected_header.get('promotions') == 'N',
          'VERYFRUITY_DEMO_REQUIRED')
    per_line, lines = uint(stake_per_line), uint(payline_count)
    check(per_line > 0 and 0 < lines <= 100, 'VERYFRUITY_REVIEW_STAKE')
    stake = uint(str(per_line * lines))
    check(isinstance(raw, dict) and set(raw) == {'startBalanceRaw', 'steps'}, 'VERYFRUITY_REVIEW_RAW')
    start = amount(raw['startBalanceRaw'])
    check(start >= stake, 'VERYFRUITY_REVIEW_BALANCE')
    steps = raw['steps']
    check(isinstance(steps, list) and 1 <= len(steps) <= 2, 'VERYFRUITY_ORDINARY_STEPS')
    session = None
    win = None
    for index, step in enumerate(steps):
        message = 'Logic' if index == 0 else 'EndGame'
        check(isinstance(step, dict) and set(step) == {'msgId', 'requestPayload', 'responsePayload', 'responseXml', 'elapsedMs'}
              and step['msgId'] == message, 'VERYFRUITY_ORDINARY_SEQUENCE')
        check(amount(step['elapsedMs']) <= 300000, 'VERYFRUITY_REVIEW_TIMING')
        q, response = parse(step['requestPayload']), parse(step['responseXml'])
        check(step['responsePayload'] == step['responseXml'], 'VERYFRUITY_XML_EVIDENCE')
        check(q.tag == 'GameRequest' and q.attrib == {'type': message}, 'VERYFRUITY_REQUEST')
        h = one(q, 'Header')
        check(set(h.attrib) == REQUEST_HEADER and not len(h), 'VERYFRUITY_REQUEST_IDENTITY')
        check({k: v for k, v in h.attrib.items() if k != 'sessionID'} == expected_header,
              'VERYFRUITY_REQUEST_IDENTITY')
        check(0 < len(h.get('sessionID', '')) <= 1024 and (session is None or h.get('sessionID') == session),
              'VERYFRUITY_SESSION')
        required = ['Header', 'AccountData'] + (['Stake', 'PaylineCount'] if index == 0 else [])
        check(sorted(c.tag for c in q) == sorted(required), 'VERYFRUITY_REQUEST')
        account = one(q, 'AccountData')
        currency = one(account, 'CurrencyMultiplier')
        check(not account.attrib and len(account) == 1 and not currency.attrib and not len(currency)
              and currency.text == '1', 'VERYFRUITY_CURRENCY')
        if index == 0:
            bet, count = one(q, 'Stake'), one(q, 'PaylineCount')
            check(bet.attrib == {'perLine': stake_per_line, 'total': str(stake)} and not len(bet)
                  and count.attrib == {'count': payline_count} and not len(count), 'VERYFRUITY_REQUEST_STAKE')
        shape(response)
        check(response.tag == 'GameResponse' and response.attrib == {'type': message}, 'VERYFRUITY_RESPONSE')
        accounts = response.findall('AccountData')
        check(len(accounts) <= 1 and sorted(c.tag for c in response)
              == sorted(['Header', 'Balances'] + (['GameResult'] if index == 0 else [])
                        + (['AccountData'] if accounts else [])), 'VERYFRUITY_RESPONSE_SHAPE')
        if accounts:
            currency_response = one(accounts[0], 'CurrencyMultiplier')
            check(len(accounts[0]) == 1 and currency_response.text == '1', 'VERYFRUITY_CURRENCY')
        rh = one(response, 'Header')
        check(all(rh.get(k) == expected_header[k] for k in ('gameID', 'versionID', 'ccyCode', 'lang'))
              and rh.get('isRecovering') == 'N', 'VERYFRUITY_RESPONSE_IDENTITY')
        session = rh.get('sessionID')
        check(isinstance(session, str) and 0 < len(session) <= 1024, 'VERYFRUITY_SESSION')
        balances = one(response, 'Balances')
        cash = one(balances, 'Balance')
        check(len(balances) == 1 and cash.get('name') == 'CASH_BALANCE'
              and set(cash.attrib) == {'name', 'value'}, 'VERYFRUITY_CASH_BALANCE')
        balance = uint(cash.get('value'))
        if index == 0:
            g = one(response, 'GameResult')
            check(set(g.attrib) == {'stake', 'stakePerLine', 'paylineCount', 'totalWin', 'betID'}
                  and 0 < len(g.get('betID', '')) <= 256
                  and g.get('stake') == str(stake) and g.get('stakePerLine') == stake_per_line
                  and g.get('paylineCount') == payline_count, 'VERYFRUITY_RESPONSE_STAKE')
            win = uint(g.get('totalWin'))
            bg = one(g, 'BGInfo')
            check(set(bg.attrib) == {'totalWagerWin', 'bgWinnings', 'isMaxWin', 'mysterySymbol'}
                  and bg.get('isMaxWin') == '0' and bg.get('mysterySymbol') == '0'
                  and uint(bg.get('totalWagerWin')) == uint(bg.get('bgWinnings')) == win,
                  'VERYFRUITY_CASH_WIN_SCOPE')
            reels = one(g, 'ReelResults')
            spin = one(reels, 'ReelSpin')
            check(reels.attrib == {'numSpins': '1'} and len(reels) == 1
                  and set(spin.attrib) == {'freeSpin', 'reelsetIndex', 'spinIndex', 'spinWins', 'winCountPL', 'winCountSC'}
                  and spin.get('reelsetIndex') == '0'
                  and spin.get('freeSpin') == 'N' and spin.get('spinIndex') == '0',
                  'VERYFRUITY_ORDINARY_REELS')
            stops = one(spin, 'ReelStops').text
            check(isinstance(stops, str) and len(stops.split('|')) == 5, 'VERYFRUITY_REEL_STOPS')
            for stop in stops.split('|'):
                uint(stop)
            pay = spin.findall('PaylineWin')
            check(uint(spin.get('winCountPL')) == len(pay)
                  and spin.get('winCountSC') == '0' and not spin.findall('ScatterWin')
                  and not g.findall('ScatterWinInfo'), 'VERYFRUITY_SCATTER_NOT_REVIEWED')
            seen, total = set(), 0
            for item in pay:
                idx = uint(item.get('index'))
                check(idx < lines and idx not in seen and set(item.attrib) == {'index', 'winVal', 'awardIndex', 'awardTableIndex'},
                      'VERYFRUITY_PAYLINE')
                seen.add(idx)
                uint(item.get('awardIndex')); uint(item.get('awardTableIndex'))
                positions = item.text.split('|') if isinstance(item.text, str) else []
                check(1 <= len(positions) <= 5 and len(set(positions)) == len(positions)
                      and all(uint(pos) < 15 for pos in positions),
                      'VERYFRUITY_PAYLINE_POSITION')
                total += uint(item.get('winVal'))
            check(total == win == uint(spin.get('spinWins')), 'VERYFRUITY_PAYLINE_WIN')
        else:
            check(not response.findall('GameResult'), 'VERYFRUITY_ENDGAME_FEATURE')
        check(balance == start - stake + win, 'VERYFRUITY_CASH_MOVEMENT')
    return {'nextRequestHypothesis': 'EndGame' if len(steps) == 1 else None,
            'endGameAcknowledged': len(steps) == 2, 'betRaw': stake, 'winRaw': win,
            'endBalanceRaw': balance, 'captureAuthorization': False,
            'independentIdentityAndNaturalXmlRequired': True}
