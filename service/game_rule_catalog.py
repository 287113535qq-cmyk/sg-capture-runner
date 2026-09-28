"""Documentation only: export implemented rules without authorizing capture."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                    separators=(',', ':')).encode()).hexdigest()


COMMON_FIELDS = {
    'MSGID': '请求/响应消息类型必须一致；一大局只有一次 BET。',
    'PID': '一大局内必须为同一会话；档案不保存或展示实际值。',
    'NFG': '当前适配器用于决定免费续局；正数继续 FREE_GAME。实际缺失与显式 0 分开统计。',
    'IFG': '免费响应要求 IFG=1；不是单独的大局完成标记。',
    'FID': '玩法标记，含义按本游戏适配器解释，不能跨游戏套用。',
    'B / AB': '终帧两个余额必须一致。',
    'TW': '大局总赢奖；与初始余额、最终余额共同核对实际下注。',
    'SUCCESS / PAYLOAD': 'XML 必须成功且 PAYLOAD 与保存的响应全文一致。',
}


def contract(game_id):
    native = {
        'family': 'native-nextgen-v1',
        'messages': ['BET', 'FREE_GAME'],
        'start': '首帧 BET，后续只能 FREE_GAME；一大局内会话不变。',
        'continue': '上一帧经校验的 NFG>0 才请求 FREE_GAME。',
        'complete': '最终 NFG=0（普通 BET 缺失时当前实现按 0 判断）且完整序列、XML、金额与 buy0 全部校验通过。FREE_GAME 必须显式含 NFG。',
        'bounds': '当前仅接受 FID 缺失/空/0/0|；拒绝 FS_*、NFR_*、CFG、ABPM 及其他未知玩法。不能据此认定游戏只有一种玩法。',
        'files': ['service/native_nextgen_fields.py', 'service/round_fields.py', 'scripts/runner-v2/record_fields.py'],
        'fields': dict(COMMON_FIELDS),
    }
    if game_id == 32471:
        native['family'] = 'book-of-sevens-native-v1'
        native['files'][0] = 'service/trial_fields.py'
        native['fields']['BPL / LB'] = '请求和响应固定 BPL=5、LB=5；实际下注 25。'
    elif game_id == 32651:
        native.update({'family': 'squid-jackpot-v1', 'messages': ['BET', 'FREE_GAME', 'FEATURE_START', 'FEATURE_PICK', 'FEATURE_END'],
            'start': '首帧 BET；其后按完整历史执行自然免费或 Jackpot 功能，不能再次 BET；一大局内会话不变。',
            'continue': '自然 Jackpot 按完整历史执行 START → 规定次数 PICK → END；结束后有 NFG 再 FREE_GAME。',
            'complete': '完整状态机无下一步；不能仅凭某一帧缺失 NFG 判定结束。再核对 XML、会话和金额。',
            'bounds': '只支持本游戏 CFG1 Jackpot 与普通免费；FREE_GAME 后的 Jackpot 重触发仍拒绝。'})
        native['files'] += ['service/squid_fields.py', 'scripts/trial/squid-protocol.mjs']
        native['fields'].update({
            'CFG / FS_1 / NFR_1 / FPM_1': '自然触发要求 CFG=1、FS_1=0、NFR_1=1、FPM_1=|。',
            'FTV_1': '触发时取得需要的选择次数；不是按奖值选择位置。',
            'FP': '1|从1开始的选择次数|从0开始的位置；当前按位置顺序且不重复。',
            'FEATURE_START': '成功响应可能不含 FS/CFG；开始状态由完整已持久化历史维护。',
        })
    elif game_id == 32714:
        native.update({'family': 'huff-hard-hat-v1',
            'continue': 'NFG>0，或 FID 首槽0且 GSD.MMBG=1、MMW无结果时继续 FREE_GAME；重触发不固定循环次数。',
            'complete': '无下一步，HardHat 必须有 HARDHAT 免费响应；组合还需 MMANSION 响应；再核对金额。MMBG=1 且已有 MMW、NFG=0 不额外续局。',
            'bounds': '仅支持 FID0/1 及两槽组合、FEAT MMANSION/HARDHAT；其他功能仍拒绝。FID清零不等于新触发。'})
        native['files'] += ['service/huff_fields.py', 'service/huff_feature_review.py', 'scripts/trial/huff-protocol.mjs']
        native['fields'].update({
            'FID / GSD.PCFID / GSD.FEAT': '当前两槽、前一槽及实际重播玩法分别保留；FID1=HardHat，仅适用于本游戏。',
            'TFG / CFGG': '免费总次数/当前进度保留；不假设每帧 NFG 必须减1。',
            'GSD.MMBG / GSD.MMW': 'Money Mansion 标记与结果是否存在；MMBG 不是剩余次数。',
        })
    return native


REVIEW_DOCS = {
    32651: ['docs/squid-jackpot-protocol.md'],
    32671: ['docs/natural-feature-review-32671-32736.md'],
    32736: ['docs/natural-feature-review-32671-32736.md'],
    32714: ['docs/huff-hard-hat-protocol.md', 'docs/huff-natural-free-stop-20260928.md'],
    32717: ['docs/huff-goals-client-review-20260928.md'],
}


def cards(root=ROOT):
    games = json.loads((root / 'config/games.json').read_text(encoding='utf-8'))
    plans = json.loads((root / 'config/round-one-plans.json').read_text(encoding='utf-8'))
    book = json.loads((root / 'config/trial-300k.json').read_text(encoding='utf-8'))
    plans[str(book['gameId'])] = book
    profiles = json.loads((root / 'service/round_types.json').read_text(encoding='utf-8'))['profiles']
    # Index already-saved focused analyses, not broad progress tables that list every game.
    known = {str(g['gameId']) for g in games}
    analyses = {gid: set(REVIEW_DOCS.get(int(gid), [])) for gid in known}
    for path in sorted((root / 'docs').glob('*')):
        if path.suffix not in {'.md', '.json'}:
            continue
        mentioned = set(re.findall(r'(?<![0-9])([0-9]{5})(?![0-9])', path.read_text(encoding='utf-8-sig'))) & known
        if len(mentioned) <= 10:
            for gid in mentioned:
                analyses[gid].add(path.relative_to(root).as_posix())
    output = {}
    for game in sorted(games, key=lambda x: x['gameId']):
        gid = game['gameId']; plan = plans.get(str(gid)); rule = contract(gid) if plan else None
        mapping = {k: v for k, v in profiles.items() if plan and (k == plan['sourceKey'] or k.startswith(plan['sourceKey'] + '-')) and v.get('fixtureOnly') is False}
        # Export only reviewed selectors/type mappings, never arbitrary payloads.
        types = {k: {f: v.get(f) for f in ['protocol', 'modeSelectorKeys', 'modes', 'freeSelector', 'freeTypes', 'featureSelector', 'featureTypes']} for k, v in mapping.items()}
        codes = sorted({n for p in mapping.values() for field in ['freeTypes', 'featureTypes'] for n in (p.get(field) or {}).values() if type(n) is int and n > 0})
        names = (rule['files'] + ['service/game_rule_catalog.py']) if rule else ['service/game_rule_catalog.py']
        card = {'schema': 'sg-game-rule-card-v1', 'gameId': gid, 'name': game['name'],
            'runtimeGameId': game['runtimeGameId'], 'scope': 'round-one-ordinary-buy0',
            'captureAuthorization': False, 'liveQueueStatus': 'read-from-Mongo-not-this-card',
            'ruleAvailability': 'implemented-subset' if rule else 'not-documented',
            'sourceKey': plan.get('sourceKey') if plan else None, 'planHash': digest(plan) if plan else None,
            'parameters': {k: plan.get(k) for k in ['trialId', 'runtimeSlug', 'buy', 'betRaw', 'requestParams', 'maxSteps']} if plan else None,
            'roundRule': rule, 'typeMappings': types,
            'mappingHashes': {k: hashlib.sha256(json.dumps(v, sort_keys=True, separators=(',', ':')).encode()).hexdigest() for k, v in mapping.items()},
            'configuredNaturalBonusCodes': codes if mapping else None,
            'configuredOutcomeCategoryCount': len(codes) if mapping else None,
            'allSpecialStageTypesTotal': None, 'allSpecialStageTypesCovered': False,
            'categoryCountMeaning': '已配置的自然 bonus 分类数，含组合类别；不是独立小游戏总数或全部玩法证明。',
            'settlement': {'stakeRaw': 'startBalanceRaw - finalBalanceRaw + TW', 'bet': 'stakeRaw / 100', 'mul': 'TW / stakeRaw', 'required': 'stakeRaw 必须等于本计划 betRaw，buy=0；最终 B=AB。'} if plan else None,
            'codeSources': {f: hashlib.sha256((root / f).read_bytes().replace(b'\r\n', b'\n')).hexdigest() for f in names},
            'reviewDocuments': REVIEW_DOCS.get(gid, []),
            'analysisDocuments': sorted(analyses[str(gid)]),
            'analysisDocumentHashes': {p: hashlib.sha256((root / p).read_bytes().replace(b'\r\n', b'\n')).hexdigest() for p in sorted(analyses[str(gid)])},
            'observations': {'status': 'separate-audit-or-parked-evidence', 'actualSpecialStageCount': None,
                'journalKey': 'game-rules:<trialId>:<recordsHash>:<archiveHash>', 'retroactiveScanPerformed': False},
            'privacy': '不保存 PID、会话、Cookie、令牌、启动URL或原始协议；原始证据留在私有日志。'}
        card['ruleHash'] = digest(card); output[gid] = card
    return output


def generated(root=ROOT):
    result = cards(root); files = {}
    intro = '# 每游戏规则档案\n\n自动生成；不代表实时队列或授权恢复。缺失信息为 null，不能当作 0 个特殊玩法。规则来自当前适配器，实际覆盖来自私有终审/暂挂证据。\n\n已完成及当前旧运行不追加重扫，已有原始证据保留；新版本终审会顺带汇总实际环节。\n\n| 游戏 | 名称 | 规则范围 | 已配置自然分类数 |\n|---|---|---|---|\n'
    for gid, card in result.items():
        files[f'{gid}.json'] = json.dumps(card, ensure_ascii=False, indent=2) + '\n'
        intro += f"| [{gid}]({gid}.json) | {card['name']} | {card['ruleAvailability']} | {card['configuredOutcomeCategoryCount'] if card['configuredOutcomeCategoryCount'] is not None else '待确认'} |\n"
    files['README.md'] = intro
    return files
