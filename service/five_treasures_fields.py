"""Offline WMS boundary independently replayed against Five Treasures evidence.

The result keeps the original WMS per-Logic money and rolling session chain.
Only the evidenced ordinary stake and six-spin choices 0 through 4 are accepted. This
module has no source transport, admission registration or Mongo operations.
"""
from pearl_fields import parse, one
from round_fields import amount, check, VERSION

SOURCE = 'fivetreasures-ag-rolling-wms-v1'
HEADER = dict(affiliate='0', ccyCode='', channel='I', freePlay='Y',
              gameCodeRGI='fivetreasures', gameID='20442', glsID='65535',
              lang='en_US', promotions='N', userID='null', userType='C', versionID='1_0')
SCHEMA = {
    'GameResponse': ('type', 'Header AccountData Balances GameResult'),
    'Header': ('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering readyForEndGame', ''),
    'AccountData': ('', 'AccountData CurrencyMultiplier'), 'CurrencyMultiplier': ('', ''),
    'Balances': ('', 'Balance'), 'Balance': ('name value', ''),
    'GameResult': ('stake totalWin betID', 'ReelResults BGInfo FSInfo BaseGameRecoveryInfo JackpotInfo'),
    'ReelResults': ('numSpins', 'ReelSpin'),
    'ReelSpin': ('anywayWins bonusAwarded freeSpin reelsetIndex scatterWinCount spinIndex totalSpinWin', 'AnywayWin ReelStops ScatterWin'),
    'AnywayWin': ('awardIndex ways winIndex winVal', ''), 'ReelStops': ('', ''),
    'ScatterWin': ('awardIndex winVal', ''), 'BGInfo': ('bgWinnings isMaxWin totalWagerWin', ''),
    'FSInfo': ('extraSpinsAwarded freeSpinMode freeSpinNumber freeSpinsTotal fsWinnings', ''),
    'BaseGameRecoveryInfo': ('', 'ReelResults'), 'JackpotInfo': ('jackpotIndex jackpotWinnings', ''),
}


def request(text, msg, *, first=False):
    root = parse(text)
    check(root.tag == 'GameRequest' and root.attrib == {'type': 'Logic' if msg == 'FreeSpinChoice' else msg}, 'WMS_REQUEST_MISMATCH')
    header = one(root, 'Header')
    check(not len(header) and {k:v for k,v in header.attrib.items() if k != 'sessionID'} == HEADER,
          'WMS_REQUEST_MODE')
    session = header.get('sessionID')
    check(isinstance(session, str) and 0 < len(session) <= 1024, 'WMS_SESSION_REQUIRED')
    tags = [n.tag for n in root]
    if first:
        check(msg == 'Logic' and tags == ['Header', 'Stake', 'PaylineCount', 'AccountData'], 'WMS_REQUEST_MISMATCH')
        check(one(root, 'Stake').attrib == {'total':'176'} and not len(one(root, 'Stake')), 'WMS_REQUEST_MODE')
        check(one(root, 'PaylineCount').attrib == {'count':'1'} and not len(one(root, 'PaylineCount')), 'WMS_REQUEST_MODE')
        account = one(root, 'AccountData')
        currency = one(account, 'CurrencyMultiplier')
        check(not account.attrib and len(account) == 1 and not currency.attrib and not len(currency)
              and currency.text == '1', 'WMS_REQUEST_MODE')
    elif msg == 'FreeSpinChoice':
        check(tags == ['Header', 'FreeSpinChoice'] and set(one(root, 'FreeSpinChoice').attrib) == {'type'}
              and one(root, 'FreeSpinChoice').get('type') in ('0','1','2','3','4')
              and not len(one(root, 'FreeSpinChoice')), 'WMS_CHOICE_NOT_ADAPTED')
    else:
        check(msg in ('Logic', 'EndGame') and tags == ['Header'], 'WMS_REQUEST_MISMATCH')
    return session


