"""Independent WMS per-Logic accounting for the evidenced 88 Fortunes Megaways mode.

Recovery reels describe the paid result and are never a second award. Only the
observed automatic 10/12-spin branches are accepted; no source or storage calls.
"""
from pearl_fields import parse, one
from round_fields import amount, check, VERSION, type_profile

SOURCE = 'eightyeightfortunesmegaways-ag-rolling-wms-v1'
HEADER = dict(affiliate='0', ccyCode='', channel='I', freePlay='Y', gameCodeRGI='eightyeightfortunesmegaways',
              gameID='20371', glsID='65535', lang='en_US', promotions='N', userID='null', userType='C', versionID='1_0')
TYPE_PROFILE = dict(fixtureOnly=False, protocol='wms', adapter='fortunes-megaways-wms-v1', mode='demo', buy=0,
                    betRaw=16, baseBonus=0, freeTypes={'automatic-ten-or-twelve-free': 1},
                    evidence=dict(captureGameId=32751, runtimeGameId=32973, wmsGameId=20371,
                                  historyFileSha256='aae26c15702909d4402d0e40e0aee6cbb6b1f9f8ca935218d613273d015ca50c',
                                  fullBaseRounds=996, fullFreeRounds=4))
SCHEMA = {
    'GameResponse': ('type', 'Header AccountData Balances GameResult'),
    'Header': ('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering readyForEndGame', ''),
    'AccountData': ('', 'AccountData CurrencyMultiplier'), 'CurrencyMultiplier': ('', ''),
    'Balances': ('', 'Balance'), 'Balance': ('name value', ''),
    'GameResult': ('stake totalWin betID', 'ReelResults BGInfo FSInfo BaseGameRecoveryInfo PickerInfo CascadeInfo TopReelInfo'),
    'ReelResults': ('numSpins', 'ReelSpin'),
    'ReelSpin': ('anywayWins bonusAwarded freeSpin reelsetIndex scatterWinCount spinIndex totalSpinWin', 'AnywayWin ReelStops ScatterWin'),
    'AnywayWin': ('awardIndex ways winIndex winVal', ''), 'ReelStops': ('', ''), 'ScatterWin': ('awardIndex winVal', ''),
    'BGInfo': ('bgWinnings gameMode isMaxWin reelHeights totalWagerWin', ''),
    'FSInfo': ('extraSpinsAwarded freeSpinNumber freeSpinsTotal fsWinnings isMaxWin reelHeights startCasMult', ''),
    'BaseGameRecoveryInfo': ('', 'ReelResults TopReelInfo'), 'PickerInfo': ('pickerIndex', ''),
    'CascadeInfo': ('curCascadeMult prevCascadeMult', ''), 'TopReelInfo': ('positions reelSetIndex reelStop', ''),
}


def xml_value(node):
    return node.tag, sorted(node.attrib.items()), (node.text or '').strip(), [xml_value(n) for n in node]


def heights(value):
    parts = value.split('|') if isinstance(value, str) else []
    check(len(parts) == 6 and all(2 <= amount(v) <= 7 for v in parts), 'WMS_REEL_STATE_MISMATCH')


def request(text, msg, first=False):
    q = parse(text); h = one(q, 'Header')
    check(q.tag == 'GameRequest' and q.attrib == {'type': msg} and not len(h)
          and {k: v for k, v in h.attrib.items() if k != 'sessionID'} == HEADER, 'WMS_REQUEST_MODE')
    session = h.get('sessionID')
    check(isinstance(session, str) and 0 < len(session) <= 1024, 'WMS_SESSION_REQUIRED')
    if first:
        check(msg == 'Logic' and [n.tag for n in q] == ['Header', 'Stake', 'PaylineCount', 'AccountData']
              and one(q, 'Stake').attrib == {'total': '16', 'gameMode': '0'} and not len(one(q, 'Stake'))
              and one(q, 'PaylineCount').attrib == {'count': '1'} and not len(one(q, 'PaylineCount')), 'WMS_WAGER_MISMATCH')
        a = one(q, 'AccountData'); c = one(a, 'CurrencyMultiplier')
        check(not a.attrib and len(a) == 1 and not c.attrib and not len(c) and c.text == '1', 'WMS_REQUEST_MODE')
    else:
        check(msg in ('Init', 'Logic', 'EndGame') and [n.tag for n in q] == ['Header'], 'WMS_REQUEST_MISMATCH')
    return session


