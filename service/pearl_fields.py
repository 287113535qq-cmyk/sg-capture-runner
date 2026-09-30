"""Pearl WMS ordinary/eight-free-spin boundary; offline, no source transport.

Only the reviewed 200-unit ordinary stake and unretriggered eight-spin feature
are supported. EndGame acknowledgement is required even after the last Logic.
"""
import re
import xml.etree.ElementTree as ET
from round_fields import check, amount, VERSION, type_profile

SOURCE = 'pearlofthecaribbean-wms-v1'
SCHEMA = {
    'GameResponse': ('type', 'Header AccountData Balances GameResult'),
    'Header': ('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering readyForEndGame', ''),
    'AccountData': ('', 'AccountData CurrencyMultiplier'),
    'CurrencyMultiplier': ('', ''),
    'Balances': ('', 'Balance'), 'Balance': ('name value', ''),
    'GameResult': ('stake stakePerLine paylineCount totalWin betID', 'ReelResults BGInfo FSInfo WildReels BaseGameRecoveryInfo'),
    'ReelResults': ('numSpins', 'ReelSpin'),
    'ReelSpin': ('bonusAwarded freeSpin reelsetIndex spinIndex spinWins winCountPL winCountSC', 'ReelStops PaylineWin ScatterWin'),
    'ReelStops': ('', ''), 'PaylineWin': ('awardIndex awardTableIndex index winVal', ''),
    'ScatterWin': ('awardIndex winVal', ''),
    'BGInfo': ('baseGameSpinsRemaining bgWinnings isBigBet isMaxWin totalWagerWin', ''),
    'FSInfo': ('freeSpinNumber freeSpinsAwarded freeSpinsTotal fsWinnings isMaxWin', ''),
    'WildReels': ('reelSet0 reelSet1 reelSet2 reelSet3 reelSet4', ''),
    'BaseGameRecoveryInfo': ('', 'ReelResults WildReels'),
}
REQUEST_HEADER = set('affiliate ccyCode channel freePlay gameCodeRGI gameID glsID lang promotions sessionID userID userType versionID'.split())


def parse(text):
    check(isinstance(text, str) and 0 < len(text) < 262144 and not re.search(r'<!DOCTYPE|<!ENTITY', text, re.I), 'INVALID_WMS_XML')
    try:
        return ET.fromstring(text)
    except ET.ParseError:
        check(False, 'INVALID_WMS_XML')


def one(node, path):
    values = node.findall(path)
    check(len(values) == 1, 'AMBIGUOUS_WMS_STRUCTURE')
    return values[0]


def request(text, msg, *, legacy=False):
    root = parse(text)
    check(root.tag == 'GameRequest' and root.attrib == {'type': msg}, 'WMS_REQUEST_MISMATCH')
    h = one(root, 'Header')
    check(set(h.attrib) == REQUEST_HEADER and not len(h), 'WMS_REQUEST_MISMATCH')
    check(all(h.get(k) == v for k, v in {'freePlay':'Y', 'gameCodeRGI':'pearlofthecaribbean', 'gameID':'20327',
          'lang':'en_US', 'promotions':'N', 'userType':'C', 'versionID':'1_0', 'channel':'I'}.items()), 'WMS_REQUEST_MODE')
    check(0 < len(h.get('sessionID', '')) <= 1024, 'WMS_SESSION_REQUIRED')
    tags = [n.tag for n in root]
    if msg in ('Init', 'EndGame') or legacy and tags == ['Header']:
        check(tags == ['Header'], 'WMS_REQUEST_MISMATCH')
    else:
        check(msg == 'Logic' and sorted(tags) == ['AccountData', 'Header', 'Stake'], 'WMS_REQUEST_MISMATCH')
        stake = one(root, 'Stake')
        check(stake.attrib == {'total':'200', 'isBigBet':'0'} and not len(stake), 'WMS_REQUEST_MODE')
        account = one(root, 'AccountData')
        check(not account.attrib, 'WMS_REQUEST_MISMATCH')
        if not legacy or len(account):
            check(len(account) == 1 and one(account, 'CurrencyMultiplier').text == '1'
                  and not one(account, 'CurrencyMultiplier').attrib, 'WMS_REQUEST_MODE')
    return dict(h.attrib)


