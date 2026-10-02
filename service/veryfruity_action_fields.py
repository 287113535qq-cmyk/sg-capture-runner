"""Staged action/money adapter. Pool-plan admission is independently required.

No gameplay classifier runs on the capture path. No applied profile currently
selects this adapter; adding a parser never grants a source allowance.
"""
from store import digest
from round_fields import check, amount
from pearl_fields import parse, one, REQUEST_HEADER
from veryfruity_review import CLIENT_SHA256, uint
from veryfruity_settlement_review import review_settlement

SOURCE = 'veryfruity-wms-action-v1'
ACTION_VERSION = 'veryfruity-action-v1'
CONTRACT = {'schema': 'sg-action-contract-v1', 'gameId': 32812,
            'sourceKey': SOURCE, 'protocol': 'wms', 'betRaw': 20,
            'version': ACTION_VERSION, 'clientHash': CLIENT_SHA256,
            'supportedActions': ['Logic', 'EndGame'],
            'classification': 'independent-journal', 'glsGameID': '20206',
            'glsVersionID': '1_0', 'stakePerLine': '1', 'paylineCount': '20'}
CONTRACT_HASH = digest(CONTRACT)


class VeryFruityActionFields:
    def __init__(self, plan):
        check(plan.get('gameId') == 32812 and plan.get('runtimeGameId') == 33172
              and plan.get('sourceKey') == SOURCE and plan.get('adapter') == 'veryfruity-wms-action-v1'
              and plan.get('featureProfile') == ACTION_VERSION and plan.get('betRaw') == 20
              and plan.get('buy') == 0 and plan.get('mode') == 'demo'
              and plan.get('actionContractHash') == CONTRACT_HASH, 'VERYFRUITY_ACTION_PROFILE')
        h = plan.get('requestHeader')
        check(isinstance(h, dict) and set(h) == REQUEST_HEADER - {'sessionID'}
              and all(isinstance(v, str) and len(v) <= 1024 for v in h.values())
              and all(h.get(k) == v for k, v in {'gameCodeRGI': 'veryfruity', 'gameID': '20206',
                      'versionID': '1_0', 'freePlay': 'Y', 'promotions': 'N'}.items()),
              'VERYFRUITY_ACTION_PROFILE')
        self.plan, self.header = plan, h

    def scope(self, raw):
        check(raw.get('sourceKey') == SOURCE and raw.get('protocol') == 'wms'
              and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion') == 'sg-round-fields-v1'
              and raw.get('requestFlowVersion') == ACTION_VERSION
              and raw.get('actionContractHash') == CONTRACT_HASH, 'VERYFRUITY_ACTION_RAW')

    def review(self, raw):
        self.scope(raw)
        result = review_settlement(raw, expected_header=self.header, stake_per_line='1', payline_count='20')
        for step in raw['steps']:
            if 'responseBalance' in step:
                balance = one(one(parse(step['responseXml']), 'Balances'), 'Balance').get('value')
                check(amount(step['responseBalance']) == amount(balance), 'VERYFRUITY_RESPONSE_BALANCE')
        return result

    def next_request(self, raw):
        self.scope(raw)
        if raw.get('steps') == []:
            check(amount(raw.get('startBalanceRaw')) >= 20, 'VERYFRUITY_ACTION_START')
            return {'MSGID': 'Logic'}
        result = self.review(raw)
        return {'MSGID': result['nextRequestHypothesis']} if result['nextRequestHypothesis'] else None

    def validate_intent(self, raw, payload):
        following = self.next_request(raw)
        check(following is not None, 'VERYFRUITY_ACTION_AFTER_TERMINAL')
        q = parse(payload)
        check(q.tag == 'GameRequest' and q.attrib == {'type': following['MSGID']}, 'VERYFRUITY_ACTION_INTENT')
        h = one(q, 'Header')
        check(not len(h) and set(h.attrib) == REQUEST_HEADER
              and all(h.get(k) == v for k, v in self.header.items()), 'VERYFRUITY_ACTION_INTENT')
        if raw['steps']:
            check(h.get('sessionID') == one(parse(raw['steps'][-1]['responseXml']), 'Header').get('sessionID'),
                  'VERYFRUITY_ACTION_SESSION')
        else:
            check(isinstance(h.get('sessionID'), str) and 0 < len(h.get('sessionID')) <= 1024,
                  'VERYFRUITY_ACTION_SESSION')
        # Validate the wager before transport; never infer it from the reply.
        logic = following['MSGID'] == 'Logic'
        check(sorted(n.tag for n in q) == sorted(['Header', 'AccountData'] +
              (['Stake', 'PaylineCount'] if logic else [])), 'VERYFRUITY_ACTION_INTENT')
        a = one(q, 'AccountData'); c = one(a, 'CurrencyMultiplier')
        check(not a.attrib and len(a) == 1 and not c.attrib and not len(c) and c.text == '1',
              'VERYFRUITY_ACTION_INTENT')
        if logic:
            s, p = one(q, 'Stake'), one(q, 'PaylineCount')
            check(s.attrib == {'perLine': '1', 'total': '20'} and not len(s)
                  and p.attrib == {'count': '20'} and not len(p), 'VERYFRUITY_ACTION_INTENT')
        return {'validated': True}

    def bootstrap(self, step):
        check(step.get('msgId') == 'Init' and step.get('responseXml') == step.get('responsePayload'),
              'VERYFRUITY_INIT_XML')
        q, r = parse(step.get('requestPayload')), parse(step.get('responseXml'))
        check(q.tag == 'GameRequest' and q.attrib == {'type':'Init'} and len(q) == 1,
              'VERYFRUITY_INIT_REQUEST')
        h = one(q, 'Header')
        check(set(h.attrib) == REQUEST_HEADER and not len(h)
              and all(h.get(k) == v for k,v in self.header.items())
              and 0 < len(h.get('sessionID','')) <= 1024, 'VERYFRUITY_INIT_IDENTITY')
        check(r.tag == 'GameResponse' and r.attrib == {'type':'Init'}
              and not any(n.tag in {'GameResult','Error','Errors','Recovery','Pick','Gamble'} for n in r.iter()),
              'VERYFRUITY_INIT_REVIEW')
        rh = one(r, 'Header')
        check(all(rh.get(k) == self.header[k] for k in ('gameID','versionID','ccyCode','lang'))
              and rh.get('isRecovering') == 'N' and 0 < len(rh.get('sessionID','')) <= 1024,
              'VERYFRUITY_INIT_IDENTITY')
        nodes = list(r.iter()); stakes=[n for n in nodes if n.tag=='Stakes']
        check(len(stakes)==1 and not len(stakes[0]) and isinstance(stakes[0].text,str), 'VERYFRUITY_INIT_STAKES')
        values=stakes[0].text.split('|')
        if values[-1]=='': values.pop()
        check(0<len(values)<=100 and 1 in [uint(v) for v in values], 'VERYFRUITY_INIT_STAKES')
        currencies=[n for n in nodes if n.tag=='CurrencyMultiplier']
        check(len(currencies)==1 and not len(currencies[0]) and currencies[0].text=='1', 'VERYFRUITY_INIT_CURRENCY')
        paylines=[n for n in nodes if n.tag=='PaylineInfo']
        check(len(paylines)==1 and len(paylines[0].findall('Payline'))==20, 'VERYFRUITY_INIT_LINES')
        pages=[n for n in nodes if n.tag=='PageInfo']
        check(len(pages)<=1 and (not pages or uint(pages[0].get('pageCount'))<=1), 'VERYFRUITY_INIT_PAGES')
        balances=one(r,'Balances');cash=one(balances,'Balance')
        check(len(balances)==1 and cash.get('name')=='CASH_BALANCE' and not len(cash), 'VERYFRUITY_INIT_BALANCE')
        balance=uint(cash.get('value'))
        check(amount(step.get('responseBalance'))==balance, 'VERYFRUITY_INIT_BALANCE')
        return {'validated': True}

    def settled(self, raw):
        r = self.review(raw)
        check(r['endGameAcknowledged'] and r['nextRequestHypothesis'] is None,
              'VERYFRUITY_ACTION_INCOMPLETE')
        return {'roundFieldsVersion': 'sg-round-evidence-v2', 'protocol': 'wms', 'sourceKey': SOURCE,
                'bet': 0.2, 'mul': r['winRaw'] / 20, 'buy': 0, 'bonus': None,
                'primaryBonusKind': None, 'classificationStatus': 'pending',
                'typeMappingHash': CONTRACT_HASH, 'requestFlowVersion': ACTION_VERSION,
                'money': {'startBalanceRaw': r['startBalanceRaw'], 'endBalanceRaw': r['endBalanceRaw'],
                          'totalWinRaw': r['winRaw'], 'betRaw': 20}}