def response(text, msg):
    root = parse(text); h = one(root, 'Header'); b = one(root, 'Balances')
    check(root.tag == 'GameResponse' and root.attrib == {'type': msg} and h.get('gameID') == '20371'
          and h.get('versionID') == '1_0' and h.get('isRecovering') == 'N', 'WMS_RESPONSE_IDENTITY_MISMATCH')
    session = h.get('sessionID')
    check(isinstance(session, str) and 0 < len(session) <= 1024, 'WMS_SESSION_REQUIRED')
    check(len(b) == 1 and one(b, 'Balance').get('name') == 'CASH_BALANCE', 'WMS_BALANCE_MISMATCH')
    return root, session, amount(one(b, 'Balance').get('value'))


def mapping_hash():
    profile, signature = type_profile(SOURCE)
    check(profile == TYPE_PROFILE, 'WMS_MAPPING_REQUIRED')
    return signature


def bootstrap(step, session):
    check(step.get('msgId') == 'Init' and request(step.get('requestPayload'), 'Init') == session
          and xml_value(parse(step.get('responsePayload'))) == xml_value(parse(step.get('responseXml')))
          and amount(step.get('elapsedMs')) <= 300000 and not step.get('sourceRejected'), 'WMS_XML_EVIDENCE_MISMATCH')
    root, rotated, balance = response(step['responsePayload'], 'Init')
    init = {**SCHEMA, 'GameResponse': ('type', 'Header AccountData Balances GameInfo'),
            'GameInfo': ('', 'Stakes PageInfo'), 'Stakes': ('', ''), 'PageInfo': ('pageCount', '')}
    check(all(n.tag in init and set(n.attrib) <= set(init[n.tag][0].split())
              and all(c.tag in init[n.tag][1].split() for c in n) for n in root.iter()), 'WMS_INIT_REQUIRES_REVIEW')
    stakes, pages = list(root.iter('Stakes')), list(root.iter('PageInfo'))
    check(one(root, 'Header').get('readyForEndGame') == 'N'
          and not any(n.tag in ('GameResult', 'BaseGameRecoveryInfo', 'Feature') for n in root.iter())
          and len(stakes) == 1 and 16 in [amount(v) for v in (stakes[0].text or '').split('|') if v]
          and len(pages) <= 1 and (not pages or amount(pages[0].get('pageCount')) <= 1), 'WMS_INIT_REQUIRES_REVIEW')
    check(amount(step.get('responseBalance')) == balance, 'WMS_BALANCE_MISMATCH')
    return dict(validated=True, session=rotated, balanceRaw=balance)


class FortunesMegawaysFields:
    def __init__(self, plan):
        check(plan.get('gameId') == 32751 and plan.get('runtimeGameId') == 32973 and plan.get('sourceKey') == SOURCE
              and plan.get('adapter') == 'fortunes-megaways-wms-v1' and plan.get('buy') == 0
              and plan.get('betRaw') == 16 and plan.get('maxSteps') == 14, 'WMS_PROFILE_REQUIRED')
        mapping_hash()

    def next_request(self, raw):
        msg = review(raw)['next']
        return {'MSGID': msg} if msg is not None else None

    def validate_intent(self, raw, payload):
        state = review(raw)
        check(state['next'] is not None, 'WMS_SEQUENCE_MISMATCH')
        session = request(payload, state['next'], first=not raw['steps'])
        check(state['session'] is None or state['session'] == session, 'WMS_SESSION_CHAIN_MISMATCH')
        return {'validated': True}

    def bootstrap(self, step, session):
        return bootstrap(step, session)

    def settled(self, raw):
        return settled(raw, mapping_hash())