def review(raw, *, legacy=False):
    check(raw.get('sourceKey') == SOURCE and raw.get('protocol') == 'wms'
          and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion') == VERSION, 'PEARL_PROFILE_REQUIRED')
    steps = raw.get('steps')
    check(isinstance(steps, list) and len(steps) <= 10, 'INVALID_ROUND_STEPS')
    start = balance = amount(raw.get('startBalanceRaw'))
    total = 0
    session = identity = initial_win = feature = None
    next_msg = 'Logic'
    for index, step in enumerate(steps):
        check(next_msg is not None and step.get('msgId') == next_msg, 'WMS_SEQUENCE_MISMATCH')
        h = request(step.get('requestPayload'), next_msg, legacy=legacy)
        if legacy and index == 0:
            check(parse(step['requestPayload']).find('Stake') is not None, 'WMS_REQUEST_MODE')
        current_identity = {k:v for k,v in h.items() if k != 'sessionID'}
        check(identity is None or identity == current_identity, 'WMS_REQUEST_IDENTITY_CHANGED')
        identity = current_identity
        check(session is None or session == h['sessionID'], 'WMS_SESSION_CHAIN_MISMATCH')
        response = parse(step.get('responsePayload'))
        check(ET.tostring(response) == ET.tostring(parse(step.get('responseXml'))), 'WMS_XML_EVIDENCE_MISMATCH')
        check(response.tag == 'GameResponse' and response.attrib == {'type': next_msg}, 'MESSAGE_ID_MISMATCH')
        for node in response.iter():
            shape = SCHEMA.get(node.tag)
            check(shape is not None and set(node.attrib) <= set(shape[0].split())
                  and all(c.tag in shape[1].split() for c in node), 'PEARL_FEATURE_NOT_ADAPTED')
        rh = one(response, 'Header')
        check(rh.get('gameID') == '20327' and rh.get('versionID') == '1_0'
              and rh.get('isRecovering') == 'N', 'WMS_RESPONSE_IDENTITY_MISMATCH')
        session = rh.get('sessionID')
        check(isinstance(session, str) and 0 < len(session) <= 1024, 'WMS_SESSION_REQUIRED')
        check(amount(step.get('elapsedMs')) <= 300000, 'INVALID_TRIAL_TIMING')
        if next_msg == 'EndGame':
            check(index == len(steps)-1 and not response.findall('GameResult')
                  and rh.get('readyForEndGame') == 'N', 'WMS_ENDGAME_MISMATCH')
            next_msg = None
        else:
            result = one(response, 'GameResult')
            check(result.get('stake') == '200' and result.get('stakePerLine') == '4'
                  and result.get('paylineCount') == '50', 'WMS_WAGER_MISMATCH')
            win = amount(result.get('totalWin'))
            if index == 0:
                balance -= 200
                initial_win = win
            total += win
            balance += win
            amount(total); amount(balance)
            bg = one(result, 'BGInfo')
            check(all(bg.get(k) == '0' for k in ('isBigBet','isMaxWin','baseGameSpinsRemaining')), 'PEARL_FEATURE_NOT_ADAPTED')
            check(amount(bg.get('bgWinnings')) == initial_win and amount(bg.get('totalWagerWin')) == total, 'WMS_CUMULATIVE_WIN_MISMATCH')
            fs = result.findall('FSInfo')
            if feature is None:
                feature = bool(fs)
            if feature:
                f = one(result, 'FSInfo')
                check(f.get('isMaxWin') == '0' and f.get('freeSpinsTotal') == '8'
                      and f.get('freeSpinsAwarded') == ('0' if index else '8'), 'PEARL_FEATURE_NOT_ADAPTED')
                check(index <= 8 and amount(f.get('freeSpinNumber')) == index, 'WMS_FREE_COUNTER_MISMATCH')
                check(amount(f.get('fsWinnings')) == total-initial_win, 'WMS_CUMULATIVE_WIN_MISMATCH')
                pending = index < 8
            else:
                check(index == 0 and not fs, 'WMS_SEQUENCE_MISMATCH')
                pending = False
            check(rh.get('readyForEndGame') == ('N' if pending else 'Y'), 'WMS_SETTLEMENT_FLAG_MISMATCH')
            reels = one(result, 'ReelResults')
            spins = reels.findall('ReelSpin')
            check(reels.get('numSpins') == '5' and len(spins) == 5, 'PEARL_FEATURE_NOT_ADAPTED')
            check(all(n.get('freeSpin') == ('Y' if index else 'N') for n in spins), 'WMS_FREE_STATE_MISMATCH')
            check(all(n.get('bonusAwarded') in ('Y','N') for n in spins), 'PEARL_FEATURE_NOT_ADAPTED')
            check(not any(n.get('bonusAwarded') == 'Y' for n in spins) or feature and index == 0, 'PEARL_FEATURE_NOT_ADAPTED')
            check(sum(amount(n.get('spinWins')) for n in spins) == win, 'WMS_REEL_WIN_MISMATCH')
            next_msg = 'Logic' if pending else 'EndGame'
        balances = one(response, 'Balances')
        check(len(balances) == 1 and one(balances, 'Balance').attrib == {'name':'CASH_BALANCE','value':str(balance)}, 'WMS_BALANCE_MISMATCH')
        check(amount(step.get('responseBalance')) == balance, 'WMS_BALANCE_MISMATCH')
    return {'next':next_msg, 'session':session, 'feature':bool(feature),
            'start':start, 'balance':balance, 'win':total}


class PearlFields:
    def __init__(self, plan):
        check(plan.get('gameId') == 32795 and plan.get('runtimeGameId') == 33155
              and plan.get('sourceKey') == SOURCE and plan.get('betRaw') == 200, 'PEARL_PROFILE_REQUIRED')
        self.plan = plan

    def bootstrap(self, step):
        request(step.get('requestPayload'), 'Init')
        root = parse(step.get('responseXml'))
        check(ET.tostring(root) == ET.tostring(parse(step.get('responsePayload'))), 'WMS_XML_EVIDENCE_MISMATCH')
        check(root.tag == 'GameResponse' and root.attrib == {'type':'Init'}, 'MESSAGE_ID_MISMATCH')
        h = one(root, 'Header')
        check(h.get('gameID') == '20327' and h.get('versionID') == '1_0' and h.get('isRecovering') == 'N'
              and h.get('readyForEndGame') == 'N' and not root.findall('GameResult'), 'PEARL_INIT_REQUIRES_REVIEW')
        check(0 < len(h.get('sessionID', '')) <= 1024, 'WMS_SESSION_REQUIRED')
        stakes = list(root.iter('Stakes'))
        check(stakes and 200 in [amount(x) for x in (stakes[0].text or '').split('|') if x], 'PEARL_INIT_REQUIRES_REVIEW')
        pages = list(root.iter('PageInfo'))
        check(len(pages) <= 1 and (not pages or amount(pages[0].get('pageCount')) <= 1), 'PEARL_INIT_REQUIRES_REVIEW')
        b = one(root, 'Balances')
        check(len(b) == 1 and one(b, 'Balance').get('name') == 'CASH_BALANCE', 'WMS_BALANCE_MISMATCH')
        check(amount(one(b, 'Balance').get('value')) == amount(step.get('responseBalance')), 'WMS_BALANCE_MISMATCH')
        return {'validated':True}

    def next_request(self, raw):
        msg = review(raw)['next']
        return {'MSGID':msg} if msg else None

    def validate_intent(self, raw, payload):
        state = review(raw)
        check(state['next'] is not None, 'WMS_ROUND_ALREADY_SETTLED')
        h = request(payload, state['next'])
        check(state['session'] is None or h['sessionID'] == state['session'], 'WMS_SESSION_CHAIN_MISMATCH')
        if raw['steps']:
            before = request(raw['steps'][0]['requestPayload'], 'Logic')
            check({k:v for k,v in before.items() if k != 'sessionID'} == {k:v for k,v in h.items() if k != 'sessionID'}, 'WMS_REQUEST_IDENTITY_CHANGED')
        return {'validated':True}

    def settled(self, raw):
        s = review(raw)
        check(s['next'] is None and s['start']-s['balance']+s['win'] == 200, 'INCOMPLETE_ROUND')
        profile, mapping_hash = type_profile(SOURCE)
        check(profile == {'fixtureOnly':False,'protocol':'wms','adapter':'pearl-wms-v1','gameId':32795,
                          'betRaw':200,'buy':0,'ordinaryBonus':0,'freeBonus':1,'feature':'eight-free-no-retrigger-v1'}, 'PEARL_MAPPING_REQUIRED')
        return {'roundFieldsVersion':VERSION,'protocol':'wms','sourceKey':SOURCE,'bet':2.0,
                'mul':s['win']/200,'buy':0,'bonus':int(s['feature']), 'primaryBonusKind':'freeGame' if s['feature'] else 'none',
                'money':{'startBalanceRaw':s['start'],'endBalanceRaw':s['balance'],'totalWinRaw':s['win'],'betRaw':200},
                'typeMappingHash':mapping_hash}
