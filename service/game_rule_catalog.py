"""Documentation only: export implemented rules without authorizing capture."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME_ID_PATTERN = re.compile(r'(?<![0-9A-Za-z])([0-9]{5})(?![0-9A-Za-z])')


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
    elif game_id == 32739:
        native.update({'family': 'demon-nested-v1',
            'continue': '旧FID0 reaction与FID1|0|保留原规则；已审核FID0|1|内层reaction要求明确NFG>0、外层保存计数守恒及原FREE_GAME参数。未知返回或内层NFG0拒绝审查，不根据SNFG猜测追加请求。',
            'complete': '旧分支显式NFG=0；嵌套需完整历史及受约束的显式外层返回/终态，再核对B/AB、TW和实际下注100。合成终态通过不能代替真实自然免费终局证据。',
            'bounds': 'Python/Runner/TS嵌套入口已部署；明确支持的0|1|前缀及27合成边界已测试。未知计数转换、最大赢额提前退出及其他栈仍拒绝；真实218和440接续均被会话拒绝，尚无新自然bonus2完整证据，正式采集未恢复。'})
        native['files'] += ['service/demon_fields.py', 'service/demon_nested_fields.py', 'scripts/trial/demon-protocol.mjs', 'scripts/trial/demon-nested-protocol.mjs', 'collector/sg.demon.ts']
        native['fields'].update({
            'FID': '首槽0为reaction，含1表示免费模式；1|0|为外层免费，受约束的0|1|为免费内部reaction，保留完整槽位。',
            'TFG / CFGG / FGT': '总数、当前免费进度和新触发数；模式转换会重置计数，不要求逐帧 NFG 减1。',
            'GSD.SNFG / STFG / EFG / EFGS / SBEFG': '客户端保存/显示的免费次数及新增次数信息，不取代 NFG 终局判定。',
            'GSD.DST / DFFP / DDDP / DCCS / DAAP / DAAS': '客户端四种 Demon 演出及其结果字段；保留原始证据，归档只存有界类型/存在统计。',
            'GSD.EVP / RGS / RGSF / SCP / SCMB / SCM / CSF / CSD / ICSD': 'Void、HellGate、HeartStopper、消除和盘面演出证据；不额外发送选择或下注请求。',
            'GSD.IMUL / NMUL / PMUL / CTW / CAPS': '倍率、客户端累计赢奖和封顶显示证据；结算仍独立核对 TW/B/AB。',
        })
    elif game_id == 32820:
        native.update({'family': 'beaver-independent-free-cfg1-v2',
            'continue': '独立FID1必须由首BET触发；NFG>0按原会话和下注参数继续FREE_GAME。免费帧必须保留NFG/TFG/CFGG，缺失不补零。',
            'complete': '完整序列至少含一次免费响应，显式NFG=0后核对XML、B/AB、TW与实际下注100；独立FID1映射bonus2，旧FID0映射保持。',
            'bounds': '新会话试采36624576401新增60完整bonus0并全部Mongo核验，当前trial98；一条FID1免费响应的GSD.CFG=1被本方误判为嵌套，客户端两真实帧均应继续，已精确修正CFG1识别并用新v2映射独立记录；真实两帧离线next为FREE_GAME，不能计完整。该半局已留样作废且pending0，不续接。尚无真实FID1终局，混合/10/11/20/21及中途切FID1仍拒绝，不能标ready。'})
        native['files'] += ['service/beaver_fields.py', 'scripts/trial/beaver-protocol.mjs', 'collector/sg.beaver.ts']
        native['fields'].update({
            'FID': '1=freespins，0=Beaver Bonus；10/11消除与20/21选择仅为客户端观察，未适配。',
            'NFG / TFG / CFGG': '剩余/总数/当前免费计数必须显式保存；重触发不强制每帧减1。',
            'GSD.CFG': '官方客户端仅CFG=0激活Beaver Bonus；实际FID1/CFG1/NFG5仍应免费继续。源码仅CFG0判Beaver，CFG1仅在独立FID1允许；新v2核TFG=NFG+CFGG、进度及终局，旧base/free-v1映射不变。',
        })
    elif game_id == 32836:
        native.update({'family': 'quarterback-foam-v1',
            'messages': ['BET', 'FREE_GAME', 'FEATURE_START', 'FEATURE_PICK', 'FEATURE_END'],
            'continue': '普通/FID0 免费保持旧规则；独立 FID2 foam 按 START → 单次 PICK → END。PICK 使用 START 的 CFP_2+1 及 GSD.featureData 首项。',
            'complete': 'Foam 必须完整 BET/START/PICK/END。END 的计数组完整时核对 NFR_2-CFR_2 无剩余；整组 CFG/FS_2/NFR_2/CFR_2/CFP_2 缺失仅在完整四帧独立链允许，不能补0，部分缺失拒绝。无后续免费/其他功能，再核对 XML、同会话、TW/B/AB 与实际下注25。',
            'bounds': '支持独立FID2和独立FID1固定Pick A Ball选择FP=0|1|1；FID1使用独立bonus3，旧映射不变。其他菜单、组合栈、免费中触发和多次选择仍待适配。Foam20已真实结算核验；失效旧113的独立替代attempt已结算。新1705独立FID1真实四帧、stake25/TW500/bonus3已全文核验。原1008明确INVALID_SESSION已私有归档，成功BET和拒绝保留；独立替代attempt已结算。20worker各10局与651条全文验收通过并转正式；这不证明其他菜单/组合分支已覆盖。'})
        native['files'] += ['service/quarterback_fields.py', 'scripts/trial/quarterback-protocol.mjs', 'collector/sg.quarterback.ts']
        native['fields'].update({
            'CFG / FS_2 / NFR_2 / CFR_2 / CFP_2': 'CFG2 为 foam；NFR 是获赠轮数，CFR 为已完成轮数，CFP 为已选次数；单看 NFR>0 不能认定 END 后仍未完成。',
            'FP': '0|CFP_2+1|GSD.featureData首项；第三项不是按钮位置，也不按最大值选择。',
            'GSD.featureData / BVAL / display': '#和~分段；featureData 来自 START，BVAL/盘面保留原文证据，公开统计仅记录存在。',
        })
    return native


REVIEW_DOCS = {
    32820: ['docs/beaver-free-observation-20260929.md', 'docs/beaver-free-integration-20260929.md', 'docs/demo-pilot-result-20260930.md', 'docs/beaver-cfg1-20260930.md'],
    32739: ['docs/demon-pair-recovery-20260929.md', 'docs/demon-nested-recovery-20260929.md', 'docs/demon-nested-rebind-20260929.md', 'docs/sg-efficiency-plan-20260929.md'],
    32651: ['docs/squid-jackpot-protocol.md'],
    32671: ['docs/natural-feature-review-32671-32736.md'],
    32736: ['docs/natural-feature-review-32671-32736.md'],
    32714: ['docs/huff-hard-hat-protocol.md', 'docs/huff-natural-free-stop-20260928.md'],
    32717: ['docs/huff-goals-client-review-20260928.md'],
    32836: ['docs/quarterback-observation-20260929.md', 'docs/quarterback-foam-protocol.md', 'docs/foam-terminal-recovery-20260929.md', 'docs/foam-session-recovery-20260929.md', 'docs/quarterback-pick-a-bonus-observation-20260929.md', 'docs/quarterback-pick-a-ball-protocol.md', 'docs/pick-bonus-recovery-20260929.md'],
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
        mentioned = set(GAME_ID_PATTERN.findall(path.read_text(encoding='utf-8-sig'))) & known
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