def review(raw):
    check(raw.get('sourceKey') == SOURCE and raw.get('protocol') == 'wms' and raw.get('fixtureOnly') is False
          and raw.get('roundFieldsVersion') == VERSION, 'WMS_PROFILE_REQUIRED')
    steps = raw.get('steps'); check(isinstance(steps, list) and len(steps) <= 14, 'INVALID_ROUND_STEPS')
    start = balance = amount(raw.get('startBalanceRaw')); win = base = total = number = multiplier = 0
    session = recovery = None; next_msg = 'Logic'; feature = False
    for index, s in enumerate(steps):
        check(next_msg is not None and s.get('msgId') == next_msg, 'WMS_SEQUENCE_MISMATCH')
        qs = request(s.get('requestPayload'), next_msg, first=index == 0)
        check(session is None or session == qs, 'WMS_SESSION_CHAIN_MISMATCH')
        root, session, cash = response(s.get('responsePayload'), next_msg)
        check(xml_value(root) == xml_value(parse(s.get('responseXml'))), 'WMS_XML_EVIDENCE_MISMATCH')
        for n in root.iter():
            spec = SCHEMA.get(n.tag)
            check(spec is not None and set(n.attrib) <= set(spec[0].split())
                  and all(c.tag in spec[1].split() for c in n), 'WMS_FEATURE_NOT_ADAPTED')
        check(amount(s.get('elapsedMs')) <= 300000 and not s.get('sourceRejected'), 'INVALID_TRIAL_TIMING')
        h = one(root, 'Header')
        if next_msg == 'EndGame':
            check(index == len(steps)-1 and [n.tag for n in root] == ['Header', 'AccountData', 'Balances']
                  and h.get('readyForEndGame') == 'N', 'WMS_ENDGAME_MISMATCH')
            next_msg = None
        else:
            g = one(root, 'GameResult'); bg = one(g, 'BGInfo'); award = amount(g.get('totalWin'))
            check(g.get('stake') == '16' and bg.get('gameMode') == '0' and bg.get('isMaxWin') == '0', 'WMS_WAGER_MISMATCH')
            heights(bg.get('reelHeights'))
            if index == 0:
                balance -= 16; base = award; feature = bool(g.findall('FSInfo'))
            win += award; balance += award; amount(win); amount(balance)
            check(amount(bg.get('totalWagerWin')) == win and amount(bg.get('bgWinnings')) == base, 'WMS_CUMULATIVE_WIN_MISMATCH')
            reels = one(g, 'ReelResults'); spins = list(reels)
            check(1 <= len(spins) <= 5 and amount(reels.get('numSpins')) == len(spins)
                  and all(n.tag == 'ReelSpin' and amount(n.get('spinIndex')) == j
                          and n.get('freeSpin') == ('Y' if index else 'N')
                          and n.get('bonusAwarded') == ('Y' if feature and index == 0 else 'N')
                          for j, n in enumerate(spins)), 'WMS_REEL_STATE_MISMATCH')
            check(sum(amount(n.get('totalSpinWin')) for n in spins) == award, 'WMS_REEL_WIN_MISMATCH')
            for n in spins:
                check(amount(n.get('anywayWins')) == len(n.findall('AnywayWin'))
                      and amount(n.get('scatterWinCount')) == len(n.findall('ScatterWin')), 'WMS_REEL_WIN_MISMATCH')
                check(sum(amount(c.get('winVal')) for c in n if c.tag in ('AnywayWin', 'ScatterWin'))
                      == amount(n.get('totalSpinWin')), 'WMS_REEL_WIN_MISMATCH')
            top = one(g, 'TopReelInfo')
            check(top.get('positions') == '37|38|39|40' and top.get('reelSetIndex') == ('40' if index else '35'), 'WMS_REEL_STATE_MISMATCH')
            amount(top.get('reelStop'))
            if index == 0:
                recovery = [xml_value(reels), xml_value(top)]
                if feature:
                    f = one(g, 'FSInfo'); p = one(g, 'PickerInfo')
                    check(set(f.attrib) == {'freeSpinNumber', 'freeSpinsTotal', 'fsWinnings', 'isMaxWin', 'startCasMult'}
                          and f.get('freeSpinNumber') == '0' and f.get('fsWinnings') == '0' and f.get('isMaxWin') == '0'
                          and ((p.get('pickerIndex') == '0' and f.get('freeSpinsTotal') == '10' and f.get('startCasMult') == '6')
                               or (p.get('pickerIndex') == '1' and f.get('freeSpinsTotal') == '12' and f.get('startCasMult') == '4')),
                          'WMS_FREE_COUNTER_MISMATCH')
                    total = amount(f.get('freeSpinsTotal')); multiplier = amount(f.get('startCasMult'))
                else:
                    check(not any(n.tag in ('FSInfo', 'PickerInfo', 'CascadeInfo', 'BaseGameRecoveryInfo') for n in g), 'WMS_FEATURE_NOT_ADAPTED')
            else:
                check(feature and not g.findall('PickerInfo'), 'WMS_SEQUENCE_MISMATCH')
                f = one(g, 'FSInfo'); c = one(g, 'CascadeInfo'); number += 1
                check(set(f.attrib) == {'extraSpinsAwarded', 'freeSpinNumber', 'freeSpinsTotal', 'fsWinnings', 'reelHeights'}
                      and amount(f.get('freeSpinsTotal')) == total and amount(f.get('freeSpinNumber')) == number
                      and number <= total and f.get('extraSpinsAwarded') == '0', 'WMS_FREE_COUNTER_MISMATCH')
                heights(f.get('reelHeights'))
                check(amount(f.get('fsWinnings')) == win-base, 'WMS_CUMULATIVE_WIN_MISMATCH')
                check(amount(c.get('prevCascadeMult')) == multiplier and amount(c.get('curCascadeMult')) == multiplier+len(spins)-1,
                      'WMS_CASCADE_COUNTER_MISMATCH')
                multiplier = amount(c.get('curCascadeMult'))
                check([xml_value(n) for n in one(g, 'BaseGameRecoveryInfo')] == recovery, 'WMS_RECOVERY_EVIDENCE_MISMATCH')
            pending = feature and number < total
            check(h.get('readyForEndGame') == ('N' if pending else 'Y'), 'WMS_SETTLEMENT_FLAG_MISMATCH')
            next_msg = 'Logic' if pending else 'EndGame'
        check(cash == balance and amount(s.get('responseBalance')) == balance, 'WMS_BALANCE_MISMATCH')
    return dict(next=next_msg, session=session, feature=feature, start=start, balance=balance, win=win)


def settled(raw, mapping_hash):
    s = review(raw); check(s['next'] is None and s['start']-s['balance']+s['win'] == 16, 'INCOMPLETE_ROUND')
    import re
    check(re.fullmatch('[a-f0-9]{64}', mapping_hash or '') is not None, 'WMS_MAPPING_REQUIRED')
    return dict(roundFieldsVersion=VERSION, protocol='wms', sourceKey=SOURCE, bet=0.16, mul=s['win']/16, buy=0,
                bonus=int(s['feature']), primaryBonusKind='freeGame' if s['feature'] else 'none', typeMappingHash=mapping_hash,
                money=dict(startBalanceRaw=s['start'], endBalanceRaw=s['balance'], totalWinRaw=s['win'], betRaw=16))
