"""Independent action/money contract; gameplay classification is a sidecar."""
import re
import xml.etree.ElementTree as ET
from store import digest
from round_fields import check, amount, params
from native_nextgen_fields import NativeNextgenFields
from feature_state import check_feature_wallet, review_feature_values

SOURCE = 'huffnpuffmoneymansionhighlimit96-round-one-base-v1'
ACTION_VERSION = 'huff-action-v1'
CONTRACT = {'schema': 'sg-action-contract-v1', 'gameId': 32714, 'sourceKey': SOURCE,
    'protocol': 'nextgen', 'version': ACTION_VERSION, 'betRaw': 500,
    'clientHash': '67bcebfd2f16477c8c3b2686b6e10b70f41bde3579d929e89e04e321ffa4e93d',
    'supportedActions': ['BET', 'FREE_GAME'], 'featureIds': [0, 1, 2, 3, 4],
    'classification': 'independent-journal',
    'terminal': 'counters-and-client-exits-and-reconciled-wallet'}
CONTRACT_HASH = digest(CONTRACT)
REQUEST = {'AP': 'false', 'BPR': '25', 'GN': 'huffnpuffmoneymansionhighlimit96', 'RB': '5'}


def has_home_improvement(raw):
    return isinstance(raw, dict) and raw.get('sourceKey') == SOURCE and isinstance(raw.get('steps'), list) \
        and any('3' in params(s['responsePayload']).get('FID', '').rstrip('|').split('|') for s in raw['steps'])


def has_action_bridge(raw):
    if has_home_improvement(raw):
        return True
    if not isinstance(raw, dict) or raw.get('sourceKey') != SOURCE or not isinstance(raw.get('steps'), list):
        return False
    for step in raw['steps']:
        p = params(step['responsePayload'])
        if '2' in p.get('FID', '').rstrip('|').split('|') \
                and {'CFNFG', 'CFTFG', 'CFCFGG', 'CFFGT', 'FMS'}.intersection(pairs(p.get('GSD', ''))):
            return True
    return False


def legacy_action_raw(raw):
    need('requestFlowVersion' not in raw and 'actionContractHash' not in raw, 'LEGACY_CONTRACT')
    return {**raw, 'requestFlowVersion': ACTION_VERSION, 'actionContractHash': CONTRACT_HASH}


def legacy_action_adapter(plan):
    return HuffActionFields({**plan, 'featureProfile': ACTION_VERSION, 'actionContractHash': CONTRACT_HASH})


def need(value, code):
    check(value, 'HUFF_ACTION_' + code)


def pairs(value, separator='#', delimiter='~'):
    need(isinstance(value, str), 'PAYLOAD')
    result = {}
    for part in filter(None, value.split(separator)):
        key, found, data = part.partition(delimiter)
        need(found and key and key not in result, 'AMBIGUOUS_PAYLOAD')
        result[key] = data
    return result


def slots(value, maximum=100):
    if value in (None, ''):
        return []
    need(isinstance(value, str) and re.fullmatch(r'[0-9]+(?:\|[0-9]+)*\|?', value), 'FEATURE_ID')
    values = [amount(v) for v in value.rstrip('|').split('|')]
    need(len(values) <= maximum and all(v <= 4 for v in values), 'UNREVIEWED_ROUTE')
    return values