def review(raw):
    check(raw.get('sourceKey') == SOURCE and raw.get('protocol') == 'wms' and raw.get('fixtureOnly') is False
          and raw.get('roundFieldsVersion') == VERSION, 'WMS_PROFILE_REQUIRED')
    steps = raw.get('steps')
    check(isinstance(steps, list) and len(steps) <= 8, 'INVALID_ROUND_STEPS')
    start = balance = amount(raw.get('startBalanceRaw'))
    total = initial_win = 0
    session = None
    free = None
    free_number = 0
    choice = None
    next_msg = 'Logic'
    for index, step in enumerate(steps):
        check(next_msg is not None and step.get('msgId') == next_msg, 'WMS_SEQUENCE_MISMATCH')
        qsession = request(step.get('requestPayload'), next_msg, first=index == 0)
        if next_msg == 'FreeSpinChoice':
            choice = one(parse(step['requestPayload']), 'FreeSpinChoice').get('type')
        check(session is None or qsession == session, 'WMS_SESSION_CHAIN_MISMATCH')
        root = parse(step.get('responsePayload'))
        other = parse(step.get('responseXml'))
        def shape(node):
            return (node.tag, sorted(node.attrib.items()), (node.text or '').strip(), [shape(c) for c in node])
        check(shape(root) == shape(other), 'WMS_XML_EVIDENCE_MISMATCH')
        check(root.tag == 'GameResponse' and root.attrib == {'type':'Logic' if next_msg == 'FreeSpinChoice' else next_msg},
              'MESSAGE_ID_MISMATCH')
        for node in root.iter():
            spec = SCHEMA.get(node.tag)
            check(spec is not None and set(node.attrib) <= set(spec[0].split())
                  and all(c.tag in spec[1].split() for c in node), 'WMS_FEATURE_NOT_ADAPTED')
        h = one(root, 'Header')
        check(h.get('gameID') == '20442' and h.get('versionID') == '1_0' and h.get('isRecovering') == 'N',
              'WMS_RESPONSE_IDENTITY_MISMATCH')
        session = h.get('sessionID')
        check(isinstance(session, str) and 0 < len(session) <= 1024, 'WMS_SESSION_REQUIRED')
        check(amount(step.get('elapsedMs')) <= 300000 and not step.get('sourceRejected'), 'INVALID_TRIAL_TIMING')
        if next_msg == 'EndGame':
            check(index == len(steps)-1 and not root.findall('GameResult') and h.get('readyForEndGame') == 'N',
                  'WMS_ENDGAME_MISMATCH')
            next_msg = None
        else:
            result = one(root, 'GameResult')
            check(result.get('stake') == '176', 'WMS_WAGER_MISMATCH')
            award = amount(result.get('totalWin'))
            if index == 0:
                balance -= 176
                initial_win = award
            total += award
            balance += award
            amount(total); amount(balance)
            bg = one(result, 'BGInfo')
            check(bg.get('isMaxWin') == '0' and amount(bg.get('bgWinnings')) == initial_win
                  and amount(bg.get('totalWagerWin')) == total, 'WMS_CUMULATIVE_WIN_MISMATCH')
            fs = result.findall('FSInfo')
            if free is None:
                free = bool(fs)
            if free:
                f = one(result, 'FSInfo')
                if index:
                    free_number += 1
                    check(choice is not None and f.get('freeSpinMode') == choice, 'WMS_CHOICE_NOT_ADAPTED')
                check(f.get('freeSpinsTotal') == '6' and f.get('extraSpinsAwarded') == '0'
                      and amount(f.get('freeSpinNumber')) == free_number and free_number <= 6,
                      'WMS_FREE_COUNTER_MISMATCH')
                check(amount(f.get('fsWinnings')) == total-initial_win, 'WMS_CUMULATIVE_WIN_MISMATCH')
            else:
                check(index == 0 and not fs, 'WMS_SEQUENCE_MISMATCH')
            reels = one(result, 'ReelResults')
            spins = reels.findall('ReelSpin')
            check(reels.get('numSpins') == '1' and len(spins) == 1
                  and spins[0].get('freeSpin') == ('Y' if index else 'N')
                  and spins[0].get('bonusAwarded') == ('Y' if free and index == 0 else 'N'), 'WMS_REEL_STATE_MISMATCH')
            jackpots = result.findall('JackpotInfo')
            check(len(jackpots) <= 1 and all(n.get('jackpotIndex') == '0' for n in jackpots), 'WMS_JACKPOT_NOT_ADAPTED')
            jackpot_win = sum(amount(n.get('jackpotWinnings')) for n in jackpots)
            check(amount(spins[0].get('totalSpinWin'))+jackpot_win == award, 'WMS_REEL_WIN_MISMATCH')
            pending = bool(free and free_number < 6)
            check(h.get('readyForEndGame') == ('N' if pending else 'Y'), 'WMS_SETTLEMENT_FLAG_MISMATCH')
            next_msg = 'FreeSpinChoice' if free and index == 0 else 'Logic' if pending else 'EndGame'
        balances = one(root, 'Balances')
        check(len(balances) == 1 and one(balances, 'Balance').attrib == {'name':'CASH_BALANCE','value':str(balance)}
              and amount(step.get('responseBalance')) == balance, 'WMS_BALANCE_MISMATCH')
    return {'next': next_msg, 'session': session, 'feature': bool(free), 'start': start, 'balance': balance, 'win': total}


def settled(raw, mapping_hash):
    state = review(raw)
    check(state['next'] is None and state['start']-state['balance']+state['win'] == 176, 'INCOMPLETE_ROUND')
    import re
    check(re.fullmatch('[a-f0-9]{64}', mapping_hash or '') is not None, 'WMS_MAPPING_REQUIRED')
    return {'roundFieldsVersion': VERSION, 'protocol':'wms', 'sourceKey':SOURCE,
            'bet':1.76, 'mul':state['win']/176, 'buy':0, 'bonus':int(state['feature']),
            'primaryBonusKind':'freeGame' if state['feature'] else 'none', 'typeMappingHash':mapping_hash,
            'money':{'startBalanceRaw':state['start'],'endBalanceRaw':state['balance'],'totalWinRaw':state['win'],'betRaw':176}}
