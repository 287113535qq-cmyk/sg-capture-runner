"""Offline settlement analysis, shared by Runner and server. No networking.

Only explicit NextGen settlement and WMS per-Logic payout evidence is accepted.
Unknown/missing protocol evidence fails closed; fixture flags do not bypass it.
"""
import json
import hashlib
import math
import re
import sys
from functools import lru_cache
import xml.etree.ElementTree as ET
from pathlib import Path

VERSION = 'sg-round-fields-v1'
MAX_SAFE = 9007199254740991

class FieldError(Exception):
    pass

def check(condition, code):
    if not condition:
        raise FieldError(code)

def amount(value):
    if isinstance(value, str):
        check(bool(re.fullmatch(r'[0-9]+', value)), 'INVALID_MONEY_EVIDENCE')
        value = int(value)
    check(type(value) is int and 0 <= value <= MAX_SAFE, 'INVALID_MONEY_EVIDENCE')
    return value

def params(payload):
    check(isinstance(payload, str), 'INVALID_NEXTGEN_PAYLOAD')
    result = {}
    for part in payload.split('&'):
        if not part:
            continue
        key, separator, value = part.partition('=')
        check(separator and key not in result, 'AMBIGUOUS_NEXTGEN_PARAMETER')
        result[key] = value
    return result

def nextgen(raw):
    steps = raw['steps']
    check(steps[0].get('msgId') == 'BET', 'MISSING_PAID_ROUND_START')
    flags = []
    for step in steps:
        parsed = params(step.get('responsePayload'))
        check(parsed.get('MSGID') == step.get('msgId'), 'MESSAGE_ID_MISMATCH')
        check(step['msgId'] in {'BET', 'FREE_GAME', 'FEATURE_START', 'FEATURE_PICK', 'FEATURE_END'}, 'UNSUPPORTED_NEXTGEN_MESSAGE')
        for key, value in parsed.items():
            if key in {'NFG', 'IFG'} or re.fullmatch(r'NFR_\d+', key):
                check(re.fullmatch(r'-?[0-9]+', value) is not None, 'INVALID_NEXTGEN_STATE')
        flags.append(parsed)
    check(sum(step['msgId'] == 'BET' for step in steps) == 1, 'MULTIPLE_PAID_ROUNDS')
    final = flags[-1]
    check(steps[-1]['msgId'] != 'FEATURE_START', 'INCOMPLETE_ROUND')
    # This contract accepts explicit settled zero counters; unfamiliar negative
    # sentinels/feature-only terminal conventions need a reviewed adapter.
    for key, value in final.items():
        if key == 'NFG' or re.fullmatch(r'NFR_\d+', key):
            check(amount(value) == 0, 'INCOMPLETE_ROUND')
    if '#lives~' in final.get('GSD', ''):
        lives = re.search(r'(?:^|#)lives~([^#]*)', final['GSD'])
        check(lives is not None and amount(lives[1]) == 0, 'INCOMPLETE_ROUND')
    check('B' in final or 'AB' in final, 'MISSING_FINAL_BALANCE')
    balances = [amount(final[key]) for key in ('B', 'AB') if key in final]
    if 'responseBalance' in steps[-1]:
        balances.append(amount(steps[-1]['responseBalance']))
    check(len(set(balances)) == 1, 'UNRECONCILED_FINAL_BALANCE')
    free = any(step['msgId'] == 'FREE_GAME' for step in steps)
    feature = any(step['msgId'].startswith('FEATURE_') for step in steps)
    # A trigger without a replay is never silently labeled an ordinary round.
    if any(int(p.get('NFG', '0')) > 0 for p in flags):
        check(free, 'MISSING_FREE_GAME_REPLAY')
    if any(int(p.get('IFG', '0')) > 0 for p in flags):
        check(free, 'MISSING_FREE_GAME_REPLAY')
    if any(any(part.isdigit() and int(part) > 0 for part in p.get('FID', '').split('|')) for p in flags):
        check(free or feature, 'UNCLASSIFIED_FEATURE_TRIGGER')
    for key in ('IFG', 'NFG'):
        if key in final:
            check(re.fullmatch(r'-?[0-9]+', final[key]) is not None, 'INVALID_NEXTGEN_STATE')
    kind = 'freeFeature' if free and feature else 'freeGame' if free else 'feature' if feature else 'none'
    return balances[0], amount(final.get('TW')), kind, None