class HuffActionFields(NativeNextgenFields):
    def scope(self, raw):
        p = self.plan
        need(p.get('gameId') == 32714 and p.get('runtimeGameId') == 33114 and p.get('sourceKey') == SOURCE
             and p.get('betRaw') == 500 and p.get('buy') == 0 and p.get('maxSteps') == 100
             and p.get('featureProfile') == ACTION_VERSION and p.get('actionContractHash') == CONTRACT_HASH
             and p.get('requestParams') == REQUEST, 'PROFILE')
        need(isinstance(raw, dict) and raw.get('fixtureOnly') is False and raw.get('protocol') == 'nextgen'
             and raw.get('sourceKey') == SOURCE and raw.get('roundFieldsVersion') == 'sg-round-fields-v1'
             and raw.get('requestFlowVersion') == ACTION_VERSION and raw.get('actionContractHash') == CONTRACT_HASH,
             'RAW_CONTRACT')

    def review(self, raw):
        self.scope(raw)
        steps = raw.get('steps')
        need(isinstance(steps, list) and len(steps) <= 100, 'STEPS')
        start = amount(raw.get('startBalanceRaw'))
        need(start >= 500, 'START')
        following, player, previous, prior_win = 'BET', None, None, 0
        prior_features = []
        for index, step in enumerate(steps):
            need(following is not None and step.get('msgId') == following, 'SEQUENCE')
            q, p = params(step.get('requestPayload')), params(step.get('responsePayload'))
            g = pairs(p.get('GSD', ''))
            need({k: v for k, v in q.items() if k != 'PID'} == {**REQUEST, 'MSGID': following}, 'REQUEST')
            pid = q.get('PID', '')
            need(re.fullmatch(r'gdmgcm.{1,505}',pid) and (player is None or player == pid), 'SESSION')
            player = pid
            need(step.get('methodName') == 'processGameMessage' and p.get('MSGID') == following
                 and p.get('IFG') == str(int(index > 0)), 'MESSAGE')
            xml = step.get('responseXml')
            need(isinstance(xml, str) and len(xml) < 262144 and not re.search('<!DOCTYPE|<!ENTITY', xml, re.I), 'XML')
            try:
                root = ET.fromstring(xml)
            except ET.ParseError:
                need(False, 'XML')
            need(root.tag == 'GDMRESPONSE' and not root.attrib
                 and all(n.tag in ('SUCCESS', 'PAYLOAD', 'OGS_RC') and not n.attrib and not len(n) for n in root)
                 and len(root.findall('SUCCESS')) == len(root.findall('PAYLOAD')) == 1
                 and (root.findtext('SUCCESS') or '').lower() == 'true'
                 and root.findtext('PAYLOAD') == step['responsePayload']
                 and len(root.findall('OGS_RC')) <= 1 and root.findtext('OGS_RC', '0') == '0', 'XML')
            need(amount(step.get('elapsedMs')) <= 300000, 'TIMING')
            need(p.get('GCT', '0') == p.get('FRBAL', '0') == '0'
                 and not any(k.startswith(('FS_', 'NFR_', 'CFR_', 'CFP_', 'FR_')) for k in p)
                 and not {'CFG', 'ABPM', 'SB', 'FRTR', 'FRTW', 'BUY_IN'}.intersection(p), 'UNREVIEWED_ROUTE')
            feature = slots(p.get('FID'), 2)
            need(len(set(feature)) == len(feature), 'FEATURE_ID')
            slots(g.get('PCFID'))
            need(g.get('FEAT') in (None, 'MMANSION', 'HARDHAT', 'PAINT', 'HOMEIMP', 'MANSION'), 'UNREVIEWED_ROUTE')
            need(g.get('MMBG') in (None, '0', '1') and g.get('MMFG') in (None, '0', '1'), 'MANSION_FLAG')
            ordinary = index == 0 and not feature and not {'NFG', 'TFG', 'CFGG'}.intersection(p)
            n, t, c = (0, 0, 0) if ordinary else tuple(amount(p.get(k)) for k in ('NFG', 'TFG', 'CFGG'))
            need(n + c == t <= 100, 'COUNTERS')
            if feature == [2]:
                for display, value in (('CFNFG', n), ('CFTFG', t), ('CFCFGG', c)):
                    if display in g:
                        need(amount(g[display]) == value, 'DISPLAY_COUNTERS')
                for display in ('CFFGT', 'FMS'):
                    if display in g:
                        amount(g[display])
            if previous:
                pf, pn, pt, pc, intro = previous
                if feature == pf:
                    need(pn > 0 and c == pc + 1 and t >= pt and n == pn - 1 + t - pt, 'PROGRESS')
                else:
                    selected = pf == [0] and intro and len(feature) == 1 and feature[0] > 0 \
                        and g.get('FEAT') == 'MMANSION' and g.get('MMW') and (n, t, c) == (6, 6, 0)
                    old = pf[0] if len(pf) == 1 else None
                    history = slots(g.get('PCFID'))
                    awarded = old is not None and old > 0 and feature == [0] and pn == 1 \
                        and (n, t, c) == (1, 1, 0) and g.get('MMFG') == '1' and not g.get('MMW') \
                        and g.get('FEAT') == ('MMANSION', 'HARDHAT', 'PAINT', 'HOMEIMP', 'MANSION')[old] \
                        and amount(g.get('CFNFG')) == 0 and amount(g.get('CFTFG')) == pt \
                        and amount(g.get('CFCFGG')) == pc + 1 and history == prior_features \
                        and 'FRAMEWINS' in g and review_feature_values(g['FRAMEWINS'], size=20 if old == 3 else 15,
                            display_sentinels=(-1, -2, -3, -4, -5), continuation_sentinels=(-100,))['requiresFeatureContinuation']
                    need(selected or awarded, 'UNREVIEWED_TRANSITION')
            else:
                need(c == 0, 'TRIGGER')
            intro = feature[:1] == [0] and (g.get('MMBG') == '1' or g.get('MMFG') == '1'
                and (n, t, c) == (1, 1, 0)) and not g.get('MMW')
            following = 'FREE_GAME' if n > 0 or intro else None
            b, ab, win = (amount(p.get(k)) for k in ('B', 'AB', 'TW'))
            need(win >= prior_win, 'WIN_REGRESSION')
            prior_win = win
            check_feature_wallet(start, 500, b, ab, win, settled=following is None,
                                 response_balance=amount(step['responseBalance']) if 'responseBalance' in step else None)
            if following is None:
                need(len(feature)<=1,'UNREVIEWED_EXIT')
                if 'FRAMEWINS' in g:
                    result = review_feature_values(g['FRAMEWINS'], size=20 if feature[:1] == [3] else 15,
                        display_sentinels=(-1, -2, -3, -4, -5), continuation_sentinels=(-100,))
                    need(not result['requiresFeatureContinuation'], 'UNREVIEWED_EXIT')
                if g.get('VA'):
                    board = [amount(v) for v in g['VA'].split(',')]
                    need(not (board.count(13) >= 3 and board.count(14) >= 6), 'UNREVIEWED_EXIT')
            previous = feature, n, t, c, intro
            prior_features = feature + prior_features
        return {'MSGID': following} if following else None

    def next_request(self, raw):
        return self.review(raw)

    def settled(self, raw):
        if 'requestFlowVersion' not in raw:
            from huff_fields import HuffFields
            return HuffFields(self.plan).settled(raw)
        need(self.review(raw) is None, 'INCOMPLETE')
        final = params(raw['steps'][-1]['responsePayload'])
        start, end, win = amount(raw['startBalanceRaw']), amount(final['B']), amount(final['TW'])
        need(amount(final['AB']) == end and start - end + win == 500, 'SETTLEMENT')
        return {'roundFieldsVersion': 'sg-round-evidence-v2', 'protocol': 'nextgen', 'sourceKey': SOURCE,
            'bet': 5, 'mul': win / 500, 'buy': 0, 'bonus': None, 'primaryBonusKind': None,
            'classificationStatus': 'pending', 'typeMappingHash': CONTRACT_HASH, 'requestFlowVersion': ACTION_VERSION,
            'money': {'startBalanceRaw': start, 'endBalanceRaw': end, 'totalWinRaw': win, 'betRaw': 500}}
