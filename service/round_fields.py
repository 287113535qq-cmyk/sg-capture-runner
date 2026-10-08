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
    from quarterback_fields import SOURCE as QUARTERBACK_SOURCE, is_foam, feature_settlement
    if raw.get('sourceKey') == QUARTERBACK_SOURCE and is_foam(raw):
        return feature_settlement(raw)
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
    from pyramids_fields import SOURCE as PYRAMIDS_SOURCE, EXTENSION as PYRAMIDS_EXTENSION, hold_type, PyramidsFields
    from pyramids_free_review import feature_type as pyramids_free_type
    pyramids_free = source_key == PYRAMIDS_SOURCE and pyramids_free_type(raw)
    from pyramids_super_hold_review import has_super_hold, EXTENSION as PYRAMIDS_SUPER_HOLD_EXTENSION
    pyramids_super = source_key == PYRAMIDS_SOURCE and has_super_hold(raw)
    from pyramids_super_free_review import has_super_free, EXTENSION as PYRAMIDS_SUPER_FREE_EXTENSION
    pyramids_super_free = source_key == PYRAMIDS_SOURCE and has_super_free(raw)
    from pyramids_retrigger_review import has_retrigger, EXTENSION as PYRAMIDS_RETRIGGER_EXTENSION
    pyramids_retrigger = source_key == PYRAMIDS_SOURCE and has_retrigger(raw)
    from pyramids_coin_review import has_cash_coins, EXTENSION as PYRAMIDS_COIN_EXTENSION
    pyramids_coins = source_key == PYRAMIDS_SOURCE and has_cash_coins(raw)
    from pyramids_super_coin_review import has_super_coins, EXTENSION as PYRAMIDS_SUPER_COIN_EXTENSION
    pyramids_super_coins = source_key == PYRAMIDS_SOURCE and has_super_coins(raw)
    from pyramids_major_review import has_major, EXTENSION as PYRAMIDS_MAJOR_EXTENSION
    from pyramids_mixed_review import has_mixed, EXTENSION as PYRAMIDS_MIXED_EXTENSION
    from pyramids_fifteen_review import has_fifteen, EXTENSION as PYRAMIDS_FIFTEEN_EXTENSION
    pyramids_fifteen = source_key == PYRAMIDS_SOURCE and has_fifteen(raw)
    pyramids_mixed = source_key == PYRAMIDS_SOURCE and has_mixed(raw)
    pyramids_major = pyramids_free and has_major(raw)
    if pyramids_major: PYRAMIDS_EXTENSION = PYRAMIDS_MAJOR_EXTENSION
    if pyramids_mixed: PYRAMIDS_EXTENSION = PYRAMIDS_MIXED_EXTENSION
    if pyramids_fifteen: PYRAMIDS_EXTENSION = PYRAMIDS_FIFTEEN_EXTENSION
    if pyramids_super: PYRAMIDS_EXTENSION = PYRAMIDS_SUPER_HOLD_EXTENSION
    if pyramids_super_free: PYRAMIDS_EXTENSION = PYRAMIDS_SUPER_FREE_EXTENSION
    if pyramids_retrigger: PYRAMIDS_EXTENSION = PYRAMIDS_RETRIGGER_EXTENSION
    if pyramids_coins: PYRAMIDS_EXTENSION = PYRAMIDS_COIN_EXTENSION
    if pyramids_super_coins: PYRAMIDS_EXTENSION = PYRAMIDS_SUPER_COIN_EXTENSION
    if source_key == PYRAMIDS_SOURCE:
        pplan={'gameId':32721,'sourceKey':PYRAMIDS_SOURCE,'betRaw':20,'requestParams':{'BPL':'1','GN':'hyperchargedpyramidsofra96','LB':'40'}}
        check(PyramidsFields(pplan).next_request(raw) is None, 'INCOMPLETE_ROUND')
    from piggies_fields import SIZE2_EXTENSION, has_size2, PiggiesFields
    piggies_size2 = has_size2(raw)
    if piggies_size2:
        plan=json.loads((Path(__file__).resolve().parents[1]/'config/round-one-plans.json').read_text())['32636']
        check(PiggiesFields(plan).sequence(raw) is None,'INCOMPLETE_ROUND')
    # An additive feature profile leaves every previously accepted native-only
    # record and mapping hash unchanged, including partially saved old rounds.
    from squid_fields import SOURCE as SQUID_SOURCE, EXTENSION
    has_jackpot = source_key == SQUID_SOURCE and any(s['msgId'].startswith('FEATURE_') for s in raw['steps'])
    from huff_fields import SOURCE as HUFF_SOURCE, EXTENSION as HUFF_EXTENSION, feature_type
    from huff_touchup_review import EXTENSION as HUFF_TOUCHUP_EXTENSION, review_touchup
    huff_type = feature_type(raw) if source_key == HUFF_SOURCE else None
    if huff_type == 'hardHatRetrigger':
        from huff_retrigger_review import EXTENSION as HUFF_EXTENSION, review as review_retrigger
        check(review_retrigger(raw)['candidateComplete'], 'INCOMPLETE_ROUND')
    if huff_type == 'moneyMansionTouchUp':
        plan = json.loads((Path(__file__).resolve().parents[1] / 'config/round-one-plans.json').read_text())['32714']
        check(review_touchup(plan, raw)['candidateComplete'], 'INCOMPLETE_ROUND')
        HUFF_EXTENSION = HUFF_TOUCHUP_EXTENSION
    from demon_fields import SOURCE as DEMON_SOURCE, EXTENSION as DEMON_EXTENSION, feature_type as demon_feature_type
    from demon_nested_fields import has_nested, EXTENSION as NESTED_EXTENSION
    nested_type = has_nested(raw) if source_key == DEMON_SOURCE else False
    demon_type = ('demonNestedFreeGames' if nested_type else demon_feature_type(raw)) if source_key == DEMON_SOURCE else None
    from quarterback_fields import SOURCE as QUARTERBACK_SOURCE, EXTENSION as QUARTERBACK_EXTENSION, PICK_EXTENSION, is_pick, is_foam
    from beaver_fields import SOURCE as BEAVER_SOURCE, EXTENSION as BEAVER_EXTENSION, CFG1_EXTENSION, cfg1_type, feature_type as beaver_feature_type
    beaver_type = source_key == BEAVER_SOURCE and beaver_feature_type(raw)
    from morepuff_fields import SOURCE as MOREPUFF_SOURCE, EXTENSION as MOREPUFF_EXTENSION, feature_type as morepuff_feature_type
    morepuff_type = source_key == MOREPUFF_SOURCE and morepuff_feature_type(raw)
    from morepuff_megahat_review import EXTENSION as MEGAHAT_EXTENSION, has_megahat, inspect as inspect_megahat
    morepuff_megahat = morepuff_type and has_megahat(raw)
    if morepuff_megahat:
        check(inspect_megahat(raw)['complete'], 'INCOMPLETE_ROUND')
        MOREPUFF_EXTENSION = MEGAHAT_EXTENSION
    from inca_free_review import SOURCE as INCA_SOURCE, EXTENSION as INCA_EXTENSION, feature_type as inca_feature_type, IncaSequence
    inca_type = source_key == INCA_SOURCE and inca_feature_type(raw)
    from inca_coin_review import EXTENSION as INCA_COIN_EXTENSION, has_coins, IncaCoinSequence
    inca_coin = inca_type and has_coins(raw)
    if inca_coin:
        INCA_EXTENSION = INCA_COIN_EXTENSION
    if inca_type:
        check((IncaCoinSequence if inca_coin else IncaSequence)({'gameId':32719,'sourceKey':INCA_SOURCE,'betRaw':20,'requestParams':{'BPL':'1','GN':'hyperchargedincajungle96','LB':'40'}}).sequence(raw) is None, 'INCOMPLETE_ROUND')
    from jinzita_fields import SOURCE as JINZITA_SOURCE, EXTENSION as JINZITA_EXTENSION, feature_type as jinzita_feature_type
    jinzita_type = source_key == JINZITA_SOURCE and jinzita_feature_type(raw)
    from luxor_fields import SOURCE as LUXOR_SOURCE, EXTENSION as LUXOR_EXTENSION, feature_type as luxor_feature_type
    luxor_type = source_key == LUXOR_SOURCE and luxor_feature_type(raw)
    foam_type = source_key == QUARTERBACK_SOURCE and is_foam(raw)
    beaver_cfg1 = beaver_type and cfg1_type(raw)
    profile, mapping_hash = type_profile(PYRAMIDS_EXTENSION if pyramids_free or pyramids_super else INCA_EXTENSION if inca_type else SIZE2_EXTENSION if piggies_size2 else MOREPUFF_EXTENSION if morepuff_type else JINZITA_EXTENSION if jinzita_type else LUXOR_EXTENSION if luxor_type else (CFG1_EXTENSION if beaver_cfg1 else BEAVER_EXTENSION) if beaver_type else (PICK_EXTENSION if is_pick(raw) else QUARTERBACK_EXTENSION) if foam_type else (NESTED_EXTENSION if nested_type else DEMON_EXTENSION) if demon_type else HUFF_EXTENSION if huff_type else EXTENSION if has_jackpot else source_key)
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
    if pyramids_super:
        check(kind=='freeGame' and profile.get('featureSelector')=='pyramids-super-hold-cash-v1','FEATURE_TYPE_MAPPING_REQUIRED')
        bonus=profile['featureTypes']['superHoldCash']
    elif pyramids_free:
        check(kind=='freeGame' and profile.get('featureSelector')==('pyramids-super-cash-coins-v1' if pyramids_super_coins else 'pyramids-cash-coins-v1' if pyramids_coins else 'pyramids-ten-retrigger-v1' if pyramids_retrigger else 'pyramids-super-free-v1' if pyramids_super_free else 'pyramids-fifteen-free-v1' if pyramids_fifteen else 'pyramids-free-hold-v1' if pyramids_mixed else 'pyramids-free-major-v1' if pyramids_major else 'pyramids-ten-free-v1'),'FEATURE_TYPE_MAPPING_REQUIRED')
        bonus=profile['featureTypes']['independentFreeGames']
    elif piggies_size2:
        check(kind=='freeGame' and profile.get('featureSelector')=='piggies-size2-free-v1','FEATURE_TYPE_MAPPING_REQUIRED')
        bonus=profile['freeTypes']['native-free-game']
    elif morepuff_type:
        check(kind == 'freeGame' and profile.get('featureSelector') == ('morepuff-wheel-megahat-single-v1' if morepuff_megahat else 'morepuff-wheel-cash-v1'), 'FEATURE_TYPE_MAPPING_REQUIRED')
        bonus = profile['featureTypes']['wheelMegaHatSingle' if morepuff_megahat else 'wheelCash']
    elif inca_type:
        check(kind == 'freeGame' and profile.get('featureSelector') == ('inca-coin-free-v1' if inca_coin else 'inca-ten-free-v1'), 'FEATURE_TYPE_MAPPING_REQUIRED')
        bonus = profile['featureTypes']['independentFreeGames']
    elif jinzita_type:
        check(kind == 'freeGame' and profile.get('featureSelector') == 'jinzita-free-v1', 'FEATURE_TYPE_MAPPING_REQUIRED')
        bonus = profile['featureTypes']['independentFreeGames']
    elif luxor_type:
        check(kind == 'freeGame' and profile.get('featureSelector') == 'luxor-free-v1', 'FEATURE_TYPE_MAPPING_REQUIRED')
        bonus = profile['featureTypes']['independentFreeGames']
    elif beaver_type:
        check(kind == 'freeGame' and profile.get('featureSelector') == ('beaver-free-cfg1-v2' if beaver_cfg1 else 'beaver-free-v1'), 'FEATURE_TYPE_MAPPING_REQUIRED')
        bonus = profile['featureTypes']['independentFreeGames']
    elif foam_type:
        check(kind == 'feature' and profile.get('featureSelector') == ('quarterback-pick-a-ball-v1' if is_pick(raw) else 'quarterback-foam-v1'), 'FEATURE_TYPE_MAPPING_REQUIRED')
        bonus = profile['featureTypes']['pickABall' if is_pick(raw) else 'foamPick']
    elif demon_type:
        check(kind == 'freeGame' and profile.get('featureSelector') == ('demon-nested-free-v1' if nested_type else 'demon-free-v1'), 'FEATURE_TYPE_MAPPING_REQUIRED')
        bonus = profile['featureTypes'][demon_type]
    elif huff_type:
        check(kind == 'freeGame' and profile.get('featureSelector') == ('huff-hard-hat-retrigger-v2' if huff_type == 'hardHatRetrigger' else 'huff-touchup-cash-v1' if huff_type == 'moneyMansionTouchUp' else 'huff-hard-hat-v1'), 'FEATURE_TYPE_MAPPING_REQUIRED')
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
    if raw.get('zeroAbpmContract') is not None:
        from zero_abpm_fields import settled as zero_settled
        return zero_settled(raw)
    check(isinstance(raw, dict) and raw.get('roundFieldsVersion') == VERSION, 'ROUND_FIELDS_VERSION_REQUIRED')
    from five_treasures_fields import SOURCE as FIVE_SOURCE, settled as five_settled, mapping_hash as five_mapping
    if raw.get('sourceKey') == FIVE_SOURCE:
        return five_settled(raw, five_mapping())
    from eighty_fortunes_fields import SOURCE as EIGHTY_SOURCE, settled as eighty_settled, mapping_hash as eighty_mapping
    if raw.get('sourceKey') == EIGHTY_SOURCE:
        return eighty_settled(raw, eighty_mapping())
    from arthur_feature_fields import CONTRACT as ARTHUR_FEATURE, settled as arthur_feature_settled
    if raw.get("arthurFeatureContract") is not None:
        return arthur_feature_settled(raw)
    from arthur_base_fields import SOURCE as ARTHUR_SOURCE, settled as arthur_settled, mapping_hash as arthur_mapping
    if raw.get('sourceKey') == ARTHUR_SOURCE:
        return arthur_settled(raw, arthur_mapping())
    from blazing_x_fields import SOURCE as BLAZING_SOURCE, settled as blazing_settled, mapping_hash as blazing_mapping
    if raw.get('sourceKey') == BLAZING_SOURCE:
        return blazing_settled(raw, blazing_mapping())
    from actionbank_base_fields import SOURCE as ACTIONBANK_SOURCE, settled as actionbank_settled, mapping_hash as actionbank_mapping
    if raw.get('sourceKey') == ACTIONBANK_SOURCE:
        return actionbank_settled(raw, actionbank_mapping())
    from celestial_base_fields import SOURCE as CELESTIAL_SOURCE, settled as celestial_settled, mapping_hash as celestial_mapping
    if raw.get('sourceKey') == CELESTIAL_SOURCE:
        return celestial_settled(raw, celestial_mapping())
    from cheshire_base_fields import SOURCE as CHESHIRE_SOURCE, settled as cheshire_settled, mapping_hash as cheshire_mapping
    if raw.get('sourceKey') == CHESHIRE_SOURCE:
        return cheshire_settled(raw, cheshire_mapping())
    from cooljewels_base_fields import SOURCE as COOLJEWELS_SOURCE, settled as cooljewels_settled, mapping_hash as cooljewels_mapping
    if raw.get('sourceKey') == COOLJEWELS_SOURCE:
        return cooljewels_settled(raw, cooljewels_mapping())
    from crystalforest_ordinary_v2_fields import SOURCE as CRYSTALFOREST_V2_SOURCE, settled as crystalforest_v2_settled, mapping_hash as crystalforest_v2_mapping
    if raw.get('sourceKey') == CRYSTALFOREST_V2_SOURCE:
        return crystalforest_v2_settled(raw, crystalforest_v2_mapping())
    from crystalforest_base_fields import SOURCE as CRYSTALFOREST_SOURCE, settled as crystalforest_settled, mapping_hash as crystalforest_mapping
    if raw.get('sourceKey') == CRYSTALFOREST_SOURCE:
        return crystalforest_settled(raw, crystalforest_mapping())
    from dancingdrums_base_fields import SOURCE as DANCINGDRUMS_SOURCE, settled as dancingdrums_settled, mapping_hash as dancingdrums_mapping
    if raw.get('sourceKey') == DANCINGDRUMS_SOURCE:
        return dancingdrums_settled(raw, dancingdrums_mapping())
    from drumsexplosion_base_fields import SOURCE as DRUMSEXPLOSION_SOURCE, settled as drumsexplosion_settled, mapping_hash as drumsexplosion_mapping
    if raw.get('sourceKey') == DRUMSEXPLOSION_SOURCE:
        return drumsexplosion_settled(raw, drumsexplosion_mapping())
    from desertcats_base_fields import SOURCE as DESERTCATS_SOURCE, settled as desertcats_settled, mapping_hash as desertcats_mapping
    if raw.get('sourceKey') == DESERTCATS_SOURCE:
        return desertcats_settled(raw, desertcats_mapping())
    from jekyll_base_fields import SOURCE as JEKYLL_SOURCE, settled as jekyll_settled, mapping_hash as jekyll_mapping
    if raw.get('sourceKey') == JEKYLL_SOURCE:
        return jekyll_settled(raw, jekyll_mapping())
    from dragonspin_base_fields import SOURCE as DRAGONSPIN_SOURCE, settled as dragonspin_settled, mapping_hash as dragonspin_mapping
    if raw.get('sourceKey') == DRAGONSPIN_SOURCE:
        return dragonspin_settled(raw, dragonspin_mapping())
    from deepseamagic_base_fields import SOURCE as DEEPSEAMAGIC_SOURCE, settled as deepseamagic_settled, mapping_hash as deepseamagic_mapping
    if raw.get('sourceKey') == DEEPSEAMAGIC_SOURCE:
        return deepseamagic_settled(raw, deepseamagic_mapping())
    from eurekablast_base_fields import SOURCE as EUREKABLAST_SOURCE, settled as eurekablast_settled, mapping_hash as eurekablast_mapping
    if raw.get('sourceKey') == EUREKABLAST_SOURCE:
        return eurekablast_settled(raw, eurekablast_mapping())
    from firequeen_base_fields import SOURCE as FIREQUEEN_SOURCE, settled as firequeen_settled, mapping_hash as firequeen_mapping
    if raw.get('sourceKey') == FIREQUEEN_SOURCE:
        return firequeen_settled(raw, firequeen_mapping())
    from frozeninferno_base_fields import SOURCE as FROZENINFERNO_SOURCE, settled as frozeninferno_settled, mapping_hash as frozeninferno_mapping
    if raw.get('sourceKey') == FROZENINFERNO_SOURCE:
        return frozeninferno_settled(raw, frozeninferno_mapping())
    from fudaole_base_fields import SOURCE as FUDAOLE_SOURCE, settled as fudaole_settled, mapping_hash as fudaole_mapping
    if raw.get('sourceKey') == FUDAOLE_SOURCE:
        return fudaole_settled(raw, fudaole_mapping())
    from giantsgold_base_fields import SOURCE as GIANTSGOLD_SOURCE, settled as giantsgold_settled, mapping_hash as giantsgold_mapping
    if raw.get('sourceKey') == GIANTSGOLD_SOURCE:
        return giantsgold_settled(raw, giantsgold_mapping())
    from goldenchief_base_fields import SOURCE as GOLDENCHIEF_SOURCE, settled as goldenchief_settled, mapping_hash as goldenchief_mapping
    if raw.get('sourceKey') == GOLDENCHIEF_SOURCE:
        return goldenchief_settled(raw, goldenchief_mapping())
    from heidibier_base_fields import SOURCE as HEIDIBIER_SOURCE, settled as heidibier_settled, mapping_hash as heidibier_mapping
    if raw.get('sourceKey') == HEIDIBIER_SOURCE:
        return heidibier_settled(raw, heidibier_mapping())
    from hercules_base_fields import SOURCE as HERCULES_SOURCE, settled as hercules_settled, mapping_hash as hercules_mapping
    if raw.get('sourceKey') == HERCULES_SOURCE:
        return hercules_settled(raw, hercules_mapping())
    from himalayas_base_fields import SOURCE as HIMALAYAS_SOURCE, settled as himalayas_settled, mapping_hash as himalayas_mapping
    if raw.get('sourceKey') == HIMALAYAS_SOURCE:
        return himalayas_settled(raw, himalayas_mapping())
    from hulahula_base_fields import SOURCE as HULAHULA_SOURCE, settled as hulahula_settled, mapping_hash as hulahula_mapping
    if raw.get('sourceKey') == HULAHULA_SOURCE:
        return hulahula_settled(raw, hulahula_mapping())
    from moolah_base_fields import SOURCE as MOOLAH_SOURCE, settled as moolah_settled, mapping_hash as moolah_mapping
    if raw.get('sourceKey') == MOOLAH_SOURCE:
        return moolah_settled(raw, moolah_mapping())
    from jinjimegaways_base_fields import SOURCE as JINJIMEGAWAYS_SOURCE, settled as jinjimegaways_settled, mapping_hash as jinjimegaways_mapping
    if raw.get('sourceKey') == JINJIMEGAWAYS_SOURCE:
        return jinjimegaways_settled(raw, jinjimegaways_mapping())
    from jinjitreasure_base_fields import SOURCE as JINJITREASURE_SOURCE, settled as jinjitreasure_settled, mapping_hash as jinjitreasure_mapping
    if raw.get('sourceKey') == JINJITREASURE_SOURCE:
        return jinjitreasure_settled(raw, jinjitreasure_mapping())
    from jinsedragon_base_fields import SOURCE as JINSEDRAGON_SOURCE, settled as jinsedragon_settled, mapping_hash as jinsedragon_mapping
    if raw.get('sourceKey') == JINSEDRAGON_SOURCE:
        return jinsedragon_settled(raw, jinsedragon_mapping())
    from kingbabylon_base_fields import SOURCE as KINGBABYLON_SOURCE, settled as kingbabylon_settled, mapping_hash as kingbabylon_mapping
    if raw.get('sourceKey') == KINGBABYLON_SOURCE:
        return kingbabylon_settled(raw, kingbabylon_mapping())
    from acorn_ordinary_v2_fields import SOURCE as ACORN_V2_SOURCE, settled as acorn_v2_settled, mapping_hash as acorn_v2_mapping
    if raw.get('sourceKey') == ACORN_V2_SOURCE:
        return acorn_v2_settled(raw, acorn_v2_mapping())
    from acorn_base_fields import SOURCE as ACORN_SOURCE, settled as acorn_settled, mapping_hash as acorn_mapping
    if raw.get('sourceKey') == ACORN_SOURCE:
        return acorn_settled(raw, acorn_mapping())
    from fortunes_megaways_fields import SOURCE as FORTUNES_SOURCE, settled as fortunes_settled, mapping_hash as fortunes_mapping
    if raw.get('sourceKey') == FORTUNES_SOURCE:
        return fortunes_settled(raw, fortunes_mapping())
    if raw.get('ownTerminalContract') is not None:
        from own_terminal_fields import settled as own_terminal_settled
        import json
        from pathlib import Path
        registry=json.loads((Path(__file__).resolve().parents[1]/'config/ag-rolling-plans.json').read_text(encoding='utf8'))
        plans=[p for p in registry['plans'].values() if p.get('sourceKey')==raw.get('sourceKey')]
        check(len(plans)==1,'OWN_TERMINAL_REGISTERED_SOURCE')
        return own_terminal_settled(raw,plans[0])
    if raw.get('automaticTerminalContract') is not None:
        from automatic_terminal_fields import settled as terminal_settled
        return terminal_settled(raw)
    if raw.get('automaticFreeContract') is not None:
        from automatic_free_fields import settled as automatic_settled
        return automatic_settled(raw)
    if raw.get('balanceContract') is not None:
        from held_balance_fields import settled as held_settled
        return held_settled(raw)
    from rhino_fields import RhinoFields, SOURCE as RHINO_SOURCE
    if raw.get('sourceKey') == RHINO_SOURCE:
        return RhinoFields({'gameId':32799,'runtimeGameId':33159,'sourceKey':RHINO_SOURCE,'betRaw':40}).settled(raw)
    from pearl_fields import PearlFields, SOURCE as PEARL_SOURCE
    if raw.get('sourceKey') == PEARL_SOURCE:
        from pearl_award_fields import PearlAwardFields
        return PearlAwardFields({'gameId':32795,'runtimeGameId':33155,'sourceKey':PEARL_SOURCE,'betRaw':200}).settled(raw)
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