def xml_step(step):
    payload = step.get('responsePayload')
    check(isinstance(payload, str) and '<!DOCTYPE' not in payload.upper() and '<!ENTITY' not in payload.upper(), 'INVALID_WMS_XML')
    try:
        root = ET.fromstring(payload)
    except ET.ParseError:
        raise FieldError('INVALID_WMS_XML') from None
    check(root.tag == 'GameResponse' and root.get('type') == step.get('msgId'), 'MESSAGE_ID_MISMATCH')
    return root

def one(root, tag):
    nodes = root.findall(tag)
    check(len(nodes) == 1, 'AMBIGUOUS_WMS_STRUCTURE')
    return nodes[0]

def wms(raw):
    steps = raw['steps']
    check(len(steps) >= 2 and steps[0].get('msgId') == 'Logic' and steps[-1].get('msgId') == 'EndGame', 'MISSING_WMS_ENDGAME')
    check(all(s.get('msgId') == 'Logic' for s in steps[:-1]), 'UNSUPPORTED_WMS_MESSAGE')
    check(raw.get('winAggregation') == 'per-logic', 'UNKNOWN_WMS_WIN_AGGREGATION')
    roots = [xml_step(step) for step in steps]
    stake, win, free, feature, pending = None, 0, False, False, False
    awarded = False
    for index, root in enumerate(roots[:-1]):
        header, result = one(root, 'Header'), one(root, 'GameResult')
        check(header.get('readyForEndGame') in {'Y', 'N'}, 'MISSING_WMS_SETTLEMENT_FLAG')
        if index:
            check(pending, 'MULTIPLE_PAID_ROUNDS')
        prices = [amount(result.get(key)) for key in ('stake', 'totalStake', 'wager') if result.get(key) is not None]
        if index == 0:
            check(prices and len(set(prices)) == 1 and prices[0] > 0, 'INVALID_WAGER_BASIS')
            stake = prices[0]
        else:
            check(all(price == 0 for price in prices), 'UNEXPECTED_CONTINUATION_STAKE')
        win += amount(result.get('totalWin'))
        check(win <= MAX_SAFE, 'INVALID_MONEY_EVIDENCE')
        current_pending = header.get('readyForEndGame') == 'N'
        for node in result.iter():
            awarded |= node.get('bonusAwarded') == 'Y'
            if node.tag == 'Feature':
                name = node.get('name', '')
                check(bool(name), 'UNKNOWN_WMS_FEATURE')
                if name.lower().startswith('free'):
                    free = True
                else:
                    feature = True
            if node.tag == 'FSInfo':
                free = True
            if node.tag == 'HNSInfo':
                feature = True
                remaining = amount(node.get('hnsSpinsRemaining'))
                current_pending |= remaining > 0 and node.get('isMaxWin') not in {'1', 'true', 'Y'}
            for key in ('lastFreeSpin', 'lastLilSpin', 'isBonusChoice'):
                value = node.get(key)
                if value is not None:
                    check(value in {'Y', 'N'}, 'INVALID_WMS_FEATURE_STATE')
                    current_pending |= value == ('Y' if key == 'isBonusChoice' else 'N')
            if node.get('remainingFreeSpins') is not None:
                current_pending |= amount(node.get('remainingFreeSpins')) > 0
            if node.get('totalSpin') is not None and node.get('freeSpinNumber') is not None:
                current_pending |= amount(node.get('totalSpin')) > amount(node.get('freeSpinNumber'))
        pending = current_pending
    check(not pending, 'INCOMPLETE_ROUND')
    check(not awarded or (len(steps) > 2 and (free or feature)), 'MISSING_WMS_FEATURE_REPLAY')
    end = roots[-1]
    # Only the confirmed EndGame balance settles a WMS big round.
    balance = one(end, 'Balance')
    final = amount(balance.get('value'))
    if 'responseBalance' in steps[-1]:
        check(final == amount(steps[-1]['responseBalance']), 'UNRECONCILED_FINAL_BALANCE')
    kind = 'freeFeature' if free and feature else 'freeGame' if free else 'feature' if feature else 'none'
    return final, win, kind, stake

