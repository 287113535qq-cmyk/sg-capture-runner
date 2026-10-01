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
    elif game_id == 32636:
        native.update({'family': 'piggies-single-free-retrigger-v1',
            'continue': '独立免费 NFG>0，TFG=NFG+CFGG；每次进度加1，重触发按TFG增量核对剩余次数。',
            'complete': '官方请求与退出逻辑确认NFG0；同时必须通过完整XML、同会话、GCT未强制结束、B=AB及实际下注100校验。',
            'bounds': '历史100条中99条通过，含6条自然免费终局、3条重触发；另1条实际扣款异常拒绝。历史仅作离线证据，新trial不计入历史额度。真实试点33完整含1自然免费，34已用/66注销。PGS2/GE2已独立size2映射接入三方与capture；33旧全文不变，真实仅触发帧、十帧终局合成，尚未重新准入，不代表整款玩法覆盖或正式300000准入。'})
        native['files'] += ['service/piggies_fields.py', 'scripts/trial/piggies-protocol.mjs', 'collector/sg.piggies.ts']
    elif game_id == 32795:
        native.update({'family': 'pearl-wms-additive-free-v2', 'messages': ['Init', 'Logic', 'EndGame'],
            'start': '新会话Init核验后首Logic扣款200；后续免费Logic重复Stake200但不再扣款。',
            'continue': '旧固定8许可不变；新v2独立许可按官方授予计数累加，首次正数、后续非负，总数/逐帧进度/bonusAwarded严格匹配；1024为运行上限，不是奖表。readyForEndGame=N才继续，每响应轮换sessionID并绑定下一请求。',
            'complete': '末Logic明确readyForEndGame=Y后单次EndGame，收到完整确认且余额不变才完成；核对全XML、累计奖、各ReelSpin与金额。',
            'bounds': '累计2596完整已全文保全及结清；本轮1635新完整后首次15免费触发被旧8范围拒绝。新v2三方检查保留2596旧规范化；15及多次授予完整链仍为合成，真实15仅触发帧；旧局不续接，MaxWin/BigBet/未知分支拒绝，新v2已在独立冻结许可下完成重入，源任务36744028113正在采集；后续36744028113因网络未知请求停止，累计25392完整及自然17帧免费链已独立审计；896待写和14中断已无源结清，36753473985续采派发，原目标和许可不变。',
            'files': ['service/pearl_fields.py', 'scripts/trial/pearl-protocol.mjs', 'collector/sg.pearl.ts', 'service/pearl_retrigger_fields.py', 'scripts/trial/pearl-retrigger-protocol.mjs', 'collector/sg.pearl-retrigger.ts', 'scripts/trial/pearl-session.mjs', 'scripts/trial/pearl-worker.mjs', 'scripts/runner-v2/formal-repair-activation.mjs', 'scripts/runner-v2/paid-round-evidence.mjs', 'service/pearl_award_fields.py', 'scripts/trial/pearl-award-protocol.mjs', 'collector/sg.pearl-award.ts'],
            'fields': {'Header.sessionID': '按响应轮换，会话值私有。', 'FSInfo': '旧v1仍首次8/后续0或8；新v2独立许可按授予计数守恒，与总数、进度、bonusAwarded及完整终局共同验证。', 'BGInfo.totalWagerWin': '等于逐Logic累加totalWin。', 'Balances': '唯一CASH_BALANCE，初值-200+累计奖。', 'EndGame': '必须收到确认，不用额外Logic探测终态。'}})
    elif game_id == 32799:
        native.update({'family':'rhino-wms-free-retrigger-v1','messages':['Init','Logic','EndGame'],
            'start':'独立新会话Init核验BetMultipliers/CreditBets，首Logic实际下注40，WagerInfo固定betMultiplier1。',
            'continue':'免费总数按首次授予和后续追加守恒；进度、remainingFreeSpins、bonusAwarded及金额共同匹配，响应session轮换。',
            'complete':'最后免费lastFreeSpin=Y且计数清零后发送一次EndGame，确认余额和完整XML才完成；普通局也需EndGame。',
            'bounds':'接线和本机独立检查通过，100历史响应含自然8+5链；其他计数完整链合成。历史只作离线证据，目标不抵扣。未知BonusGuarantee/MaxWin拒绝，1024为运行上限。固定native范围已部署，尚无新profile/线上准入。',
            'files':['scripts/trial/rhino-protocol.mjs','scripts/trial/rhino-session.mjs','scripts/trial/rhino-worker.mjs','service/rhino_fields.py','collector/rhino-review.cjs','collector/sg.rhino.ts'],
            'fields':{'WagerInfo':'betMultiplier1；响应creditBet40、waysCount4096。','Feature1':'FreeSpins计数与进度守恒；不按固定8或5循环。','Feature2':'WildInfo只在免费中接受已审倍数2/3及唯一位置。','BaseGameRecoveryInfo':'可选的首局引用，必须与首局属性及ReelResults相同。','EndGame':'完整确认之前不计完成。'}})
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
        native.update({'family': 'huff-hard-hat-and-touchup-cash-v1',
            'continue': 'NFG>0，或 FID 首槽0且 GSD.MMBG=1、MMW无结果时继续 FREE_GAME；重触发不固定循环次数。',
            'complete': '无下一步，HardHat 必须有 HARDHAT 免费响应；组合还需 MMANSION 响应；再核对金额。MMBG=1 且已有 MMW、NFG=0 不额外续局。',
            'bounds': '仅支持 FID0/1 及两槽组合、FEAT MMANSION/HARDHAT；另支持MMANSION单次授予6次TouchUp的严格现金链（FID2/PAINT）；TouchUp混合/重触发、负FRAMEWINS及组合后续仍拒绝。另新增独立FID1 HardHat重触发v2，重复PCFID限1|1并匹配CFFGT与总数/进度/剩余；原129全文不变，真实3帧未结束、终局仅合成，新重入尚未准入。TouchUp自然终局尚未观察。FID清零不等于新触发。'})
        native['files'] += ['service/huff_fields.py', 'service/huff_feature_review.py', 'scripts/trial/huff-protocol.mjs', 'service/huff_touchup_review.py', 'scripts/trial/huff-touchup-review.mjs', 'collector/sg.huff-touchup.ts', 'service/huff_retrigger_review.py', 'scripts/trial/huff-retrigger-review.mjs', 'collector/huff-retrigger-review.cjs', 'collector/sg.huff-retrigger.ts']
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
            'bounds': '新会话试采36624576401新增60完整bonus0并全部Mongo核验，当前trial137（后续36630500660新增39完整：37bonus0/2bonus1），原100 BET预算耗尽；一条FID1免费响应的GSD.CFG=1被本方误判为嵌套，客户端两真实帧均应继续，已精确修正CFG1识别并用新v2映射独立记录；真实两帧离线next为FREE_GAME，不能计完整。该半局已留样作废且pending0，不续接。尚无真实FID1终局，混合/10/11/20/21及中途切FID1仍拒绝，不能标ready。'})
        native['files'] += ['service/beaver_fields.py', 'scripts/trial/beaver-protocol.mjs', 'collector/sg.beaver.ts']
        native['fields'].update({
            'FID': '1=freespins，0=Beaver Bonus；10/11消除与20/21选择仅为客户端观察，未适配。',
            'NFG / TFG / CFGG': '剩余/总数/当前免费计数必须显式保存；重触发不强制每帧减1。',
            'GSD.CFG': '官方客户端仅CFG=0激活Beaver Bonus；实际FID1/CFG1/NFG5仍应免费继续。源码仅CFG0判Beaver，CFG1仅在独立FID1允许；新v2核TFG=NFG+CFGG、进度及终局，旧base/free-v1映射不变。',
        })
    elif game_id == 32718:
        native.update({'family': 'morepuff-wheel-cash-v1',
            'continue': '首BET独立FID2为Wheel，NFG1/TFG1/CFGG0同会话续一次FREE_GAME；不是通用独立免费模板。',
            'complete': '仅轮盘现金WHSTOP 0/2/7/8/11且明确NFG0/CFGG1/TFG1，FID0或1单槽，无组合功能；再核XML、会话、B/AB、TW和实际下注2000。',
            'bounds': '真实试点38普通完整及1中断，旧53保全共91；39已用、61已注销。新增独立MegaHat单次免费映射bonus3，仅FID2→FID1|2/WHSTOP3/WHSLICE MEGAHAT→一帧FREE单槽0或1终局，严格TFG1/进度0,0,1/剩余1,1,0；新授予、重触发、FRAMEWINS及进一步功能拒绝。实际仅两帧前缀，现金和MegaHat终局均仅合成；尚未重入，不标ready/formal。'})
        native['files'] += ['service/morepuff_fields.py', 'scripts/trial/morepuff-protocol.mjs', 'collector/sg.morepuff.ts', 'service/morepuff_megahat_review.py', 'scripts/trial/morepuff-megahat-review.mjs', 'collector/sg.morepuff-megahat.ts']
        native['fields'].update({'FID / GSD.WHSTOP': '官方FID2=Wheel；WHSTOP决定现金退出或后续功能，NFG0不足单独判断。',
            'GSD.VA': '需排除同时3个13和6个14触发的组合功能；未知功能字段拒绝。',
            'NFG / CFGG': '官方映射分别Bb.Ee/Bb.Wf，不混淆剩余与进度。'})
    elif game_id == 32719:
        native.update({'family':'inca-ten-free-and-coin-v1',
            'continue':'首BET独立FID1/TFG10/NFG10/CFGG0；同PID按FREE_GAME继续，严格每帧NFG减1/CFGG加1，无重触发。',
            'complete':'第10次FREE明确NFG0/CFGG10；FGRS/CFGC若存在必须与外层相等，GCT/非零FRBAL/混合FID/未知GSD拒绝；独立核XML和下注20。',
            'bounds':'第二账号94完整保全，29已用/71已注销。CL/BGCL金币免费修复新增独立bonus3映射及三方/capture入口，94旧规范化不变；未重入，完整11帧终局仍合成。FID0 HoldNSpin、负值奖池、外部JPV与混合功能未支持；不授正式额度。'})
        native['files'] += ['service/inca_coin_review.py','scripts/trial/inca-coin-review.mjs','service/inca_free_review.py','service/inca_fields.py','scripts/trial/inca-free-review.mjs','scripts/trial/inca-protocol.mjs','collector/sg.inca.ts']
        native['fields'].update({'FID':'固定官方客户端1=FreeSpins、0=HoldNSpin；不能跨游戏照搬FID。',
            'GSD.FGRS / CFGC':'独立执行官方EM/LXa验证额外剩余和进度可覆盖外层；NFG0不单独结束。'})
    elif game_id == 32721:
        native.update({'family':'pyramids-isolated-hold-and-ten-free-v1',
            'continue':'FID0独立Hold首BET6/6/0，同会话FREE_GAME；CFGG逐帧加1，TFG允许+0/+2/+4。FID1独立免费固定10次，无追加，FGRS/CFGC若存在必须与外层相等。',
            'complete':'Hold终帧priorNFG1到0且无追加，HNSTW+首BET赢奖=TW；免费终帧CFGG10/NFG0。均核XML、同会话、B=AB和下注20；NFG0不单独结束。',
            'bounds':'1262旧完整三方保全，含15自然Hold终局；160积压已实际补写、4旧半局已作废。独立试点36774221164成功100完整（99普通、1自然Hold），共1362；无新作废、额度100已用尽。后续正式计数新增296完整，共1658；首FID1触发BGCL/CL缺口已隔离，196完整待计数结清。BGCL/CL仅首BET非负三元坐标显示字段已接三方校验，拒绝重复/越界/负JP码及后续帧；未重新准入。独立10免费终局仍仅合成，混合/外部JPV/Grand/强制GCT/未知字段拒绝，不称整款玩法覆盖。'})
        native['files'] += ['service/pyramids_major_review.py','service/pyramids_hold_review.py','service/pyramids_free_review.py','service/pyramids_fields.py','scripts/trial/pyramids-hold-review.mjs','scripts/trial/pyramids-free-review.mjs','scripts/trial/pyramids-protocol.mjs','collector/sg.pyramids.ts']
        native['fields'].update({'FID':'固定官方客户端0=HoldNSpin、1=FreeSpins；独立审查后使用。',
            'GSD.HNSTW / HVA / HVABT':'Hold累计奖励与首BET赢奖相加核TW；5x3盘面拒绝Grand标记。',
            'GSD.FGRS / CFGC':'客户端剩余/进度可覆盖外层，严格相等防止提前结束。',
            'GSD.CL=-3':'已观察FREE奖金图标，独立major-v1/bonus3；仅FREE CL允许-3，首BET、BGCL及-4/-2仍拒绝。3211旧完整规范化不变，实际两帧未完成，自然major终局未观察。'})
    elif game_id == 32720:
        native.update({'family': 'jinzita-standalone-free-v1',
            'continue': '首BET独立FID1且NFG>0时按同会话FREE_GAME；TFG=NFG+CFGG且CFGG逐帧加1，允许TFG增加的重触发。旧普通及独立FID0规则保留。',
            'complete': '上一帧NFG1到明确NFG0且TFG不变；GSD.FGRS/CFGC若存在必须与外层NFG/CFGG一致，GCT强制结束拒绝。再核XML、会话、B/AB、TW与实际下注20。',
            'bounds': '旧320完整已由GitHub导入并补写6，2旧半局留样作废；新增95普通全Mongo，当前415 Python/Runner/TS及代际审核通过。19分片各5，第18分片源0；已关闭试点，95实际已用加5明确注销，不能重跑。无新FID1终局，终局/重触发仍仅合成；混合/嵌套拒绝，不标ready。'})
        native['files'] += ['service/jinzita_fields.py', 'scripts/trial/jinzita-protocol.mjs', 'collector/sg.jinzita.ts']
        native['fields'].update({'FID': '1=FreeSpins，0=HoldNSpin；新适配仅首BET独立1。',
            'GSD.FGRS / CFGC': '客户端免费剩余和进度可由这两个内层字段驱动；独立路径要求与外层计数一致，不能只看NFG0。',
            'GCT': '客户端强制结束会影响请求出口，未确认时拒绝而不猜测完整。'})
    elif game_id == 32835:
        native.update({'family': 'luxor-standalone-free-v1',
            'continue': '首BET独立FID2且NFG>0时FREE_GAME；完整链保持单FID2，显式TFG=NFG+CFGG且逐帧CFGG加1，允许TFG增加的重触发。旧普通及独立FID0原规则保留。',
            'complete': 'FID2完整链至少一帧FREE_GAME，上一帧NFG1到明确NFG0且总次数不变，再核XML、会话、B/AB、TW及实际下注100；NFG0但FID转0/1/10/11不能直接视为结束。',
            'bounds': '真实旧82保留并已补写Mongo，旧FID2半局私有留样作废。独立新代际实采100完整（98普通+2旧FID0），当前182 Python/Runner/TS及代际审计一致，额度0且pending0。FID2终局和重触发仍仅合成，无真实FID2终局，不标ready。'})
        native['files'] += ['service/luxor_fields.py', 'scripts/trial/luxor-protocol.mjs', 'collector/sg.luxor.ts']
        native['fields'].update({'FID': '2免费、0wild respin、1pyramid respin、10/11cascade；新增只首BET独立2，混合或切换仍停该游戏。',
            'NFG / TFG / CFGG': '独立2必须显式提供剩余/总数/当前进度，缺失不沿用客户端补0默认。',
            'GSD.FID / CFG': '独立2仅接受内层FID缺失或[]；未知CFG拒绝。动画字段保留，不当作源请求指令。'})
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
    32835: ['docs/luxor-free-integration-20260930.md'],
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
