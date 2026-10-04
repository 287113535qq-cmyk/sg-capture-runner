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
    elif game_id in (32588,32666):
        native.update({'family':'nextgen-zero-abpm-base-v1','messages':['BET'],
            'start':'固定本游戏的sourceKey、runtimeGameId、请求模板及下注金额；响应ABPM必须精确为0。',
            'continue':'当前只接受一个普通BET响应，不批准FREE_GAME、选择或其他奖励续局。',
            'complete':'逐帧XML与响应全文一致，IFG0、NFG缺失或0、普通FID；B=AB=初始余额-固定下注+TW且观察余额一致。',
            'bounds':'新增离线候选：两款200条历史中197普通完整记录经实际JS codec与Python record/verify一致；两条异常扣款及一条未审查免费局仍拒绝。尚未安装新增scope、运行新Linux或通过两次真实canary。其他来源仍拒绝ABPM，非0模式、未知FID、FS/NFR/CFG和半局一律拒绝。',
            'files':['scripts/runner-v2/ag-rolling/sg-zero-abpm.mjs','scripts/runner-v2/ag-rolling/sg-nextgen-codec.mjs',
                     'service/zero_abpm_fields.py','service/native_nextgen_fields.py','config/ag-rolling-zero-abpm-contracts.json']})
    elif game_id == 32636:
        native.update({'family': 'piggies-single-free-retrigger-v1',
            'continue': '独立免费 NFG>0，TFG=NFG+CFGG；每次进度加1，重触发按TFG增量核对剩余次数。',
            'complete': '官方请求与退出逻辑确认NFG0；同时必须通过完整XML、同会话、GCT未强制结束、B=AB及实际下注100校验。',
            'bounds': '历史100条中99条通过，含6条自然免费终局、3条重触发；另1条实际扣款异常拒绝。历史仅作离线证据，新trial不计入历史额度。真实试点33完整含1自然免费，34已用/66注销。PGS2/GE2已独立size2映射接入三方与capture；33旧全文不变，真实仅触发帧、十帧终局合成，尚未重新准入，不代表整款玩法覆盖或正式300000准入。'})
        native['files'] += ['service/piggies_fields.py', 'scripts/trial/piggies-protocol.mjs', 'collector/sg.piggies.ts']
    elif game_id == 32474:
        native.update({'family':'nextgen-carnival-pick-evidence-v3','messages':['BET','FEATURE_START','FEATURE_PICK'],
            'start':'普通BET沿原完整校验；CFG1触发与START两种已审查形状仍经过原v1/v2证据门。旧raw保留原marker和原停止语义。',
            'continue':'77份新匿名自身前缀中，首PICK position0有23份、position1有54份；只各自完整或全无NFG计数两种精确keyset，36份无NFG形状要求FID1|。CFP/CFR1、FPM实际首位置、FTV及金额逐帧独立双验后，排除已选位置并请求第二PICK。只有13份已观察顺序0→1的第二响应、CFP/CFR2与FPM0;1;|允许第三PICK1|3|position，排除0/1。',
            'complete':'第三PICK响应和其他未审查第二响应必须停止封存；没有FEATURE_END或FREE_GAME许可，显式奖励完整信用仍为0。普通完整记录继续逐局双验、任务全文回读及300000原生验收。',
            'bounds':'v3仅本地新版本，未在线应用；当前受检v2已经发布且采集中。77份自身closed前缀244条已有请求、1065条真实前端候选constructor与独立JS/Python actual codec IPC一致；100份原普通完整字段与各自原raw形式record哈希不变。原v1/v2 policy与JS/Python字节保持，77份新失败及48份历史半局不续、不重放、不回计；三层manifest转发和mandatory wiringEvidence全文hash必须通过。新版本须等待当前双仓完整ended、精确Linux/sealed后才可新不可变接续。',
            'files':['scripts/runner-v2/ag-rolling/sg-carnival-pick.mjs','service/carnival_pick_fields.py',
                     'config/ag-rolling-carnival-pick-contracts.json','scripts/runner-v2/ag-rolling/sg-explicit-continuation.mjs',
                     'service/explicit_request_continuation.py','scripts/runner-v2/ag-rolling/sg-nextgen-codec.mjs',
                     'service/native_nextgen_fields.py','scripts/runner-v2/record_fields.py','scripts/runner-v2/ag-rolling/sg-resume-manifest.mjs'],
            'fields':{'CFG / FTV_1':'固定CFG1；FTV必须自身首BET原值，maxPicks大于已完成PICK数；不猜奖励或终局。',
                      'NFG / FID':'首次有计数要求NFG/TFG/FGT3、FID1|0|；无计数必须完整固定keyset和FID1|。第二已观察响应仅有计数形状。',
                      'CFP_1 / CFR_1 / FPM_1':'计数1/2和实际已选位置全文一致；第二响应只已观察0→1，不把任意顺序当已批准。',
                      'B / AB / TW':'每帧B=初始余额-108+首BET的TW；两次PICK奖额没有增长，观察AB等于held或含奖余额。',
                      'PID / SID / XML':'请求PID与响应SID分别固定；新PICK XML只OGS_RC0/SUCCESStrue/PAYLOAD且全文一致。',
                      '终局':'新特殊终局许可仍为0；旧failed/half不续跑或回计。'}})
    elif game_id == 32497:
        native.update({'family':'nextgen-dragon-end-evidence-v3','messages':['BET','FEATURE_START','FEATURE_PICK','FEATURE_END'],
            'start':'普通BET沿原完整校验；CFG0触发和START的原v1/v2自身证据门保持。7份不满足原PD门的START仍拒绝。',
            'continue':'88份自身closed前缀257条已有请求中，81份首PICK固定FP0|1|1及精确FID0|、FS_0=1、CFP/CFR1、FPM1;|、TFW0、NFR1、7种自身PD数值形状。原前端ZYa将CFP_0映射G7并设置Eu，gP据此选择FEATURE_END，SPa只发CFG0且无FP；与独立JS/Python和实际codec IPC一致。',
            'complete':'首END的新响应必须停止封存；没有特殊终局验收许可，不发第二END、FREE_GAME或下一BET，不续旧半局。普通完整记录继续每局双验、任务全文回读与300000整款验收。',
            'bounds':'v3仅本地，未在线应用；当前受检v2已发布且采集中。88份前缀、257条已有请求及81条候选END经真实前端和独立codec/Python核验；99份原普通完整raw与record哈希保持。旧v2的88份停止语义、7份START拒绝及原v1/v2 policy和运行字节不变。首END未知ACK单次封存不重发，特殊终局信用0。mandatory wiringEvidence和原→v1→v2→v3不可变接续必须通过，未来须双仓完整ended后新精确Linux/sealed才可发布。',
            'files':['scripts/runner-v2/ag-rolling/sg-dragon-end.mjs','service/dragon_end_fields.py','config/ag-rolling-dragon-end-contracts.json',
                     'scripts/runner-v2/ag-rolling/sg-explicit-dragon.mjs','service/explicit_request_dragon.py',
                     'scripts/runner-v2/ag-rolling/sg-nextgen-codec.mjs','service/native_nextgen_fields.py',
                     'scripts/runner-v2/record_fields.py','scripts/runner-v2/ag-rolling/sg-resume-manifest.mjs'],
            'fields':{'FID / FS_0 / CFP_0':'原前端分别映射xO/m8/G7；CFP_0=1设置Eu并选END，不把NFR当END判据。',
                      'PD':'只自身已观察7种keyset、数值编码长度和scalar集合；不由lives/cashSymbols猜奖励或终局。',
                      'B / AB / TW':'每帧B=初始-100+自身BET的TW；PICK中TW不变，观察AB等于held或含奖余额。',
                      'PID / SID / XML':'请求PID与响应SID分别固定；PICK只有OGS_RC0/SUCCESStrue/PAYLOAD三节点及全文一致。',
                      '终局':'END响应未观察，特殊终局许可0；旧failed/half不续、不重放、不回计。'}})
    elif game_id == 32595:
        native.update({'family':'nextgen-moneyraid-terminal-evidence-v2','messages':['BET','FREE_GAME'],
            'start':'固定本游戏runtime33066、moneyraidwapiti96、下注200及原请求模板；新raw同时保留原v1和v2 marker。',
            'continue':'自身104份自然闭合证据中，FID2初始7次，FID3初始9/10/11/12次；NFG每帧减1、TFG固定、CFGG逐帧加1、FID不变。其他初始次数、重触发、显式选择或未知字段拒绝。',
            'complete':'只在自身完整路径NFG0、每帧TW/CW/FGTW及现金、请求PID/响应SID、成功XML独立JS/Python一致后批准FID2/3自然终局；请求PID与响应SID分别固定。普通与FID1沿原v1规则。',
            'bounds':'仅本地v2，未在线应用。91份FID2及13份FID3共872条自身请求通过实际codec/Python IPC/record/verify；原97份accepted普通及99份v1完整记录字段/hash保留，1份bet0余额刷新仍拒绝。旧v1 marker的FID2/3终局仍拒绝，104份旧失败局不续跑、不重放、不回计。新窗口须精确Linux与证据绑定的逐层manifest转发，并完整复核旧prefix。',
            'files':['scripts/runner-v2/ag-rolling/sg-automatic-terminal.mjs','scripts/runner-v2/ag-rolling/sg-automatic-free.mjs',
                     'scripts/runner-v2/ag-rolling/sg-nextgen-codec.mjs','service/automatic_terminal_fields.py',
                     'service/automatic_free_fields.py','service/native_nextgen_fields.py','config/ag-rolling-automatic-terminal-contracts.json'],
            'fields':{'NFG / TFG / CFGG':'仅自身已观察初始次数，逐帧递减与累计次数一致；没有重触发许可。',
                      'TW / CW / FGTW':'累计奖、逐帧增量和免费累计奖分别核验，不重复加奖。',
                      'B / AB':'B=初始余额-200+TW；AB为扣款余额或终帧含奖余额，观察余额等于AB。',
                      'PID / SID':'请求PID与响应SID各自在一大局内稳定，二者不是同一个标识。'}})
    elif game_id == 32749:
        native.update({'family':'five-treasures-wms-v1','messages':['Init','Logic','FreeSpinChoice','EndGame'],
            'start':'目录runtimeGameId32971与WMS Header.gameID20442分别固定；匿名新会话Init独立核验，首Logic固定Stake176和PaylineCount1。',
            'continue':'免费触发后沿原AG选择回调均衡5个选项，pickIndex1..5对应WMS FreeSpinChoice0..4；选择请求本身是Logic XML并执行第一免费帧，后续5次Logic。逐响应sessionID绑定下一请求。',
            'complete':'第6免费帧后readyForEndGame=Y，随后唯一EndGame确认；普通局同样必须EndGame。逐帧现金、累积奖、ReelSpin及独立Jackpot奖双验才完整。',
            'bounds':'1000历史完整局995普通5免费通过JS/Python。当前受检0ff版本已有native scope；本游戏两次真实canary各10局已原生全文核验，另外2份自身实际Init及20完整canary沿实际codec/Python record/verify再次独立读回一致。另在worker1/2序号501..1500的1000条有界暂存样本中，选取3份真实完整免费局和2份Jackpot局，28条自身durable source请求及原record全文双验一致。未审查任务完整关闭或worker所有会话链，不代表整款完成或全部WMS族覆盖。额外奖励、重触发、恢复与未知节点拒绝，历史局不计入目标。',
            'files':['scripts/runner-v2/ag-rolling/sg-five-treasures.mjs','scripts/runner-v2/ag-rolling/sg-five-source.mjs',
                     'scripts/runner-v2/ag-rolling/sg-five-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs',
                     'scripts/runner-v2/ag-rolling/sg-protocol-session.mjs','service/five_treasures_fields.py',
                     'service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'Header':'WMS20442/version1_0/demo Y；session值私有且逐帧轮换。','FSInfo':'固定本游戏已证实6帧，freeSpinNumber逐帧推进；extraSpinsAwarded必须0。',
                      'Stake / cash':'首帧实际176；后续报告stake176不重复扣款。','JackpotInfo':'index0奖独立于totalSpinWin，二者之和等于totalWin。','EndGame':'完整确认与现金保持是完成前置条件。'}})
    elif game_id == 32750:
        native.update({'family':'eighty-fortunes-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'本游戏runtime32972与WMS Header20077分别固定；新匿名Init仅接受已限定能力shape且Stakes含176，真实Init尚未观察。首Logic使用SpinInfo creditBet88和betMultiplier2，实际扣款176。',
            'continue':'自身免费触发授予10帧，继续Header-only Logic；remaining逐帧递减、extra0、last仅末帧Y。触发奖在首个免费续帧才兑现一次，首局cash不含该奖。BaseGameRecoveryInfo只原首局ReelResults引用，不再加奖。自身Jackpot只接受已观察3种pickLength/金额/type组合，没有客户端选择请求。',
            'complete':'普通及固定Jackpot须唯一EndGame确认且现金保持。免费只有trigger880的真实完整终局获证明；trigger1760可核验已观察触发prefix，但终局仍拒绝，不允许END或信用。逐Logic奖、独立Jackpot、累计奖、每帧cash与会话独立JS/Python双验。',
            'bounds':'仅离线候选，未进当前81队列、无native scope或真实Init/canary。1000自身历史中992普通和4Jackpot完整保留，4份旧免费半局仍拒绝；另1份真实12帧完整probe通过，总997完整及2004请求路径在实际codec/Python IPC/record/verify一致。旧probe标签漏计880，按原raw现金证据累计5930；原raw和旧标签不修改，历史不抵扣新目标。其他trigger、Jackpot形状、额外免费、重触发、恢复、MaxWin、未知节点严格拒绝；不代表全部特殊玩法覆盖。',
            'files':['scripts/runner-v2/ag-rolling/sg-eighty-fortunes.mjs','scripts/runner-v2/ag-rolling/sg-eighty-source.mjs',
                     'scripts/runner-v2/ag-rolling/sg-eighty-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs',
                     'service/eighty_fortunes_fields.py','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'Header':'20077/version1_0、isRecovering=N；响应session逐帧绑定，实际值私有。',
                      'SpinInfo':'88乘2实际176；免费续帧仅Header，不再次扣款。',
                      'FreeGame':'初始10、extra0；trigger880延后首续帧兑现一次，trigger1760缺完整终局仍拒绝。',
                      'GameWinInfo / cash':'累计Logic奖加trigger；首帧只兑现Logic奖，后续cash与累计兑现奖一致。',
                      'Jackpot':'独立奖与reel奖之和等于totalWin，不重复计奖、不发猜测pick。',
                      'EndGame':'仅已证明终态允许唯一确认，无确认或未知终态不能计完整。'}})
    elif game_id == 32751:
        native.update({'family':'fortunes-megaways-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtimeGameId32973与WMS Header.gameID20371分别固定；匿名新会话Init核验后首Logic固定Stake16、gameMode0、PaylineCount1和CurrencyMultiplier1。',
            'continue':'本游戏已观察PickerInfo0对应10免费、起始级联倍数6；PickerInfo1对应12免费、起始倍数4。没有客户端选择请求，继续自动Logic；逐帧freeSpinNumber递增，后续extraSpinsAwarded必须0。响应sessionID独立核验后绑定下一请求。',
            'complete':'末Logic readyForEndGame=Y后唯一EndGame确认且余额保持才完整。每次Logic totalWin等于自身全部级联ReelSpin奖之和，不能再次加BaseGameRecoveryInfo里的旧首局奖；累计赢分和现金逐帧一致。',
            'bounds':'离线候选：完整历史文件SHA及1000局996普通4免费在实际codec/Python IPC/record/verify全通过，2042条请求路由匹配。尚无native scope、Linux或真实Init/canary。只接受已观察10/12免费和1..5级联；重触发、额外奖励、其他picker、gameMode、MaxWin或未知节点严格拒绝。原始历史不抵扣300000目标。',
            'files':['scripts/runner-v2/ag-rolling/sg-fortunes-megaways.mjs','scripts/runner-v2/ag-rolling/sg-fortunes-source.mjs',
                     'scripts/runner-v2/ag-rolling/sg-fortunes-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs',
                     'service/fortunes_megaways_fields.py','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'Header':'WMS20371/version1_0/demo Y；响应session逐帧绑定，不公开实际值。',
                      'FSInfo':'只已观察Picker0的10帧、Picker1的12帧；总数保持、进度递增、额外授予0。',
                      'ReelResults / CascadeInfo':'1..5级联，自身spinIndex顺序、奖项计数、奖额之和与totalWin一致；免费prev倍数等于上帧cur，cur增量等于本帧级联次数-1。',
                      'BGInfo / Balances':'首帧下注16，后续报告stake16不重复扣款；余额=初值-16+逐Logic累计奖。',
                      'BaseGameRecoveryInfo':'只首局ReelResults和TopReelInfo的原样引用，不增加任何奖。',
                      'EndGame':'完整确认、现金保持，半局不能计完整。'}})
    elif game_id == 32754:
        native.update({'family':'arthur-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32976与WMS Header20467分别绑定；仅新的匿名Init限定能力核验后，首Logic Stake.total200/PaylineCount20/CurrencyMultiplier1。',
            'continue':'仅自身普通单Logic，readyForEndGame=Y、无Wheel/FS/Excalibur/Token/WildInfo后允许唯一EndGame；不继续历史特殊局。',
            'complete':'两帧普通Logic→EndGame；EndGame ready=N且无GameResult/SymbolGrids，现金保持。每帧会话、observer现金、Payline奖额和、spinWins、totalWin及BG累计独立双验。',
            'bounds':'离线候选：自身全history SHA固定；前1000中986普通完整/1972请求沿actual codec→独立Python IPC→record/verify一致；14自身特殊路径首响应后拒绝（6免费、3Excalibur、5Wild overlay），旧raw/hash/标签保留且历史不抵扣目标。6免费末计数等于total且readyY只是未适配的有限观察；3Excalibur readyN就旧End仍拒绝，不当完整。免费extra3/5、Token feature和Wild overlay均未授权继续或结算。真实Init/在线canary/native scope未观察或安装；不在当前81队列。MaxWin、未知节点/奖表/网格、恢复和缺EndGame拒绝。',
            'files':['scripts/runner-v2/ag-rolling/sg-arthur-base.mjs','scripts/runner-v2/ag-rolling/sg-arthur-source.mjs',
                     'scripts/runner-v2/ag-rolling/sg-arthur-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs',
                     'service/arthur_base_fields.py','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'Header / Stake':'20467/version1_0/isRecoveringN；实际总下注200，请求及响应均20线/stakePerLine10；普通readyY，EndGame readyN。',
                      'ReelResults / PaylineWin':'单spin索引0/reelset0，5个ReelStops；winCountSC0/freeSpinN/bonusAwardedN；至多10个唯一线索引0..19、22种自身awardIndex、awardTableIndex0；奖额和与spinWins/Logic totalWin一致。',
                      'SymbolGrids / BGInfo':'自身3×5格、符号0..10；BG累计与普通Logic奖额相等，isMaxWin0；grid仅显示状态，不另加奖。',
                      'Wheel / FS / Excalibur / Wild':'14特殊raw完整保留，任何此节点立即拒绝，不借其他WMS游戏规则、不给End/续局/credit许可。'}})
    elif game_id == 32755:
        native.update({'family':'blazing-x-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32977与WMS Header20363分别绑定；独立匿名Init能力核验后，首Logic Stake.total240/PaylineCount40/CurrencyMultiplier1。响应stakePerLine20×40不改变实际240。',
            'continue':'普通readyY后EndGame；自身免费触发scatter480/960首帧已兑现，免费10次Header-only Logic，FS编号0→10、总数10、prevFSX沿前帧currFSX、已观察倍率状态逐帧核验。',
            'complete':'最后Logic readyY后唯一EndGame readyN、无GameResult且现金保持才完整；逐帧cash=start-240+累计Logic奖，BG累计及FS累计独立双验。BaseGameRecoveryInfo仅首局转轴引用，不再次加奖。',
            'bounds':'离线候选：自身前1000历史997普通+3完整免费，2030请求沿真实codec→独立Python IPC→record/verify一致。XInfo仅自身有限形状审查；重触发、额外免费、未知倍率或X状态、MaxWin、恢复或未知节点拒绝。真实Init/在线canary/native scope未观察或安装，不在当前81队列；旧历史不抵扣目标。',
            'files':['scripts/runner-v2/ag-rolling/sg-blazing-x.mjs','scripts/runner-v2/ag-rolling/sg-blazing-source.mjs',
                     'scripts/runner-v2/ag-rolling/sg-blazing-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs',
                     'service/blazing_x_fields.py','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'Header':'20363/version1_0/isRecoveringN；普通或免费末Logic readyY，EndGame readyN；响应会话逐帧衔接。',
                      'Stake / PaylineCount':'请求总额240、count40；response stakePerLine20和paylineCount40独立固定，不推导800总额。',
                      'ReelResults':'单spin索引0、5个ReelStops；唯一Payline索引0..39/award0..24，奖额和=spinWins。触发ScatterWin自身0奖仅标记免费，触发奖来自FS scatterPayout。',
                      'BGInfo / FSInfo':'BG总累计=Logic累计，bgWinnings保持首局奖；FS编号逐帧0..10，fsWinnings=累计减首局奖，scatterPayout480/960保持。',
                      'XInfo / BaseGameRecoveryInfo':'普通31种自身状态；免费XInfo保持自身首局，末帧仅已观察reset允许；恢复转轴必须完整等于首局，不计奖金。'}})
    elif game_id == 32753:
        native.update({'family':'actionbank-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32975与WMS Header20369分别绑定；独立匿名新Init能力核验后，首Logic Stake.total200/PaylineCount1/CurrencyMultiplier1。',
            'continue':'只普通单Logic；readyForEndGame=Y、无FSInfo且vaultCount0..3才产生EndGame。响应stakePerLine10/paylineCount20不改变请求PaylineCount1或总下注200。',
            'complete':'完整普通Logic后唯一EndGame确认，ready=N且无GameResult、现金保持；每帧会话、observer现金、奖额和及BG累计独立双验。',
            'bounds':'离线候选：前1000自身历史仅989普通完整/1978请求沿实际codec→独立Python IPC→record/verify一致。11旧免费半局ready=N、FSInfo进度0就EndGame仍拒绝，不继续、不回计，不把旧bonus0标签当完整。真实Init/在线canary/native scope未观察或安装；不在当前81队列。免费、vault4、MaxWin、未知节点/ways、恢复和缺终局一律拒绝。',
            'files':['scripts/runner-v2/ag-rolling/sg-actionbank-base.mjs','scripts/runner-v2/ag-rolling/sg-actionbank-source.mjs',
                     'scripts/runner-v2/ag-rolling/sg-actionbank-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs',
                     'service/actionbank_base_fields.py','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'Header':'20369/version1_0、isRecovering=N；普通Logic ready=Y，EndGame ready=N；响应逐帧轮换会话。',
                      'Stake / PaylineCount':'固定总额200；请求count1与响应20线分别验证，不互相替代。',
                      'ReelResults':'单spin、索引0、9个ReelStops；普通freeSpin=N/bonusAwarded=N、scatterWinCount0。',
                      'AnywayWin / BGInfo':'至多2个不重复winIndex、11种自身ways、awardIndex0..10；奖额和、totalSpinWin、totalWin与BG累计完全相等；vaultCount0..3。',
                      'FSInfo / EndGame':'11旧半局原raw/hash保留且不给End许可；新免费响应必须另行审查。'}})
    elif game_id == 32752:
        native.update({'family':'acorn-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'本游戏目录runtime32974与WMS Header20174分别固定。新匿名Init只有严格已限定能力形状且Stakes含100后，首Logic固定Stake100、lines30、fsOn1、isBuyABonus0及CurrencyMultiplier1。实际Init尚未观察；未知形状停止封存。',
            'continue':'目前仅普通单Logic；逐帧响应session经独立双验后绑定唯一EndGame请求。不能借其他WMS玩法放开免费或奖励。',
            'complete':'普通Logic的totalWin、spinWins、PaylineWin奖额之和、BGInfo累计与现金完全一致；EndGame独立确认无GameResult、现金保持才完整。stakePerLine2与30线是响应元数据，实际总下注严格为100。',
            'bounds':'只离线候选：1000自身普通完整历史在实际JS codec/Python IPC/record/verify一致，2000条请求匹配；未注册进当前81队列、无native scope或真实Init/canary。只接受9种已观察WildClusterMask与普通无bonus/free形状；FS、购买奖励、MaxWin、额外奖、未知节点或缺确认一律拒绝。全部特殊玩法覆盖仍未知，旧raw不抵扣新300000目标。',
            'files':['scripts/runner-v2/ag-rolling/sg-acorn-base.mjs','scripts/runner-v2/ag-rolling/sg-acorn-source.mjs',
                     'scripts/runner-v2/ag-rolling/sg-acorn-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs',
                     'service/acorn_base_fields.py','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'Header':'20174/version1_0、isRecovering=N；会话值私有并按响应逐帧绑定。',
                      'Stake':'首请求总额100、30线、fsOn1、buy0；响应stakePerLine2不替代总额。',
                      'ReelResults':'单spin、索引0、普通freeSpin=N/bonusAwarded=N；只9种自身WildClusterMask，5个ReelStops。',
                      'PaylineWin / BGInfo':'30条以内、不重复的0..29线索引；奖额和、spinWins、totalWin与BG累计完全一致。',
                      'EndGame':'唯一确认，余额保持；不把特殊触发或半局计完整。'}})
    elif game_id == 32795:
        native.update({'family': 'pearl-wms-additive-free-v2', 'messages': ['Init', 'Logic', 'EndGame'],
            'start': '新会话Init核验后首Logic扣款200；后续免费Logic重复Stake200但不再扣款。',
            'continue': '旧固定8许可不变；新v2独立许可按官方授予计数累加，首次正数、后续非负，总数/逐帧进度/bonusAwarded严格匹配；1024为运行上限，不是奖表。readyForEndGame=N才继续，每响应轮换sessionID并绑定下一请求。',
            'complete': '末Logic明确readyForEndGame=Y后单次EndGame，收到完整确认且余额不变才完成；核对全XML、累计奖、各ReelSpin与金额。',
            'bounds': '累计2596完整已全文保全及结清；本轮1635新完整后首次15免费触发被旧8范围拒绝。新v2三方检查保留2596旧规范化；15及多次授予完整链仍为合成，真实15仅触发帧；旧局不续接，MaxWin/BigBet/未知分支拒绝，新v2已在独立冻结许可下完成重入，源任务36744028113正在采集；后续36744028113因网络未知请求停止，累计25392完整及自然17帧免费链已独立审计；896待写和14中断已无源结清，36753473985续采派发，原目标和许可不变。',
            'files': ['service/pearl_fields.py', 'scripts/trial/pearl-protocol.mjs', 'collector/sg.pearl.ts', 'service/pearl_retrigger_fields.py', 'scripts/trial/pearl-retrigger-protocol.mjs', 'collector/sg.pearl-retrigger.ts', 'scripts/trial/pearl-session.mjs', 'scripts/trial/pearl-worker.mjs', 'scripts/runner-v2/formal-repair-activation.mjs', 'scripts/runner-v2/paid-round-evidence.mjs', 'service/pearl_award_fields.py', 'scripts/trial/pearl-award-protocol.mjs', 'collector/sg.pearl-award.ts'],
            'fields': {'Header.sessionID': '按响应轮换，会话值私有。', 'FSInfo': '旧v1仍首次8/后续0或8；新v2独立许可按授予计数守恒，与总数、进度、bonusAwarded及完整终局共同验证。', 'BGInfo.totalWagerWin': '等于逐Logic累加totalWin。', 'Balances': '唯一CASH_BALANCE，初值-200+累计奖。', 'EndGame': '必须收到确认，不用额外Logic探测终态。'}})
    elif game_id == 32812:
        native.update({'family':'veryfruity-wms-action-v1','messages':['Init','Logic','EndGame'],
            'start':'独立新会话Init核固定游戏身份、Stake总额20及20条Payline；首Logic perLine1、paylines20实际下注20。',
            'continue':'按官方选中GLS引擎的动作出口：普通Logic转EndGame；FSInfo按freeSpinNumber/freeSpinsTotal继续Logic，进度到总数转EndGame。响应sessionID绑定下一请求。',
            'complete':'EndGame完整确认且余额保持、完整原文、身份、逐Logic累计赢分及实际扣款独立核验后才完成。玩法bonus为null/classification pending，不影响已验证流程与金额。',
            'bounds':'mysterySymbol用于符号显示、空betID为元数据，均不单独阻断流程。未知动作、MaxWin出口、错误身份/计数/金额或未确认EndGame仍拒绝。实际第三试点只保存一帧Logic、0完整；未续接旧局，源关闭，四线尚未完整验收。',
            'files':['service/veryfruity_action_fields.py','service/veryfruity_action_review.py','service/veryfruity_settlement_review.py','scripts/trial/veryfruity-action-protocol.mjs','scripts/trial/veryfruity-action-review.mjs','scripts/trial/veryfruity-settlement-review.mjs','scripts/trial/veryfruity-session.mjs','scripts/trial/veryfruity-worker.mjs','collector/sg.veryfruity-action.ts','scripts/runner-v2/record_fields.py'],
            'fields':{'Header':'固定游戏/版本/币种/语言；响应轮换sessionID。','Stake / GameResult':'perLine1、20条Payline、total stake20；betID不决定金额。','FSInfo':'总数与逐帧进度守恒，不依赖固定玩法次数。','Balances':'初值-20+累计奖，EndGame确认余额不变。','mysterySymbol':'展示数据原样保留；玩法分类独立处理。'}})
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
            'bounds': '仅支持 FID0/1 及两槽组合、FEAT MMANSION/HARDHAT；另支持MMANSION单次授予6次TouchUp的严格现金链（FID2/PAINT）；TouchUp混合/重触发、负FRAMEWINS及组合后续仍拒绝。另新增独立FID1 HardHat重触发v2，PCFID保留最多100个纯HardHat有序历史槽位，可重复，不推断授奖；追加由公共计数方法核CFFGT和总数/进度/剩余。功能未结束时累计余额与可用余额分别核验，终局全额到账。原规范化保留，最新真实3帧未结束、终局仅合成，公共修正待独立重新准入。TouchUp自然终局尚未观察。FID清零不等于新触发。'})
        native['files'] += ['service/huff_fields.py', 'service/huff_feature_review.py', 'scripts/trial/huff-protocol.mjs', 'service/huff_touchup_review.py', 'scripts/trial/huff-touchup-review.mjs', 'collector/sg.huff-touchup.ts', 'service/huff_retrigger_review.py', 'scripts/trial/huff-retrigger-review.mjs', 'collector/huff-retrigger-review.cjs', 'collector/sg.huff-retrigger.ts', 'service/free_game_counters.py', 'scripts/trial/free-game-counters.mjs', 'collector/free-game-counters.cjs', 'service/feature_state.py', 'scripts/trial/feature-state.mjs', 'collector/feature-state.cjs', 'service/huff_action_fields.py', 'scripts/trial/huff-action-contract.mjs', 'scripts/trial/huff-action-protocol.mjs', 'collector/sg.huff-action.ts']
        native['bounds'] += ' 独立huff-action-v1按官方已知FID0–4动作推进，玩法分类pending/null；未知请求、组合退出及-100继续哨兵仍拒绝。原base入口的FID3调用相同动作/资金验证，raw不改写；其他历史分支及旧normalized哈希不变。FID3真实前缀可离线核验，完整HOMEIMP终局为合成向量；新实现仍需重新准备和准入，不改旧已应用profile。'
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
        native['files'] += ['service/pyramids_major_plan.py','scripts/runner-v2/pyramids-major-repair-profile.mjs','scripts/runner-v2/pyramids-major-retirement.mjs','service/pyramids_major_review.py','service/pyramids_hold_review.py','service/pyramids_free_review.py','service/pyramids_fields.py','scripts/trial/pyramids-hold-review.mjs','scripts/trial/pyramids-free-review.mjs','scripts/trial/pyramids-protocol.mjs','collector/sg.pyramids.ts']
        native['fields'].update({'FID':'固定官方客户端0=HoldNSpin、1=FreeSpins；独立审查后使用。',
            'GSD.HNSTW / HVA / HVABT':'Hold累计奖励与首BET赢奖相加核TW；5x3盘面拒绝Grand标记。',
            'GSD.FGRS / CFGC':'客户端剩余/进度可覆盖外层，严格相等防止提前结束。',
            'GSD.CL=-3':'已观察FREE奖金图标，独立major-v1/bonus3；仅FREE CL允许-3，首BET、BGCL及-4/-2仍拒绝。3211旧完整规范化不变，实际两帧未完成，自然major终局未观察。'})
        native['files'] += ['service/pyramids_mixed_prefix.py','service/pyramids_mixed_review.py','scripts/trial/pyramids-mixed-prefix.mjs','scripts/trial/pyramids-mixed-review.mjs','collector/sg.pyramids-mixed.ts','service/pyramids_mixed_plan.py','scripts/runner-v2/pyramids-mixed-repair-profile.mjs']
        native['bounds'] += ' 混合功能重新准入v4准备保留3627完整、原目标剩余296223，采用有界增量CAS；真实全文在内存重入通过，线上未应用。已完成Rhino的精确终审凭证可释放同级队列阻塞，仍核零租约和固定源身份。'
        native['fields']['GSD.FGTS / FGRS / CFGC'] = 'free-hold-v1/bonus4独立混合入口：外层免费10次，进入Hold时内层6/6/0，内层期间外层冻结，Hold累计奖励核TW后恢复外层。实际8帧仅前缀，17/19/21帧终局为合成；不授额度、不续旧会话、未重入。'
        native['files'] += ['service/pyramids_coin_review.py','scripts/trial/pyramids-coin-review.mjs','collector/sg.pyramids-coins.ts']
        native['fields']['GSD.CL=-3'] = '旧major-v1/bonus3标识保留，官方-3实际为Minor；旧作用域不变。新cash-coins-v1/bonus9支持首FID1/TFG10、FREE CL中-4/-3/-2即Mini/Minor/Major及已审+10重触发；首BET/BGCL负值和Grand-1仍拒绝。'
        native['fields']['B / AB / responseBalance'] = 'cash-coins-v1逐帧B=start-20+累计TW；未结算AB及账户responseBalance=start-20，现金终局AB=B。不由显示金币因子推算TW。'
        native['bounds'] += ' 最新7503完整已实际结清、原15帧作废不重放；新金币三方接线及17Python/11Runner相关检查通过，1716最近完整规范化不变。15真实前缀仍未完成，金币终局为合成；尚无新准入，不称整款ready或效率验收完成。'
        native['files'] += ['service/pyramids_action_fields.py','service/pyramids_action_plan.py','service/pyramids_flow_review.py','scripts/trial/pyramids-action-protocol.mjs','scripts/trial/pyramids-flow-review.mjs','collector/sg.pyramids-action.ts','scripts/runner-v2/round-analysis-journal.mjs','scripts/runner-v2/pyramids-action-analysis.mjs','scripts/runner-v2/pyramids-action-repair-profile.mjs']
        native['actionChannel'] = {'version':'pyramids-action-v1','actions':['BET','FREE_GAME'],
            'capture':'请求身份、XML、已知动作计数和金额完整核验后保存全文证据；陌生展示字段不要求先分类。',
            'classification':'新证据 bonus=null/classificationStatus=pending；独立全文读回后写不可变分析journal，不改原记录或额度。',
            'bounds':'独立新profile才可准入；未知请求、未知FID、终局证据缺失或金额错误仍拒绝。离线入口已验证，线上采用未验收，不代表全部玩法或全部游戏通用准入。'}
        native['bounds'] += ' 最新关闭已保留16913完整、1122积压实际全文补齐、3中断作废；新动作通道正式准入内存回放通过，保留旧规范化与批次，剩余282937。未派新源。'
    elif game_id == 32720:
        native.update({'family': 'jinzita-standalone-free-v1',
            'continue': '首BET独立FID1且NFG>0时按同会话FREE_GAME；TFG=NFG+CFGG且CFGG逐帧加1，允许TFG增加的重触发。旧普通及独立FID0规则保留。',
            'complete': '上一帧NFG1到明确NFG0且TFG不变；GSD.FGRS/CFGC若存在必须与外层NFG/CFGG一致，GCT强制结束拒绝。再核XML、会话、B/AB、TW与实际下注20。',
            'bounds': '旧320完整已由GitHub导入并补写6，2旧半局留样作废；新增95普通全Mongo，当前415 Python/Runner/TS及代际审核通过。19分片各5，第18分片源0；已关闭试点，95实际已用加5明确注销，不能重跑。无新FID1终局，终局/重触发仍仅合成；混合/嵌套拒绝，不标ready。'})
        native['files'] += ['service/jinzita_fields.py', 'scripts/trial/jinzita-protocol.mjs', 'collector/sg.jinzita.ts', 'service/free_game_counters.py', 'scripts/trial/free-game-counters.mjs', 'collector/free-game-counters.cjs']
        native['fields'].update({'FID': '1=FreeSpins，0=HoldNSpin；新适配仅首BET独立1。',
            'GSD.FGRS / CFGC': '客户端免费剩余和进度可由这两个内层字段驱动；独立路径要求与外层计数一致，不能只看NFG0。',
            'GCT': '客户端强制结束会影响请求出口，未确认时拒绝而不猜测完整。'})
    elif game_id == 32835:
        native.update({'family': 'luxor-standalone-free-v1',
            'continue': '首BET独立FID2且NFG>0时FREE_GAME；完整链保持单FID2，显式TFG=NFG+CFGG且逐帧CFGG加1，允许TFG增加的重触发。旧普通及独立FID0原规则保留。',
            'complete': 'FID2完整链至少一帧FREE_GAME，上一帧NFG1到明确NFG0且总次数不变，再核XML、会话、B/AB、TW及实际下注100；NFG0但FID转0/1/10/11不能直接视为结束。',
            'bounds': '真实旧82保留并已补写Mongo，旧FID2半局私有留样作废。独立新代际实采100完整（98普通+2旧FID0），当前182 Python/Runner/TS及代际审计一致，额度0且pending0。FID2终局和重触发仍仅合成，无真实FID2终局，不标ready。'})
        native['files'] += ['service/luxor_fields.py', 'scripts/trial/luxor-protocol.mjs', 'collector/sg.luxor.ts', 'service/free_game_counters.py', 'scripts/trial/free-game-counters.mjs', 'collector/free-game-counters.cjs']
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
    rolling = json.loads((root / 'config/ag-rolling-plans.json').read_text(encoding='utf-8'))['plans']
    for key in ('32749','32750','32751','32752','32753','32754','32755'):
        # These specific WMS adapters have their own documented boundary.
        # A card grants no source permission or live admission.
        if key in rolling:
            plans[key] = rolling[key]
    for key in ('32588','32666'):
        if key in rolling and rolling[key].get('zeroAbpmContract')=='nextgen-zero-abpm-base-v1':
            plans[key]=rolling[key]  # A documented offline boundary grants no source permission.
    if rolling.get('32595',{}).get('automaticTerminalContract')=='nextgen-moneyraid-terminal-evidence-v2':
        plans['32595']=rolling['32595']
    if rolling.get('32474',{}).get('carnivalPickContract')=='nextgen-carnival-pick-evidence-v3':
        plans['32474']=rolling['32474']
    if rolling.get('32497',{}).get('dragonEndContract')=='nextgen-dragon-end-evidence-v3':
        plans['32497']=rolling['32497']
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
        if gid==32754 and plan and plan.get('arthurFeatureContract')=='wms-arthur-free-wild-evidence-v2':
            rule={**rule,'family':'wms-arthur-free-wild-evidence-v2',
                'continue':'新匿名 v2 marker：自身 Wheel index5/1/6/3→免费8/10/12/5；Header-only Logic，编号逐帧推进，extra仅3/5且总数≤20。47自身Token joint转移及倍率1/3/5独立核验；未知状态停止。Wild只自身5种15格overlay，不另计奖。',
                'complete':'免费编号等于动态total且readyY后唯一EndGame readyN/noresult/现金保持；末activeFeature可仍1。普通、免费、Wild分别归类，每帧奖额和、BG/FS累计和资金双验；恢复转轴只是首帧引用。',
                'bounds':'本地 versioned v2，未在线应用：986普通/1972请求旧raw-record哈希一致；6免费+5Wild合计97自身历史帧，997完整/2069请求沿actual codec→独立Python IPC→record→verify通过，mandatory wiringEvidence。原前端EndGame constructor隔离执行11次（对象构造，未执行XML serializer）。旧unmarked/v1的14自身特殊仍拒绝；3Excalibur早End不续。extra3/5、Token及特殊符号0..13/至多11线只限本v2；普通仍符号0..10/最多10线。真实Init/在线canary/native scope未观察或安装，不在当前81队列；历史不抵300000目标。',
                'files':rule['files']+['scripts/runner-v2/ag-rolling/sg-arthur-feature.mjs','scripts/runner-v2/ag-rolling/sg-arthur-feature-codec.mjs','scripts/runner-v2/ag-rolling/sg-arthur-feature-source.mjs','service/arthur_feature_fields.py','config/ag-rolling-arthur-feature-contracts.json'],
                'fields':{**rule['fields'],'Versioned Free / Wild':'原v1普通字节和type profile保持；v2 Free bonus1/freeGame，Wild bonus0/none保持自身旧标签。',
                    'Token / FSInfo':'每帧prev/new chain，自己的47种joint状态；38种倍率/awardIndex/winVal联合tuple，奖值已含倍率，不再乘。',
                    'Scatter / Recovery':'首trigger有零ScatterWin；extra bonusY/winCountSC1却无ScatterWin分别核验。恢复转轴仅自己首ReelResults引用，不重复支付。'}}
        mapping = {k: v for k, v in profiles.items() if plan and (k == plan['sourceKey'] or k.startswith(plan['sourceKey'] + '-')) and v.get('fixtureOnly') is False}
        if gid==32754 and plan and plan.get('arthurFeatureContract'):
            mapping['arthurandtheroundtable-free-wild-ag-rolling-wms-v2']=profiles['arthurandtheroundtable-free-wild-ag-rolling-wms-v2']
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
        if plan and plan.get('adapter') == 'five-treasures-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'],wmsChoiceCount=plan['wmsChoiceCount'])
            card['settlement'] = {'stakeRaw':'startBalanceRaw - final CASH_BALANCE + sum(Logic totalWin)',
                'bet':'stakeRaw / 100','mul':'sum(Logic totalWin) / stakeRaw',
                'required':'固定实际176；逐帧现金与累计奖一致，最终EndGame完整确认且现金保持。'}
        if plan and plan.get('adapter') == 'eighty-fortunes-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement'] = {'stakeRaw':'startBalanceRaw - final CASH_BALANCE + sum(Logic totalWin) + deferred trigger award',
                'bet':'stakeRaw / 100','mul':'(sum(Logic totalWin) + deferred trigger award) / stakeRaw',
                'required':'固定实际176；触发奖首续帧兑现一次，首帧不提前兑现；trigger1760终局拒绝，只有已证明终态与EndGame确认才完整。'}
        if plan and plan.get('adapter') == 'fortunes-megaways-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement'] = {'stakeRaw':'startBalanceRaw - final CASH_BALANCE + sum(Logic totalWin)',
                'bet':'stakeRaw / 100','mul':'sum(Logic totalWin) / stakeRaw',
                'required':'固定实际16，GameMode0；级联奖只计入对应Logic，恢复引用不重复计奖，最终EndGame确认及每帧现金严格双验。'}
        if plan and plan.get('adapter') == 'arthur-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement'] = {'stakeRaw':'startBalanceRaw - final CASH_BALANCE + ordinary Logic totalWin',
                'bet':'stakeRaw / 100','mul':'ordinary Logic totalWin / stakeRaw',
                'required':'固定200；仅自身readyY普通完整，Payline奖额和/网格/BG一致，EndGame确认现金保持；14特殊路径仍拒绝。'}
            if plan.get('arthurFeatureContract'):
                card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + sum(own Logic totalWin)','bet':'stakeRaw / 100','mul':'sum(own Logic totalWin) / stakeRaw',
                    'required':'固定200；v2每帧BG/FS累计与现金一致；每个Payline值已经包含倍率，只加一次。唯一EndGame确认后完整，未知/Excalibur拒绝。'}
        if plan and plan.get('adapter') == 'blazing-x-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement'] = {'stakeRaw':'startBalanceRaw - final CASH_BALANCE + sum(own Logic totalWin)',
                'bet':'stakeRaw / 100','mul':'sum(own Logic totalWin) / stakeRaw',
                'required':'实际240；BG累计/FS累计/每帧现金/10免费计数及EndGame确认独立双验，恢复转轴不重复计奖。'}
        if plan and plan.get('adapter') == 'actionbank-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement'] = {'stakeRaw':'startBalanceRaw - final CASH_BALANCE + ordinary Logic totalWin',
                'bet':'stakeRaw / 100','mul':'ordinary Logic totalWin / stakeRaw',
                'required':'固定实际200；仅readyY普通完整，Anyway奖额和及BG累计一致，EndGame确认现金保持；11旧免费半局拒绝。'}
        if plan and plan.get('adapter') == 'acorn-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement'] = {'stakeRaw':'startBalanceRaw - final CASH_BALANCE + ordinary Logic totalWin',
                'bet':'stakeRaw / 100','mul':'ordinary Logic totalWin / stakeRaw',
                'required':'固定实际100；普通单spin/payline奖额和及BG累计严格一致，EndGame确认现金保持；特殊形状拒绝。'}
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