@lru_cache(maxsize=256)
def type_profile(source_key):
    # Deployed releases are immutable. A new release starts new processes, so
    # the same reviewed mapping need not be parsed and hashed for every round.
    registry = json.loads((Path(__file__).resolve().parent / 'round_types.json').read_text(encoding='utf-8'))
    profile = registry['profiles'].get(source_key)
    signature = hashlib.sha256(json.dumps(profile, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    return profile, signature


def types(raw, kind):
    source_key = raw.get('sourceKey')
    # An additive feature profile leaves every previously accepted native-only
    # record and mapping hash unchanged, including partially saved old rounds.
    from squid_fields import SOURCE as SQUID_SOURCE, EXTENSION
    has_jackpot = source_key == SQUID_SOURCE and any(s['msgId'].startswith('FEATURE_') for s in raw['steps'])
    from huff_fields import SOURCE as HUFF_SOURCE, EXTENSION as HUFF_EXTENSION, feature_type
    huff_type = feature_type(raw) if source_key == HUFF_SOURCE else None
    profile, mapping_hash = type_profile(HUFF_EXTENSION if huff_type else EXTENSION if has_jackpot else source_key)
    check(profile is not None and profile['protocol'] == raw['protocol'], 'TYPE_MAPPING_REQUIRED')
    check(not profile.get('fixtureOnly') or raw.get('fixtureOnly') is True, 'FIXTURE_TYPE_PROFILE_ONLY')
    protocol = raw['protocol']
    if protocol == 'nextgen':
        first = params(raw['steps'][0].get('requestPayload'))
        selectors = {key: first.get(key) for key in profile['modeSelectorKeys']}
        free_selectors = [params(step['responsePayload']).get('CFG') for step in raw['steps'] if step['msgId'] == 'FREE_GAME']
    else:
        request_text = raw['steps'][0].get('requestPayload', '')
        check(isinstance(request_text, str) and '<!DOCTYPE' not in request_text.upper() and '<!ENTITY' not in request_text.upper(), 'INVALID_WMS_REQUEST')
        try:
            request = ET.fromstring(request_text)
        except ET.ParseError:
            raise FieldError('INVALID_WMS_REQUEST') from None
        check(request.tag == 'GameRequest', 'INVALID_WMS_REQUEST')
        selectors = {key: request.get(key) for key in profile['modeSelectorKeys']}
        free_selectors = [node.get('name') for step in raw['steps'][:-1] for node in xml_step(step).iter('Feature')
                          if node.get('name', '').lower().startswith('free')]
    modes = [mode for mode in profile['modes'] if mode['selectors'] == selectors]
    check(len(modes) == 1, 'BUY_MAPPING_REQUIRED')
    mode = modes[0]
    buy = mode['buy']
    check(type(buy) is int and ((mode['kind'] == 'base' and buy == 0)
          or (mode['kind'] == 'purchase' and 1 <= buy <= 10)
          or (mode['kind'] == 'enhanced' and buy >= 11)), 'INVALID_BUY_MAPPING')
    has_free = kind in {'freeGame', 'freeFeature'}
    bonus = 0
    if huff_type:
        check(kind == 'freeGame' and profile.get('featureSelector') == 'huff-hard-hat-v1', 'FEATURE_TYPE_MAPPING_REQUIRED')
        bonus = profile['featureTypes'][huff_type]
    elif has_jackpot:
        check(kind in {'feature','freeFeature'} and profile.get('featureSelector') == 'squid-jackpot-v1', 'FEATURE_TYPE_MAPPING_REQUIRED')
        bonus = profile['featureTypes'][kind]
    elif has_free:
        # This reviewed game has one automatic free-game feature and no CFG
        # selector in its native request/response protocol. Never apply this
        # interpretation to another game or to a fixture profile.
        if profile.get('fixtureOnly') is False and profile.get('freeSelector') == 'implicit-single-free-game' and (raw.get('sourceKey') == 'bookofsevens96-base-v1' or profile.get('adapter') == 'native-nextgen-v1'):
            check(protocol == 'nextgen' and free_selectors and all(selector is None for selector in free_selectors), 'FREE_TYPE_MAPPING_REQUIRED')
            free_selectors = ['native-free-game'] * len(free_selectors)
        check(free_selectors and all(selector is not None for selector in free_selectors), 'FREE_TYPE_MAPPING_REQUIRED')
        ids = [profile['freeTypes'].get(selector) for selector in free_selectors]
        check(all(type(code) is int and code > 0 for code in ids) and len(set(ids)) == 1, 'FREE_TYPE_MAPPING_REQUIRED')
        bonus = ids[0]
    return buy, bonus, mapping_hash

def derive(raw):
    check(isinstance(raw, dict) and raw.get('roundFieldsVersion') == VERSION, 'ROUND_FIELDS_VERSION_REQUIRED')
    check(isinstance(raw.get('steps'), list) and 0 < len(raw['steps']) <= 100 and all(isinstance(s, dict) for s in raw['steps']), 'INVALID_ROUND_STEPS')
    start = amount(raw.get('startBalanceRaw'))
    protocol = raw.get('protocol')
    check(protocol in {'nextgen', 'wms'}, 'UNSUPPORTED_PROTOCOL')
    end, win, kind, declared_stake = nextgen(raw) if protocol == 'nextgen' else wms(raw)
    stake = start - end + win
    check(type(stake) is int and 0 < stake <= MAX_SAFE, 'INVALID_WAGER_BASIS')
    if declared_stake is not None:
        check(stake == declared_stake, 'WAGER_BALANCE_MISMATCH')
    buy, bonus, mapping_hash = types(raw, kind)
    return {'roundFieldsVersion': VERSION, 'protocol': protocol,
            'bet': stake / 100, 'mul': win / stake, 'buy': buy, 'bonus': bonus, 'primaryBonusKind': kind,
            'sourceKey': raw['sourceKey'], 'typeMappingHash': mapping_hash,
            'money': {'startBalanceRaw': start, 'endBalanceRaw': end, 'totalWinRaw': win, 'betRaw': stake}}

def validate(raw, normalized):
    expected = derive(raw)
    actual = {key: value for key, value in normalized.items() if key not in {'fixtureOnly', 'sequence', 'gameKey'}}
    check(actual.keys() == expected.keys(), 'ROUND_FIELDS_MISMATCH')
    for name in ('bet', 'mul', 'buy', 'bonus'):
        check(type(actual[name]) in (int, float) and math.isfinite(actual[name]), 'ROUND_FIELDS_MISMATCH')
    check(actual == expected, 'ROUND_FIELDS_MISMATCH')
    return {key: expected[key] for key in ('bet', 'mul', 'buy', 'bonus', 'roundFieldsVersion')}

if __name__ == '__main__':
    try:
        value = json.loads(sys.stdin.buffer.read(16385))
        print(json.dumps({'ok': True, 'fields': derive(value)}, separators=(',', ':')))
    except (FieldError, ValueError, TypeError, KeyError, OverflowError):
        print(json.dumps({'ok': False, 'error': 'ROUND_FIELD_ANALYSIS_REJECTED'}))
        sys.exit(2)
