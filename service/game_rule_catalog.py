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
        native.update({'family':'nextgen-dragon-first-free-evidence-v4','messages':['BET','FEATURE_START','FEATURE_PICK','FEATURE_END','FREE_GAME'],
            'start':'普通BET与原v1/v2/v3的START、PICK、END门逐层保持；旧7份START与88份v2前缀的拒绝不变。',
            'continue':'70份自身closed自然END、280条既有请求及1670条indexed native rows双验。END FID1|且IFG0、CW/CFGG/FGTW0，NFG=TFG=FGT只7/8/10/12/15/20。自己的完整PICK→END字段联合逐hash绑定；未知联合拒绝。原前端NFG→Qe、缺省GCT→wm=false、FID1|→jq=false，显式选择器退出后FREE selector选FREE_GAME。自己的继承构造器把LB25改为LB50，BPL5，原reviewed AP=false保持；不借其它款BPR/RB或猜奖励。',
            'complete':'只允许未来新匿名会话的一次first FREE。第一个FREE响应尚未观察，立即停止封存，不发第二FREE、END或下一BET；无特殊完整终局或信用。旧70/88/72半局不续、不重放、不回计。',
            'bounds':'v4仅离线本地，未在线应用；v3此前已随4841发布，当前81队列仍原v3。70次原前端mapper/selector/继承object constructor与独立Python一致；280条既有请求+70候选意图沿actual codec/PY IPC核验，99份旧普通raw与record哈希保持。原XML serializer未执行，未观察FREE response。mandatory wiringEvidence与原→v1→v2→v3→v4每层proof不可缺；重签后改记录/原raw/次数/构造器/信用仍拒绝。当前两仓所有jobs真实ended后才可新精确Linux/sealed及同namespace immutable remaining-only发布。',
            'files':['scripts/runner-v2/ag-rolling/sg-dragon-first-free.mjs','service/dragon_first_free_fields.py','config/ag-rolling-dragon-first-free-contracts.json',
                     'scripts/runner-v2/ag-rolling/sg-dragon-end.mjs','service/dragon_end_fields.py','config/ag-rolling-dragon-end-contracts.json',
                     'scripts/runner-v2/ag-rolling/sg-nextgen-codec.mjs','service/native_nextgen_fields.py',
                     'scripts/runner-v2/record_fields.py','scripts/runner-v2/ag-rolling/sg-resume-manifest.mjs'],
            'fields':{'NFG / TFG / FGT':'END后的初始免费计数三者严格一致且仅自身六个值；这不是终局计数。',
                      'FID / GCT':'FID1|使轮盘jq=false；缺失GCT的原frontend默认wm=false，未知GCT或extra拒绝。',
                      'BPL / LB':'END响应5/25分别核验；原Dragon请求继承构造器ni=5且强制iJ=50，所以发BPL5/LB50。',
                      'B / AB / TW':'END TW保持自己的BET奖，B=初始-100+TW、AB仍held；现金不作为免费终局或第二奖依据。',
                      'PID / SID / XML':'请求PID、响应SID分别固定；exact三XML节点、原PAYLOAD、计时、现金逐帧双验。',
                      '终局':'first FREE response未知；特殊settlement0，原普通type与所有旧marker/proof/raw保持。'}})
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
    elif game_id == 32780:
        native.update({'family':'kingbabylon-base-wms-v1','messages':['Init','Logic','EndGame'],'start':'paid Logic严格AccountData/CurrencyMultiplier1→Header→Stake total200，无PaylineCount/isBigBet/gameMode/WagerInfo。catalog runtime33002与自己的WMSHeader20402分别固定。response stake200/stakePerLine10/paylineCount20。',
            'continue':'单spin0/reelset0、5个ReelStops、freeN/bonusN/scatter0。29种自己的goldenWildA/goldenWildB完整联合双实现pin，只有普通状态形状、不按goldenWild名字另加奖。',
            'complete':'普通readyY后唯一Header-only EndGame，response readyN/Header/空AccountData/Balances/noGameResult/现金保持。Payline和=spinWins=Logic totalWin=BG累计，cash=start-200+奖；线号每spin去重。',
            'bounds':'完整file SHA核验；前1000中977普通完整/1954历史请求。15局Action Spins与8条免费链普通门拒绝，无特殊后续Logic/End许可；不能据bonusN或名称猜奖励/终局。actual codec→独立PY IPC→record/verify及1977次自身source payload语义一致，原frontend constructor/XMLserializer未执行；不是新native journal/300000信用。特殊须自己exact frontend和完整自然证据；旧half不续/重放/回计。Init仅synthetic，realInit/native scope/livecanary/currentqueue0，unknown一次封存/no retry。',
            'files':['scripts/runner-v2/ag-rolling/sg-kingbabylon-base.mjs','scripts/runner-v2/ag-rolling/sg-kingbabylon-source.mjs','scripts/runner-v2/ag-rolling/sg-kingbabylon-codec.mjs','service/kingbabylon_base_fields.py','config/ag-rolling-kingbabylon-base-contract.json','scripts/runner-v2/record_fields.py','service/ag_rolling_plan.py'],
            'fields':{'PaylineWin':'1272项自己的Payline，27种award/table/winVal tuple，56种2..5位置文本、unique0..14，自己的线0..19每spin去重，最多17项。奖额只加一次。','BGInfo':'goldenWildA/B各有序四位binary文本联合29种pin；totalWagerWin=bgWinnings=Logic奖/isMaxWin0。无baseGameSpinsRemaining/isBigBet/height；未知joint/顺序/tuple/position/MaxWin/recovery/foreign BG停止。'}})
    elif game_id == 32779:
        native.update({'family':'jinsedragon-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime33001与自己的WMS Header20401分别固定；AccountData/CurrencyMultiplier1→Header→Stake total100；响应stake100/stakePerLine100/paylineCount1。',
            'continue':'单spin0/reelset0、5个ReelStops、freeN/bonusN/scatter0。991种自己的expReelTriggerType/reelHeights/有序Orbs完整joint双实现pin；只按自己的完整形状，不猜高度或标签的奖励。',
            'complete':'普通readyY后唯一Header-only EndGame，响应readyN/Header/空AccountData/Balances，无GameResult且现金保持。AnywayWin和=totalSpinWin；再加winning=y且isJackpot=n的Orb amount一次=Logic totalWin=BG累计，cash=start-100+奖。',
            'bounds':'完整file SHA核验；前1000中993普通完整/1986历史请求，5条免费链、1条中奖Orb Jackpot、1条Wheel Jackpot仍拒绝。actual codec→独立PY IPC→record/verify及1993次自身source payload语义一致，原frontend constructor/XML serializer未执行。未知特殊须自己的exact frontend和完整自然证据；旧half不续/重放/回计；Init仅synthetic，realInit/native scope/livecanary/当前queue准入0；unknown一次封存/no retry。',
            'files':['scripts/runner-v2/ag-rolling/sg-jinsedragon-base.mjs','scripts/runner-v2/ag-rolling/sg-jinsedragon-source.mjs','scripts/runner-v2/ag-rolling/sg-jinsedragon-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/jinsedragon_base_fields.py','config/ag-rolling-jinsedragon-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'AnywayWin':'296项自己的奖，37种award/ways/winVal tuple，83种2..6位置文本、unique0..39，每spin最多2项，winIndex连续0..n-1。winVal已经含ways，只加一次。',
                'Orbs':'8898项自己的有序Orb，991个BG/Orb joint，12种award/amount tuple，position连续0..n-1。35普通局有winning=y的奖；10普通局非中奖isJackpot=y只作形状、金额不入奖。中奖Jackpot和Wheel/FS未知特殊均拒绝。',
                'BGInfo':'8种自己的expReelTriggerType/reelHeights组合；totalWagerWin=bgWinnings=Logic奖，remaining/isMaxWin0。height/trigger不额外加奖；未知joint/position/order/count/MaxWin/recovery/foreign BG停止。'}})
    elif game_id == 32778:
        native.update({'family':'jinjitreasure-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime33000与自己的WMS Header20322分别固定；Header→Stake total16/gameMode0→PaylineCount1→AccountData/CurrencyMultiplier1。响应只有stake16/totalWin/betID，无stakePerLine/paylineCount；Header没有ready。',
            'continue':'单spin0/reelset0、5个ReelStops、freeN/bonusN/scatter0。279种自己的MysterySymbol/ScatterInfo完整joint双实现pin；15位values只0或16且count/sum一致，只是普通状态形状，不另加ScatterInfo奖。',
            'complete':'普通后唯一Header-only EndGame，响应Header/空AccountData/Balances，无GameResult且现金保持。AnywayWin和=totalSpinWin=Logic totalWin=BG累计，现金=start-16+奖；winVal已经含ways，只加一次。',
            'bounds':'完整file SHA核验；前1000中997普通完整/1994历史请求，2个DecisionInfo触发和1个goldChanceAwarded1旧EndGame仍拒绝，不称特殊终局。actual codec→独立PY IPC→record/verify及1997次自身source payload语义一致，原frontend constructor/XML serializer未执行。特殊需自己exact frontend及完整自然证据；旧half不续/重放/回计；Init仅synthetic，realInit/native scope/livecanary/当前queue准入0；unknown一次封存/no retry。',
            'files':['scripts/runner-v2/ag-rolling/sg-jinjitreasure-base.mjs','scripts/runner-v2/ag-rolling/sg-jinjitreasure-source.mjs','scripts/runner-v2/ag-rolling/sg-jinjitreasure-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/jinjitreasure_base_fields.py','config/ag-rolling-jinjitreasure-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'AnywayWin':'269项自己的ways奖，58种award/ways/winVal tuple、153种3..8位置文本、unique0..14。每spin最多2项，winIndex连续0..n-1；新tuple/位置/ways/数量/顺序停止。',
                'MysterySymbol/ScatterInfo':'279种自己的replacementSym和有序15位values/totalValue/numScatters完整组合，只按形状审查，不按名字或ScatterInfo总额猜已兑现奖；未知组合或数值停止。',
                'BGInfo':'totalWagerWin=bgWinnings=Logic奖，remaining/isMaxWin/goldChanceAwarded/jackpotAwarded/gameMode全0；foreign BG、DecisionInfo/FS/恢复/MaxWin/ready停止。'}})
    elif game_id == 32777:
        native.update({'family':'jinjimegaways-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32999与自己的WMS Header20468分别固定；AccountData/CurrencyMultiplier1→Header→Stake total88，无isBigBet；响应只有stake88/totalWin/betID，无stakePerLine/paylineCount；Header普通readyY。',
            'continue':'单spin0/reelset0/1/2/3、6个ReelStops、freeN/bonusN/scatter0。937种自己的reelset/reelHeights完整joint双实现pin，TopReelInfo固定set9/stop0..88/positions37|38|39|40，SymbolGrids仅空形状；不猜第二奖励或特殊。',
            'complete':'普通readyY后唯一Header-only EndGame，响应readyN/Header/空AccountData/Balances，无GameResult/SymbolGrids且现金保持。AnywayWin和=totalSpinWin=Logic totalWin=BG累计，现金=start-88+奖；ways奖已包含，不能再乘ways或高度。',
            'bounds':'完整file SHA核验；前1000中991普通完整/1982历史请求，9个PickInfo触发readyN却旧EndGame仍拒绝，不称特殊终局。actual codec→独立PY IPC→record/verify及1991次自身source payload语义一致，原frontend constructor/XML serializer未执行。特殊需自己exact frontend及完整自然证据；旧half不续/重放/回计；Init仅synthetic，realInit/native scope/livecanary/当前queue准入0；unknown一次封存/no retry。',
            'files':['scripts/runner-v2/ag-rolling/sg-jinjimegaways-base.mjs','scripts/runner-v2/ag-rolling/sg-jinjimegaways-source.mjs','scripts/runner-v2/ag-rolling/sg-jinjimegaways-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/jinjimegaways_base_fields.py','config/ag-rolling-jinjimegaways-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'AnywayWin':'347项自己的ways奖，110种award/ways/winVal tuple、286种3..11位置文本、unique0..40。每spin最多5项，winIndex连续0..n-1；各reelset奖项和位置分别pin。',
                'TopReelInfo':'自己的set9/stop0..88/有序positions37|38|39|40仅形状；937个reelset/reelHeights组合、空SymbolGrids分别核验，不按名字另加奖。未知组合、文本、顺序或数值停止。',
                'BGInfo':'totalWagerWin=bgWinnings=Logic奖、isMaxWin0，reelHeights6位2..7按完整own joint；没有isBigBet/remaining，foreign BG、Scatter/PickInfo/FS/恢复/MaxWin停止。'}})
    elif game_id == 32776:
        native.update({'family':'moolah-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32998与自己的WMS Header20145分别固定；AccountData/CurrencyMultiplier1→Header→Stake total25，无isBigBet；响应stake25/stakePerLine1/paylineCount25分别核验；Header无readyForEndGame。',
            'continue':'单spin0/reelset0/5stops/freeN/bonusN/scatter0，cascadeCount1..4等于有序Cascade数量，index0..n-1。283种自己的完整Cascade链双实现pin，mask只作完整形状，不猜奖金或后续请求。',
            'complete':'普通后唯一Header-only EndGame，响应Header/空AccountData/Balances，无GameResult且现金保持。每级联Payline和=cascadeWins，各级联和=spinWins=Logic totalWin=BG累计，现金=start-25+奖。',
            'bounds':'完整file SHA核验；前1000普通完整/2000历史请求，没有特殊覆盖。1426个Cascade、283完整链；1/2/3/4级联660/268/58/14局。actual codec→独立PY IPC→record/verify及自身source payload语义一致，原frontend constructor/XML serializer未执行。未知特殊需自己exact frontend和完整自然证据；旧half不续/重放/回计；历史不抵目标；Init仅synthetic，realInit/native scope/livecanary/当前queue准入0；unknown一次封存/no retry。',
            'files':['scripts/runner-v2/ag-rolling/sg-moolah-base.mjs','scripts/runner-v2/ag-rolling/sg-moolah-source.mjs','scripts/runner-v2/ag-rolling/sg-moolah-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/moolah_base_fields.py','config/ag-rolling-moolah-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'PaylineWin':'781项自己的线奖，26种award/table/winVal tuple、73种3..5位置文本、unique0..14。每级联线号0..24去重，9局跨级联重复线号合法，不能整spin去重或重复加奖。',
                'Cascade':'index/mask/奖额/数量/有序线奖的283种完整链pin；各index0/1/2/3最大线奖17/6/2/0，奖项25/19/6/0，位置71/43/15/0。未知链、mask、顺序、数值或节点停止；不根据mask另加奖。',
                'BGInfo':'totalWagerWin=bgWinnings=Logic奖，baseGameSpinsRemaining/isBigBet/isMaxWin0；foreign BG、FS/Feature/恢复/MaxWin停止。'}})
    elif game_id == 32775:
        native.update({'family':'hulahula-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32997与自己的WMS Header20188分别固定；Header→AccountData/CurrencyMultiplier1→Stake total100/isBigBet0；响应stake100/stakePerLine10/paylineCount10分别核验；Header没有readyForEndGame。',
            'continue':'普通spin0/reelset0或1/5stops，freeSpinN/bonusAwardedN/scatter0；有序ReelResults/BGInfo。20种reelset/stackedSymbolIndex完整联合只核验，912/88两种reelset都普通，不猜免费或再加奖。',
            'complete':'普通后唯一Header-only EndGame，响应Header/空AccountData/Balances，无GameResult且现金保持。Payline和=spinWins=Logic totalWin=BG wager/bg累计；现金=start-100+奖。',
            'bounds':'完整file SHA核验；前1000中1000普通完整/2000历史请求，没有特殊覆盖。actual codec→独立PY IPC→record/verify一致；2000自身source payload语义核验，原frontend constructor/XML serializer未执行。未知特殊需要自己的exact frontend及完整自然证据，旧half不续/重放/回计；历史不抵目标；Init仅synthetic，realInit/native scope/livecanary/当前queue准入0；unknown一次封存/no retry。',
            'files':['scripts/runner-v2/ag-rolling/sg-hulahula-base.mjs','scripts/runner-v2/ag-rolling/sg-hulahula-source.mjs','scripts/runner-v2/ag-rolling/sg-hulahula-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/hulahula_base_fields.py','config/ag-rolling-hulahula-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'PaylineWin':'248个自己普通PaylineWin，23种award/table/winVal tuple、30种3..5位置文本、unique0..14；10条active线内每spin线号去重；reelset0/1分别pin奖项13/17与位置21/30，最多10奖项。只加一次。',
                'BGInfo / stackedSymbol':'20种reelset0或1/stackedSymbolIndex0..9完整联合；未知数值、foreign字段或新联合停止，不按stacked名字额外计奖。',
                'BGInfo':'totalWagerWin=bgWinnings=Logic奖，baseGameSpinsRemaining/isBigBet/isMaxWin0，stackedSymbolIndex仅完整联合形状；未知FS/Feature/恢复/MaxWin停止。'}})
    elif game_id == 32774:
        native.update({'family':'himalayas-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32996与自己的WMS Header20230分别固定；Header→AccountData/CurrencyMultiplier1→Stake total200/isBigBet0；响应stake200/stakePerLine2/paylineCount100分别核验；Header没有readyForEndGame。',
            'continue':'普通spin0/reelset6或7/5stops，freeSpinN/bonusAwardedN/scatter0；有序ReelResults/BGInfo。42种reelset/clumpSymbols/avalancheWarning/avalancheWilds完整联合形状只核验；22个reelset7及36个warning1仍普通，不猜免费或再加奖。',
            'complete':'普通后唯一Header-only EndGame，响应Header/空AccountData/Balances，无GameResult且现金保持。Payline和=spinWins=Logic totalWin=BG wager/bg累计；现金=start-200+奖。',
            'bounds':'完整file SHA核验；前1000中1000普通完整/2000历史请求，没有特殊覆盖。actual codec→独立PY IPC→record/verify一致；2000自身source payload语义核验，原frontend constructor/XML serializer未执行。未知特殊需要自己的exact frontend及完整自然证据，旧half不续/重放/回计；历史不抵目标；Init仅synthetic，realInit/native scope/livecanary/当前queue准入0；unknown一次封存/no retry。',
            'files':['scripts/runner-v2/ag-rolling/sg-himalayas-base.mjs','scripts/runner-v2/ag-rolling/sg-himalayas-source.mjs','scripts/runner-v2/ag-rolling/sg-himalayas-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/himalayas_base_fields.py','config/ag-rolling-himalayas-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'PaylineWin':'2977个自己普通PaylineWin，30种award/table/winVal tuple、236种3..5位置文本、unique0..49；100条active线内每spin线号去重；reelset6/7分别最多55/52奖项，分别pin奖项23/30与位置205/199。只加一次。',
                'BGInfo / avalanche':'42种reelset6或7/clumpSymbols管道有序文本/avalancheWarning0或1/avalancheWilds完整联合；22普通含非空Wild文本，未知数值、位置、顺序或新联合停止。',
                'BGInfo':'totalWagerWin=bgWinnings=Logic奖，baseGameSpinsRemaining/isBigBet/isMaxWin0，clump/avalanche只作完整联合形状；未知FS/Feature/恢复/MaxWin停止。'}})
    elif game_id == 32773:
        native.update({'family':'hercules-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32995与自己的WMS Header20102分别固定；Header→AccountData/CurrencyMultiplier1→Stake total100/isBigBet0；响应stake100/stakePerLine2/paylineCount50或100，不能乘线数改下注；Header没有readyForEndGame。',
            'continue':'普通spin0/reelset0或4/5stops，freeSpinN/bonusAwardedN/scatter0；有序ReelResults/WildPositions/BGInfo。55种active线数/reelset/WildPositions/wildBonus完整联合形状只核验；160普通100线与9个非空topWild不据名字猜免费或再加奖。',
            'complete':'普通后唯一Header-only EndGame，响应Header/空AccountData/Balances，无GameResult且现金保持。Payline和=spinWins=Logic totalWin=BG wager/bg累计；现金=start-100+奖。',
            'bounds':'完整file SHA核验；前1000中1000普通完整/2000历史请求，没有特殊覆盖。actual codec→独立PY IPC→record/verify一致；2000自身source payload语义核验，原frontend constructor/XML serializer未执行。未知特殊需要自己的exact frontend及完整自然证据，旧half不续/重放/回计；历史不抵目标；Init仅synthetic，realInit/native scope/livecanary/当前queue准入0；unknown一次封存/no retry。',
            'files':['scripts/runner-v2/ag-rolling/sg-hercules-base.mjs','scripts/runner-v2/ag-rolling/sg-hercules-source.mjs','scripts/runner-v2/ag-rolling/sg-hercules-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/hercules_base_fields.py','config/ag-rolling-hercules-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'PaylineWin':'3817个自己普通PaylineWin，28种award/table/winVal tuple、232种3..5位置文本、unique0..49；50/100线各最多44/100奖项且每spin线号去重，小于自己的active线数；两档分别pin奖项15/28与位置92/229。只加一次。',
                'WildPositions / BGInfo.wildBonus':'55种active50或100/reelset0或4/六个WildPositions属性/wildBonus完整联合形状，heldWildReels及existingHeldWildReels空；未知数值、位置、顺序或新联合停止。',
                'BGInfo':'totalWagerWin=bgWinnings=Logic奖，baseGameSpinsRemaining/isBigBet/isMaxWin0，wildBonus0或1仅联合形状；未知FS/BonusWheel/Feature/恢复/MaxWin停止。'}})
    elif game_id == 32772:
        native.update({'family':'heidibier-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32994与自己的WMS Header20157分别固定；AccountData/CurrencyMultiplier1→Header→Stake total75；响应stake75/stakePerLine1/paylineCount50，不能乘线数改下注；Header没有readyForEndGame。',
            'continue':'普通spin0/reelset0/6stops，freeSpinN/bonusAwardedN/scatter0；有序ReelResults/MystInfo/WildInfo，可选BonusReplacementInfo，再BaseGameInfo。129种Myst/Wild/六reel RD联合形状只核验，未知新组合停止，不据名称猜免费或再加奖。',
            'complete':'普通后唯一Header-only EndGame，响应Header/空AccountData/Balances，无GameResult且现金保持。Payline和=spinWins=Logic totalWin=BaseGameInfo totalWagerWin；现金=start-75+奖。',
            'bounds':'完整file SHA核验；前1000中986普通完整/1972历史请求，14个特殊触发首响应拒绝。actual codec→独立PY IPC→record/verify一致；1986自身source payload语义核验，原frontend constructor/XML serializer未执行。14个FSInfo、其中3个WheelInfo后旧EndGame不能给新的特殊terminal许可；历史不抵目标；Init仅synthetic，realInit/native scope/livecanary/当前queue准入0；unknown一次封存/no retry。',
            'files':['scripts/runner-v2/ag-rolling/sg-heidibier-base.mjs','scripts/runner-v2/ag-rolling/sg-heidibier-source.mjs','scripts/runner-v2/ag-rolling/sg-heidibier-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/heidibier_base_fields.py','config/ag-rolling-heidibier-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'PaylineWin':'1893个自己普通PaylineWin，35种award/table/winVal tuple、180种3..6位置文本、unique0..35；最多50奖项且每spin线号去重，小于50。只加一次。',
                'MystInfo / WildInfo / BonusReplacementInfo':'129种自己的Myst index/Wild Indices/可选六reel RD SS与DS有序联合形状。266普通含replacement；未知新组合停止。',
                'BaseGameInfo / FSInfo':'自己的普通totalWagerWin=Logic奖，isMaxWinN/maxWinValue25000000只是上限，普通没有bgWinnings。FSInfo/WheelInfo首响应仍拒绝，不放FREE/END或信用。'}})
    elif game_id == 32771:
        native.update({'family':'goldenchief-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32993与自己的WMS Header20125分别固定；Header→AccountData/CurrencyMultiplier1→Stake total100/isBigBet0；响应stake100/stakePerLine5/active paylineCount20或100，不能乘线数改下注；Header没有readyForEndGame。',
            'continue':'普通spin0/reelset0/5stops，freeSpinN/bonusAwardedN/scatter0；GameResult有序ReelResults/BGInfo/PaylineCountInfo，再有自己的WildExpansion或SymbolUpgrade/WildExpansion。21种active线数/WildExpansion/SymbolUpgrade联合形状只核验；87普通100线含wild、2个含upgrade，不能据名字猜免费或再加奖。',
            'complete':'普通后唯一Header-only EndGame，响应只有Header/Balances，无AccountData/GameResult且现金保持。Payline和=spinWins=Logic totalWin=BG wager/bg累计；现金=start-100+奖。',
            'bounds':'完整file SHA核验；前1000中987普通完整/1974历史请求，13个特殊触发首响应拒绝。actual codec→独立PY IPC→record/verify一致；1987自身source payload语义核验，原frontend constructor/XML serializer未执行。3个BonusWheel/GambleInfo、10个BonusWheel/TotemBonus后旧EndGame不能给新的特殊terminal许可；历史不抵目标；Init仅synthetic，realInit/native scope/livecanary/当前queue准入0；unknown一次封存/no retry。',
            'files':['scripts/runner-v2/ag-rolling/sg-goldenchief-base.mjs','scripts/runner-v2/ag-rolling/sg-goldenchief-source.mjs','scripts/runner-v2/ag-rolling/sg-goldenchief-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/goldenchief_base_fields.py','config/ag-rolling-goldenchief-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'PaylineWin':'2232个自己普通PaylineWin，24种award/table/winVal tuple、146种3..5位置文本、unique0..19；20/100线分别最多12/100奖项且每spin线号去重，小于自己的active线数；自己的两个线数档分别pin奖项21/22与位置47/143。只加一次。',
                'PaylineCountInfo / WildExpansion / SymbolUpgrade':'normal20/bonus100/active20或100，21种自己的wild原位置/reels与可选upgrade replacement/positions联合形状。未知新组合停止。',
                'BGInfo / BonusWheel':'totalWagerWin=bgWinnings=Logic奖，baseGameSpinsRemaining/isBigBet/isMaxWin/chiefWin0。BonusWheel/GambleInfo/TotemBonus首响应仍拒绝，不放FREE/END或信用。'}})
    elif game_id == 32770:
        native.update({'family':'giantsgold-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32992与自己的WMS Header20129分别固定；Header→Stake total50/paylineCount20→AccountData/CurrencyMultiplier1；响应stake50/stakePerLine2/paylineCount20，不能改下注40；Header没有readyForEndGame。',
            'continue':'GameResult严格ReelResults/BGInfo，ReelResults ordered ClumpPlaceholderInfo/PsudoSuperWildStack/两ReelSpin；numSpins2，spinIndex0/reelset0与spinIndex1/reelset1都是普通，freeN/bonusN/scatter0。75种自己的Clump/Wild联合形状只核验，83普通局wild非空，不能猜特殊或再加奖。',
            'complete':'普通完整两spin之后唯一Header-only EndGame，响应Header/空AccountData/Balances，无GameResult且现金保持；每spin Payline和=spinWins，两spin和=Logic totalWin=BG累计；现金=start-50+奖。每spin各自去重线号，同线可在两个spin再次出现。',
            'bounds':'完整file SHA核验；前1000全普通完整/2000历史请求，没有特殊或免费覆盖。actual codec→独立PY IPC→record/verify一致；2000自身source payload语义核验，原frontend constructor/XML serializer未执行。历史不抵目标；Init仅synthetic能力shape，realInit/native scope/livecanary/当前队列准入0；unknown一次封存/no retry。',
            'files':['scripts/runner-v2/ag-rolling/sg-giantsgold-base.mjs','scripts/runner-v2/ag-rolling/sg-giantsgold-source.mjs','scripts/runner-v2/ag-rolling/sg-giantsgold-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/giantsgold_base_fields.py','config/ag-rolling-giantsgold-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'PaylineWin / ReelSpin':'664个自己Payline，27种award/table/winVal tuple、15种5位位置文本，唯一位置0..59。分spin固定奖项及位置集合；max各4/12，Logic累计max13，线号0..19。每spin奖只加一次，新tuple/位置/索引/reelset停止。',
                'ClumpPlaceholderInfo / PsudoSuperWildStack':'75种自己的四个small/big Odd/Even字段与reelsToTurnWild完整联合形状；wild非空也是普通，不能再加奖或按名字推断免费。未知联合或Feature/FS/Scatter/extra/MaxWin/recovery停止。',
                'BGInfo / Stake':'BG totalWagerWin=bgWinnings=两spin奖；baseGameSpinsRemaining/isMaxWin0；Stake总下注50/属性paylineCount20，没有PaylineCount节点或WagerInfo。'}})
    elif game_id == 32769:
        native.update({'family':'fudaole-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32991与自己的WMS Header20135分别固定；Header→WagerInfo totalStake200/featureBet0→AccountData/CurrencyMultiplier1；响应totalStake200/waysCount243；Header没有readyForEndGame。',
            'continue':'普通reelset0/5stops，没有spinIndex；最多3个连续winIndex的AnywayWin，scatterWinCount0/freeSpinN/bonusAwardedN；GameResult严格MysteryRepSymbol/ReelResults/GameWinInfo/GameRtpInfo。40种自己的MysteryRepSymbol联合形状只核验，25个普通局含nudging wild，不能据名字猜特殊或再次加奖。',
            'complete':'普通后唯一Header-only EndGame，响应Header/空AccountData/Balances，无GameResult且现金保持。AnywayWin和=totalWayWin=totalSpinWin=Logic totalWin=GameWinInfo base/wager累计；现金=start-200+奖。',
            'bounds':'完整file SHA核验；前1000中992普通完整/1984历史请求，8个特殊触发首响应拒绝。actual codec→独立PY IPC→record/verify一致；1992自身source payload语义核验，原frontend constructor/XML serializer未执行。6个FreeGame、1个PickGame、1个RedEnvelope后旧EndGame不是已覆盖的自然特殊terminal；历史不抵目标；Init仅synthetic能力shape，realInit/native scope/livecanary/当前队列准入0；unknown一次封存/no retry。',
            'files':['scripts/runner-v2/ag-rolling/sg-fudaole-base.mjs','scripts/runner-v2/ag-rolling/sg-fudaole-source.mjs','scripts/runner-v2/ag-rolling/sg-fudaole-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/fudaole_base_fields.py','config/ag-rolling-fudaole-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'AnywayWin':'370个自己普通AnywayWin，123种award/ways/winVal tuple、259种3..11或13位置文本、唯一位置0..14；最多3个winIndex0..2连续。winVal含ways，只加一次。新tuple/位置停止。',
                'MysteryRepSymbol / Feature':'40种自己的isSymPresent/replacementSymbolIndex/isNudgingWild/可选nudgingWildPositions/isRedEnvlpJkpt字段联合形状；普通isRedEnvlpJkptN。FreeGame/PickGame/RedEnvelope触发停止，无FREE/END许可或信用。',
                'GameWinInfo / WagerInfo':'下注200；totalBaseGameWin=totalWagerWin=Logic奖，totalFreeSpinsWin/totalPickJkptWin0/isMaxWinN/maxWinValue25000000只上限；GameRtpInfo targetedRtpValue96.06。WagerInfo featureBet0，不借其它款SpinInfo或Stake字段。'}})
    elif game_id == 32768:
        native.update({'family':'frozeninferno-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32990与自己的WMS Header20090分别固定；Header→AccountData/CurrencyMultiplier1→SpinInfo perLine125/total5000/mode0/isReset0/modeChange0；响应stake5000/stakePerLine125/paylineCount40；Header没有readyForEndGame。',
            'continue':'普通spin0/reelset0/5stops，最多33个唯一Payline线0..39，winCountSC0/freeSpinN/bonusAwardedN；GameResult严格ReelResults/WildInfo/BaseGame。85种自己的WildData字段与文本联合形状只核验，不按direction或位置猜终局，不再次加奖。Feature/Scatter/免费/未知形状立即停止。',
            'complete':'普通后唯一Header-only EndGame，响应仅Header/Balances，无AccountData/GameResult且现金保持。Payline和=spinWins=Logic totalWin；现金=start-5000+奖。',
            'bounds':'完整file SHA核验；前1000中677普通完整/1354历史请求，323个FreeGames触发首响应拒绝。actual codec→独立PY IPC→record/verify一致；1677自身source payload语义核验，原frontend constructor/XML serializer未执行。旧免费触发后EndGame不是完整免费terminal；历史不抵目标；Init仅synthetic能力shape，realInit/native scope/livecanary/当前队列准入0；unknown一次封存/no retry。',
            'files':['scripts/runner-v2/ag-rolling/sg-frozeninferno-base.mjs','scripts/runner-v2/ag-rolling/sg-frozeninferno-source.mjs','scripts/runner-v2/ag-rolling/sg-frozeninferno-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/frozeninferno_base_fields.py','config/ag-rolling-frozeninferno-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'PaylineWin':'2838个自己普通Payline，30种award/table/winVal tuple、105种3..5位置文本、唯一位置0..19；最多33线，index0..39唯一。新tuple/位置停止。',
                'WildInfo / Feature':'普通85种WildData mode/wildCount/previousWild/CurrentWild/direction/text联合形状；CurrentWild可为-1，严格按自己组合核验。323个Feature index1/name FreeGames/data.mode0/bonusPos0..19未适配，无FREE/END许可或信用。',
                'BaseGame / SpinInfo':'下注5000；BaseGame gameMode0/isMaxWinN/maxWinValue25000000，只有上限不当奖励。SpinInfo固定mode0/isReset0/modeChange0，不借其它款Stake/WagerInfo字段。'}})
    elif game_id == 32767:
        native.update({'family':'firequeen-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32989与自己的WMS Header20192分别固定；Header→WagerInfo.totalStake50→AccountData/CurrencyMultiplier1；响应stake50/stakePerLine1/paylineCount100；Header没有readyForEndGame。',
            'continue':'普通spin0/reelset0/11stops，最多70个唯一Payline线0..99，winCountSC0/freeSpinN/bonusAwardedN；GameResult为可有可无的WildTransformedReels后ReelResults/GameWinInfo/GameVariantInfo，13种自己Wild文本只验形状，不再加奖或乘倍。Feature/Scatter/免费/未知形状立即停止。',
            'complete':'自己的GameWinInfo.isEndGameY普通后唯一Header-only EndGame，Header/空AccountData/Balances，无GameResult且现金保持。Payline和=spinWins=Logic totalWin=GameWinInfo累计；现金=start-50+奖。',
            'bounds':'完整file SHA核验；前1000中989普通完整/1978历史请求，11个FreeSpins触发首响应拒绝。actual codec→独立PY IPC→record/verify一致；1989自身source payload语义核验，原frontend constructor/XML serializer未执行。旧isEndGameN的EndGame不是terminal；历史不抵目标；Init仅synthetic能力shape，realInit/native scope/livecanary/当前队列准入0；unknown一次封存/no retry。',
            'files':['scripts/runner-v2/ag-rolling/sg-firequeen-base.mjs','scripts/runner-v2/ag-rolling/sg-firequeen-source.mjs','scripts/runner-v2/ag-rolling/sg-firequeen-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/firequeen_base_fields.py','config/ag-rolling-firequeen-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'PaylineWin':'3587个自己普通Payline，34种award/table/winVal tuple、153种3..5位置文本、唯一位置0..65；最多70线，index0..99唯一。新tuple/位置停止。',
                'WildTransformedReels / Feature':'180普通存在13种固定Wild文本，809普通省略；均只验形状。11个自己的FreeSpins1/2/3首totalFSTriggered5/lastFreeSpinN/isEndGameN未适配，无FREE/END许可或信用。',
                'GameWinInfo / WagerInfo':'下注50；totalWagerWin/totalBGWin=Payline奖和、totalFSWin0/maxWinValue25000000/isMaxWinN/isEndGameY；GameVariantInfo.rtp95.95。上限不当奖励。'}})
    elif game_id == 32766:
        native.update({'family':'eurekablast-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32988与自己的WMS Header20400分别固定；AccountData/CurrencyMultiplier1→Header→Stake.total50，无PaylineCount/isBigBet；响应stake50/stakePerLine1/paylineCount50。',
            'continue':'普通spin0/reelset0或1/5stops、最多23个唯一Payline线0..49，winCountSC0/freeSpinN/bonusAwardedN、自己的readyY；GameResult严格ReelResults/BGInfo。DynamiteFeature/FSInfo/Scatter/未知形状立即停止；reelset1不是免费。',
            'complete':'普通readyY后唯一Header-only EndGame，自己的readyN/空AccountData/Balances，无GameResult且现金保持。Payline和=spinWins=Logic totalWin=BG累计；现金=start-50+奖。',
            'bounds':'自身完整file SHA核验，前1000中975普通完整/1950历史请求；25个Dynamite/FS首响应拒绝。actual codec→独立PY IPC→record/verify一致；1975自身source payload语义核验，不声称原frontend constructor/XML serializer执行。历史不抵目标；Init仅synthetic能力形状，realInit/native scope/livecanary/当前队列准入0；unknown一次封存/no retry。',
            'files':['scripts/runner-v2/ag-rolling/sg-eurekablast-base.mjs','scripts/runner-v2/ag-rolling/sg-eurekablast-source.mjs','scripts/runner-v2/ag-rolling/sg-eurekablast-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/eurekablast_base_fields.py','config/ag-rolling-eurekablast-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'PaylineWin':'859个自身普通Payline，27种award/table/winVal tuple、77种3..5位置文本、唯一位置0..14；最多23线，index0..49唯一。新tuple/位置停止。',
                'DynamiteFeature / FSInfo':'22个Dynamite首triggered1/ended0与3个免费首total12或15/counter0均未适配。旧Dynamite early-End不是terminal；普通adapter没有续帧许可或信用。',
                'BGInfo / Stake':'下注50；BG totalWagerWin/bgWinnings=Payline奖和、baseGameSpinsRemaining0/isMaxWin0；没有isBigBet字段，foreign字段拒绝。'}})
    elif game_id == 32765:
        native.update({'family':'deepseamagic-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32987与自己的WMS Header20412分别固定；AccountData/CurrencyMultiplier1→Header→Stake.total200，无PaylineCount/isBigBet；响应stake200/stakePerLine4/paylineCount50。',
            'continue':'普通spin0/reelset0/5stops、最多40个唯一Payline线0..49，winCountSC0/freeSpinN/bonusAwardedN、自己的readyY；GameResult只ReelResults/可省略的BonusSymValues/BGInfo两种已观察顺序。DLInfo/FSInfo/Scatter/未知形状立即停止。',
            'complete':'普通readyY后唯一Header-only EndGame，自己的readyN/空AccountData/Balances，无GameResult且现金保持。Payline和=spinWins=Logic totalWin=BG累计；现金=start-200+奖。BonusSymValues不再加奖或乘倍。',
            'bounds':'自身完整file SHA核验，前1000中991普通完整/1982历史请求；9个DL/FS首响应拒绝。actual codec→独立PY IPC→record/verify一致；1991自身source payload语义核验，不声称原frontend constructor/XML serializer执行。历史不抵目标；Init仅synthetic能力形状，realInit/native scope/livecanary/当前队列准入0；unknown一次封存/no retry。',
            'files':['scripts/runner-v2/ag-rolling/sg-deepseamagic-base.mjs','scripts/runner-v2/ag-rolling/sg-deepseamagic-source.mjs','scripts/runner-v2/ag-rolling/sg-deepseamagic-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/deepseamagic_base_fields.py','config/ag-rolling-deepseamagic-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'PaylineWin':'1957个自身普通Payline，26种award/table/winVal tuple、94种2..5位置文本、唯一位置0..14；最多40线，index0..49唯一。新tuple/位置停止。',
                'BonusSymValues':'660普通存在/331普通省略；348种15项完整文本固定，数值仅自己的-1或受证据正值。不根据文本猜DL/免费，也不再加奖。',
                'BGInfo / Stake':'下注200；BG totalWagerWin/bgWinnings=Payline奖和、isMaxWin0；没有baseGameSpinsRemaining/isBigBet字段，foreign字段拒绝。'}})
    elif game_id == 32764:
        native.update({'family':'dragonspin-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32986与WMS Header20117分别固定；自己的AccountData/CurrencyMultiplier1→Header→Stake.total210，无PaylineCount；响应stake210/stakePerLine7/paylineCount30，没有readyForEndGame字段。',
            'continue':'普通单spin0/reelset0/5stops，最多30唯一Payline线0..29，winCountSC0/freeSpinN/bonusAwardedN。BonusData.BonusBet0；MSReplacement自己的symbolCount2或3与5项文本联合形状固定。免费、Scatter、未知节点或奖项停止。',
            'complete':'完整普通后唯一Header-only EndGame，响应只Header/Balances，无AccountData/GameResult且现金保持。Payline和=spinWins=Logic totalWin=BG累计；现金=start-210+奖。MSReplacement不再加奖或乘倍。',
            'bounds':'自身全文件SHA核验，前1000全部普通完整/2000历史请求；实际codec→独立PY IPC→record/verify一致，2000自身source payload构造语义核验，历史不抵目标。Init仅synthetic能力形状，无真实Init/native scope/livecanary/当前队列准入；未知传输一次封存、不retry/resend。',
            'files':['scripts/runner-v2/ag-rolling/sg-dragonspin-base.mjs','scripts/runner-v2/ag-rolling/sg-dragonspin-source.mjs','scripts/runner-v2/ag-rolling/sg-dragonspin-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/dragonspin_base_fields.py','config/ag-rolling-dragonspin-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'PaylineWin':'2525个自身Payline，26种awardIndex/awardTableIndex/winVal组合、85种3..5位置文本，唯一位置0..14。线0..29唯一，新tuple/位置停止。',
                'MSReplacement / BonusData':'772种自己symbolCount与5项文本联合形状；文本数值0..9，symbolCount只受证据2/3；BonusBet必须0。两节点均不再增加奖额。',
                'BGInfo / Stake':'下注总额210，BG totalWagerWin/bgWinnings=Payline奖和；baseGameSpinsRemaining0/isMaxWin0。'}})
    elif game_id == 32763:
        native.update({'family':'jekyll-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32985与WMS Header20126分别固定；自己的Header→AccountData/CurrencyMultiplier1→Stake.total100/isBigBet0，无PaylineCount；响应stake100/stakePerLine10/paylineCount10。没有readyForEndGame字段。',
            'continue':'普通单spin0、reelset0或1、5stops、最多7唯一Payline线0..9，winCountSC0/freeSpinN/bonusAwardedN。两个reelset均有自己的普通证据；bonusY、ScatterWin、免费、未知奖项或文本立即停止。',
            'complete':'完整普通后唯一Header-only EndGame，响应只Header/Balances，无AccountData/GameResult且现金保持。Payline和=spinWins=Logic totalWin=BG累计；现金=start-100+奖。',
            'bounds':'自身全文件SHA核验，前1000中554普通完整/1108历史请求；446份bonusY/scatter标记仍拒绝，不据零奖或旧EndGame猜许可。实际codec→独立PY IPC→record/verify一致，1554自身source payload构造语义核验，历史不抵目标。Init仅synthetic能力形状，无真实Init/native scope/livecanary/当前队列准入；未知传输一次封存、不retry/resend。',
            'files':['scripts/runner-v2/ag-rolling/sg-jekyll-base.mjs','scripts/runner-v2/ag-rolling/sg-jekyll-source.mjs','scripts/runner-v2/ag-rolling/sg-jekyll-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/jekyll_base_fields.py','config/ag-rolling-jekyll-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'PaylineWin':'171个自身普通Payline，16种awardIndex/awardTableIndex/winVal组合、22种位置文本；2..4个唯一位置0..14。线0..9唯一，新tuple/位置停止。',
                'BGInfo / Stake':'下注总额100，BG totalWagerWin/bgWinnings=Payline奖和；baseGameSpinsRemaining0/isBigBet0/isMaxWin0。',
                'Scatter / bonus':'446份特殊标记仅独立观察；旧bonus1/raw/hash保持，不发EndGame、不续半局、不计历史信用。'}})
    elif game_id == 32762:
        native.update({'family':'desertcats-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32984与WMS Header20315分别固定；自己的Header→Stake.total200→PaylineCount.count50→AccountData/CurrencyMultiplier1，响应stake200/stakePerLine4/paylineCount50。Header没有readyForEndGame，不借别款ready门。',
            'continue':'自身普通单spin0/reelset0、7stops、最多50唯一Payline线0..49，winCountSC0/freeSpinN/bonusAwardedN。QuickHits、Symbol、WildReel必须278种自己的联合形状；未知免费、Feature、MaxWin、额外Spin、未知奖项或形状停止。',
            'complete':'完整普通后唯一Header-only EndGame，响应空AccountData/无GameResult且现金保持。Payline和=spinWins，Payline和+QuickHits.winValue=Logic totalWin=BG累计；现金=start-200+奖。Symbol/WildReel不再次乘奖。',
            'bounds':'自己的全文件SHA核验，前1000普通完整/2000历史请求，10局独立QuickHits奖2000；实际codec→独立PY IPC→record/verify一致，历史不抵目标。没有免费覆盖；Init仅synthetic限定能力形状，无真实Init/native scope/livecanary/当前队列准入；未知传输单次封存、不retry/resend。',
            'files':['scripts/runner-v2/ag-rolling/sg-desertcats-base.mjs','scripts/runner-v2/ag-rolling/sg-desertcats-source.mjs','scripts/runner-v2/ag-rolling/sg-desertcats-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/desertcats_base_fields.py','config/ag-rolling-desertcats-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'PaylineWin':'4970个自身Payline，48种awardIndex/awardTableIndex/winVal组合、204种位置文本；3..7个唯一位置0..27。线0..49唯一，未知tuple/位置停止。',
                'QuickHits / Symbol / WildReel':'仅自身278种numOfGems/winValue/replacement/pattern联合形状，numOfGems0..5奖0、6奖2000；QuickHits独立入Logic奖一次，ReelSpin.spinWins只Payline和，Symbol/WildReel不乘奖。',
                'BGInfo / Stake':'下注总额200，BG totalWagerWin/bgWinnings均含QuickHits；baseGameSpinsRemaining0/isBigBet0/isMaxWin0。'}})
    elif game_id == 32761:
        native.update({'family':'drumsexplosion-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32983与WMS Header20454分别固定；自己的AccountData/CurrencyMultiplier1→Header→Stake.total176，没有lines/paylineCount/PaylineCount。请求与目录slug dancingdrumsexplosion；响应stake176，没有stakePerLine/paylineCount，普通readyForEndGameY。',
            'continue':'自身普通单spin0/reelset0、5stops、最多3个AnywayWin，连续winIndex0..2；scatterWinCount0/freeSpinN/bonusAwardedN。4种wildReplace和2种bonusReplace只核验形状，不猜特殊或再次加奖。DecisionInfo、免费、Scatter、Feature、MaxWin、未知形状停止。',
            'complete':'完整普通readyY后唯一Header-only EndGame，响应Header.readyN/空AccountData/Balances、无GameResult且现金保持。每个winVal只加一次，不再乘ways；奖额和=totalSpinWin=Logic totalWin=BG累计，现金=start-176+奖。',
            'bounds':'自己的全文件SHA核验，前1000实际994普通完整/1988自身历史请求，6个DecisionInfo readyN旧早End仍拒绝；实际codec→独立PY IPC→record/verify一致，历史不抵目标。Init仅synthetic限定能力形状，无真实Init/native scope/livecanary/当前队列准入；未知传输单次封存、不retry/resend。',
            'files':['scripts/runner-v2/ag-rolling/sg-drumsexplosion-base.mjs','scripts/runner-v2/ag-rolling/sg-drumsexplosion-source.mjs','scripts/runner-v2/ag-rolling/sg-drumsexplosion-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/drumsexplosion_base_fields.py','config/ag-rolling-drumsexplosion-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'AnywayWin':'344个自身普通AnywayWin，81种awardIndex/ways/winVal组合和230种位置文本；位置3..8个、唯一编号0..14。未知tuple/位置停止，ways不再次乘奖。',
                'BGInfo / Stake':'下注总额176；BG totalWagerWin/bgWinnings与奖额和一致，isMaxWin0。wildReplace/bonusReplace不是第二次奖额或倍率。',
                'DecisionInfo':'6个旧特殊indices48/389/455/492/576/870，picksAwarded1/picksUsed0/ScatterWin奖0且readyN；旧bonus1标签和raw保持，不续局/重放/回计。'}})
    elif game_id == 32760:
        native.update({'family':'dancingdrums-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32982与WMS Header20207分别绑定；自己的Header→Stake.total528/paylineCount1→AccountData/CurrencyMultiplier1。请求和目录slug dancingdrums；响应stake528，没有stakePerLine/paylineCount或readyForEndGame。',
            'continue':'只自身普通单spin0/reelset0、5stops、最多3个AnywayWin；winIndex连续0..2，scatterWinCount0/freeSpinN/bonusAwardedN。UPicksDecision、免费、Scatter、Feature、MaxWin和未知状态停止。',
            'complete':'完整普通后唯一Header-only EndGame，响应Header/空AccountData/Balances，无GameResult且现金保持。AnywayWin奖额只加一次，不再乘ways；奖额和=totalSpinWin=Logic totalWin=BG累计，现金=start-528+奖。',
            'bounds':'自己的全文件SHA核验，前1000实际993普通完整/1986自身历史请求，7个UPicksDecision旧早End仍拒绝；实际codec→独立PY IPC→record/verify一致，历史不抵目标。Init仅synthetic限定能力形状，无真实Init/native scope/livecanary/当前队列准入；未知传输单次封存、不retry/resend。',
            'files':['scripts/runner-v2/ag-rolling/sg-dancingdrums-base.mjs','scripts/runner-v2/ag-rolling/sg-dancingdrums-source.mjs','scripts/runner-v2/ag-rolling/sg-dancingdrums-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/dancingdrums_base_fields.py','config/ag-rolling-dancingdrums-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'AnywayWin':'415个自身普通AnywayWin，78种awardIndex/ways/winVal组合和239种位置文本；位置3..9个、唯一编号0..14。未知tuple/位置立即停止，ways不再次乘奖。',
                'BGInfo / Stake':'实际总下注528/Stake.paylineCount1；BG totalWagerWin/bgWinnings与奖额和一致，isMaxWin0，现金逐帧独立双验。',
                'UPicksDecision':'7个旧特殊prefix indices12/135/517/546/840/896/939，uPicksAwarded1/uPicksUsed0/unusedUPickTypes1|1|1|1；旧bonus1标签和raw保持，不续局/重放/回计。'}})
    elif game_id == 32759:
        native.update({'family':'crystalforest-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32981与WMS Header20142分别绑定；自己的AccountData/CurrencyMultiplier1→Header→Stake.total25/lines25，请求gameCodeRGI crystalforesthd_prt、目录slug crystalforest；响应stake25/stakePerLine1/paylineCount25。',
            'continue':'只自身普通单spin0/reelset0、5stops、1..4连续Cascade；之前Cascade有奖、最后零Payline/零奖/零mask。没有readyForEndGame。免费、Feature、extra、MaxWin和未知状态停止。',
            'complete':'完整普通级联后唯一Header-only EndGame，响应Header/空AccountData/Balances，无GameResult且现金保持。逐cascade Payline奖额之和=cascadeWins，全部级联和=spinWins=Logic totalWin=BG累计，现金=start-25+奖。',
            'bounds':'自己的全文件SHA核验，前1000全部普通完整/2000自身历史请求，0免费覆盖；实际codec→独立PY IPC→record/verify一致，历史不抵目标。Init仅synthetic限定能力形状，无真实Init/native scope/livecanary/当前队列准入；未知传输单次封存、不retry/resend。',
            'files':['scripts/runner-v2/ag-rolling/sg-crystalforest-base.mjs','scripts/runner-v2/ag-rolling/sg-crystalforest-source.mjs','scripts/runner-v2/ag-rolling/sg-crystalforest-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/crystalforest_base_fields.py','config/ag-rolling-crystalforest-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'Cascade':'1419个自身Cascade/716个PaylineWin，197种index/mask、23种awardIndex/奖额、68种位置文本；每级联最多25唯一线0..24、单spin累计最多38。mask等于当前获奖位置0..14的位集合，不再次加奖或乘倍。',
                'BGInfo / Stake':'实际总下注25/lines25；baseGameSpinsRemaining0/isBigBet0/isMaxWin0，BG累计与每帧现金独立双验。'}})
    elif game_id == 32758:
        native.update({'family':'cooljewels-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32980与WMS Header20150分别绑定；自己的Header→AccountData/CurrencyMultiplier1→Stake.multiplier1/total50。请求gameCodeRGI cooljewels_prt，目录slug cooljewels。响应stake50/stakePerLine0/paylineCount0。',
            'continue':'仅自身普通单Logic内完整ReactorChain：1..6有序drop，先前drop有cluster，末drop为0cluster；每drop最多7cluster、36格layout符号0..13。没有readyForEndGame字段。Feature/FS_Info、未知cluster或MaxWin停止。',
            'complete':'普通消除链完整后唯一Header-only EndGame，响应严格Header/Balances，无GameResult且现金保持。cluster_awards每个位置奖额只加一次=Logic totalWin，现金=start-50+奖；ReelSpin.spinWins固定0，不当消除奖总额。',
            'bounds':'自己的完整文件SHA核验，前1000中994普通完整/1988请求，6个旧免费触发直接EndGame拒绝；不续局、不信用历史。实际codec→独立PY IPC→record/verify；Init仅synthetic限定能力形状，无真实Init/native scope/livecanary/当前队列准入。未知传输一次封存、不retry/resend。',
            'files':['scripts/runner-v2/ag-rolling/sg-cooljewels-base.mjs','scripts/runner-v2/ag-rolling/sg-cooljewels-source.mjs','scripts/runner-v2/ag-rolling/sg-cooljewels-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/cooljewels_base_fields.py','config/ag-rolling-cooljewels-base-contract.json','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'ReactorChain':'1733个普通layout/1466个cluster自身证据，961种drop/root/watermark/award组合、730种位置文本、94种root/位置组合；位置0..5×0..5，奖数与唯一位置数一致。未知形状拒绝。',
                'Stake / ReelSpin':'实际下注50/multiplier1；单spin0/reelset0、6stops、winCountPL0/SC0、spinWins0/freeN/bonusN，不能借Payline奖额逻辑。',
                'MaxWin_Info / Balances':'maxWinValue25000000只是上限，maxWin必须false/cappedWins0；现金双验，End不再加奖。'}})
    elif game_id == 32757:
        native.update({'family':'cheshire-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32979与WMS Header20132分别绑定；自身AccountData/CurrencyMultiplier1→Header→Stake.total240/lines40，响应stake240/stakePerLine6/paylineCount40分别核验。',
            'continue':'只已观察的普通单Logic：spin0/reelset0，freeN/bonusN/scatter0，mysterySymbol1..10、isMaxWin0及固定maxWin25000000。没有readyForEndGame字段，不借其它游戏的ready门。未知Feature/FS/恢复停止。',
            'complete':'完整普通Logic后唯一Header-only EndGame；响应严格Header/AccountData/Balances且无GameResult，现金保持。Payline奖額之和=spinWins=Logic totalWin=BG累计，现金=start-240+奖。',
            'bounds':'离线候选：自身全文件SHA核验，前1000均为完整普通路径/2000自己的历史请求，经actual codec→独立Python IPC→record/verify一致，不是原生目标信用。0免费覆盖。Init仅synthetic限定能力形状，真实Init/native scope/livecanary/当前队列准入0。未知传输单次封存、不retry/resend。',
            'files':['scripts/runner-v2/ag-rolling/sg-cheshire-base.mjs','scripts/runner-v2/ag-rolling/sg-cheshire-source.mjs','scripts/runner-v2/ag-rolling/sg-cheshire-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/cheshire_base_fields.py','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'Stake':'实际总下注240、lines40、CurrencyMultiplier1；运行目录ID32979不同于WMS Header20132。',
                'PaylineWin':'最多40唯一线0..39、30种自身awardIndex/table0，104种自己的3..5位置文本；位置编号0..19，未知形状拒绝。',
                'BGInfo / Balances':'mysterySymbol1..10，MaxWin上限字段固定25000000但isMaxWin必须0；BG累计与每帧现金双验，End不再加奖。'}})
    elif game_id == 32756:
        native.update({'family':'celestial-base-wms-v1','messages':['Init','Logic','EndGame'],
            'start':'目录runtime32978与WMS Header20210分别绑定；首Logic自身AccountData/CurrencyMultiplier1→Header→Stake.total100/lines30。响应stakePerLine3×30不是实际总下注，不能改成90。',
            'continue':'仅普通单Logic，ReelResults/BGInfo且baseGameSpinsRemaining0、固定WildIndex11重复五项；本游戏没有readyForEndGame字段，不借其它游戏的ready标记。HNS/Feature出现立即拒绝。',
            'complete':'普通完整Logic后唯一Header-only EndGame；响应无GameResult且现金保持。每帧会话/计时/XML/observer余额、Payline奖额和、Logic totalWin与BG累计双验。',
            'bounds':'离线候选：自身全文件SHA核实，前1000旧历史仅994普通完整/1988请求沿actual codec→独立Python IPC→record/verify一致。6条bonus0旧记录含HNS剩余3次却已EndGame，仍拒绝、不继续/重放/回计。真实Init/native scope/livecanary/当前队列准入均0。新HNS、WildIndex、奖项、MaxWin、恢复或未知传输停止。',
            'files':['scripts/runner-v2/ag-rolling/sg-celestial-base.mjs','scripts/runner-v2/ag-rolling/sg-celestial-source.mjs','scripts/runner-v2/ag-rolling/sg-celestial-codec.mjs','scripts/runner-v2/ag-rolling/sg-task-runtime.mjs','service/celestial_base_fields.py','service/ag_rolling_plan.py','scripts/runner-v2/record_fields.py','service/round_fields.py'],
            'fields':{'Stake':'请求total100/lines30；响应stake100/stakePerLine3/paylineCount30分别核验。',
                'ReelResults':'单spin0/reelset0、5停点、最多12唯一Payline线0..29及自身25种awardIndex，奖额之和=spinWins=Logic totalWin。',
                'BGInfo / Balances':'remaining0/maxwin0、BG累计等于本Logic奖，现金=start-100+奖；EndGame保持。',
                'HNSInfo / Feature':'自身6旧半局hnsSpinsRemaining3，即使bonusAwarded=N、旧bonus0且旧End cash稳定仍不能完整。'}})
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
    for key in ('32749','32750','32751','32752','32753','32754','32755','32756','32757','32758','32759','32760','32761','32762','32763','32764','32765','32766','32767','32768','32769','32770','32771','32772','32773','32774','32775','32776','32777','32778','32779','32780'):
        # These specific WMS adapters have their own documented boundary.
        # A card grants no source permission or live admission.
        if key in rolling:
            plans[key] = rolling[key]
    for key in ('32588','32666'):
        if key in rolling and rolling[key].get('zeroAbpmContract')=='nextgen-zero-abpm-base-v1':
            plans[key]=rolling[key]  # A documented offline boundary grants no source permission.
    if rolling.get('32595',{}).get('automaticTerminalContract')=='nextgen-moneyraid-terminal-evidence-v2':
        plans['32595']=rolling['32595']
    for key in ('32708','32715'):
        if rolling.get(key,{}).get('ownTerminalContract') in ['nextgen-own-terminal-evidence-v3','nextgen-own-terminal-geometry-v4']:
            plans[key]=rolling[key]
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
        if gid in (32708,32715) and plan and plan.get('ownTerminalContract')=='nextgen-own-terminal-evidence-v3':
            rule={**rule,'family':'nextgen-own-terminal-evidence-v3',
                'continue':'仅新 v3 marker 使用自身终局证据；其余前缀沿原 automatic-free 续接规则。逐帧请求、会话、金额和 XML 独立双逻辑校验。',
                'complete':('32708：FID2|、NFG0、parent total3，前一帧2|0|，FGTW增量严格一致且没有嵌套剩余免费。' if gid==32708 else '32715：FID2|、NFG0、total1，MINI wheel stop仅0|/7|；直接BET或已完成免费后转盘，FEAT_WIN/WHJPM/FGTW与实际奖额严格相等。'),
                'bounds':'隔离候选，未获得新线上采集许可。4/5个自身完整终局及各100条历史通过真实 codec/Python IPC/record/verify；历史原记录不重写，旧 marker 仍拒绝新增终局。未知玩法、未完续接和金额异常停止，不默认 bonus0；不代表全部特殊玩法覆盖。',
                'files':rule['files']+['scripts/runner-v2/ag-rolling/sg-own-terminal.mjs','service/own_terminal_fields.py','config/ag-rolling-own-terminal-contracts.json']}
        if gid==32708 and plan and plan.get('ownTerminalContract')=='nextgen-own-terminal-geometry-v4':
            rule={**rule,'family':'nextgen-own-terminal-geometry-v4',
                'continue':'新 v4 marker 独立绑定前一 v3 计划与完整证明；旧 v3 和未标记记录继续原校验，不改历史数据。',
                'complete':'FID2|、NFG0、TFG=CFGG=3；前帧2|0|且FGTW按CW相等递增；CPDO=-1、AGS=7、没有SNFG/STFG/SCFGG。MZ是区域坐标与尺寸：仅已证实2/3，坐标为整数且完整落在7x7内。金额、XML、会话逐帧双逻辑校验。',
                'bounds':'离线候选，尚未激活。自身客户端字段解析与1个新MZ3完整终局、旧终局及普通历史回归；其他尺寸和未完玩法仍拒绝。未知状态不放宽、不默认bonus0，不能重播旧失败请求。',
                'files':rule['files']+['scripts/runner-v2/ag-rolling/sg-own-terminal.mjs','service/own_terminal_fields.py','config/ag-rolling-terminal-geometry-contract.json']}
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
        if plan and plan.get('adapter') == 'cooljewels-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + sum of all ReactorCluster.cluster_awards','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'总下注50/multiplier1；自己的ReactorChain terminal零cluster和award sum/cash双验，唯一EndGame确认；ReelSpin.spinWins固定0。'}
        if plan and plan.get('adapter') == 'crystalforest-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + sum of all Cascade.PaylineWin awards','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注25/25线；逐级联奖额/赢线数/mask位集合一致，末零奖Cascade和唯一EndGame确认；未知Feature停止。'}
        if plan and plan.get('adapter') == 'kingbabylon-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own Payline sum','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw','required':'下注200；own goldenWildA/B joint；Payline只加一次；readyY后唯一EndGame/readyN/空AccountData现金保持；特殊停止。'}
        if plan and plan.get('adapter') == 'jinsedragon-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own AnywayWin sum + winning nonjackpot Orb sum','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw','required':'下注100；own BG/Orbs joint；只计中奖Orb一次；readyY后唯一EndGame/readyN/空AccountData现金保持；未知特殊停止。'}
        if plan and plan.get('adapter') == 'jinjitreasure-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own AnywayWin sum','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注16；own MysterySymbol/ScatterInfo joint只形状；唯一EndGame/空AccountData现金保持；未知特殊停止。'}
        if plan and plan.get('adapter') == 'jinjimegaways-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own AnywayWin sum','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注88；own reel-height/TopReelInfo/空SymbolGrids、ordinary readyY→唯一EndGame readyN/空AccountData现金保持；未知特殊停止。'}
        if plan and plan.get('adapter') == 'moolah-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own Cascade PaylineWin sum','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注25；自己的283完整Cascade链与普通后唯一EndGame空AccountData、现金保持；未知特殊停止。'}
        if plan and plan.get('adapter') == 'hulahula-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own PaylineWin sum','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注100；自己的普通后唯一EndGame含空AccountData、现金保持；20种reelset/stackedSymbol仅形状，未知特殊停止。'}
        if plan and plan.get('adapter') == 'himalayas-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own PaylineWin sum','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注200；自己的普通后唯一EndGame含空AccountData、现金保持；42种reelset/clump/avalanche仅形状，未知特殊停止。'}
        if plan and plan.get('adapter') == 'hercules-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own PaylineWin sum','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注100；自己的普通后唯一EndGame含空AccountData、现金保持；55种line/reelset/wild/wildBonus仅形状，未知特殊停止。'}
        if plan and plan.get('adapter') == 'heidibier-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own PaylineWin sum','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注75；自己的普通后唯一EndGame含空AccountData、现金保持；129种Myst/Wild/RD仅形状，14个FSInfo特殊停止。'}
        if plan and plan.get('adapter') == 'goldenchief-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own PaylineWin sum','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注100；自己的普通后唯一EndGame只有Header/Balances、现金保持；21种线数/wild/upgrade仅形状，13个BonusWheel特殊停止。'}
        if plan and plan.get('adapter') == 'giantsgold-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + both own ordinary spin awards','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注50；两次ordinary spin之后唯一EndGame含空AccountData且现金保持；Clump/Wild只验联合形状，不再次加奖。'}
        if plan and plan.get('adapter') == 'fudaole-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own AnywayWin sum','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注200；自己的普通后唯一EndGame含空AccountData、现金保持；MysteryRepSymbol只验形状，8个FreeGame/PickGame/RedEnvelope停止。'}
        if plan and plan.get('adapter') == 'frozeninferno-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own Payline sum','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注5000；自己的普通后唯一EndGame仅Header/Balances、现金保持；WildData只验形状，323个FreeGames停止。'}
        if plan and plan.get('adapter') == 'firequeen-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own Payline sum','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注50；自己的GameWinInfo.isEndGameY后唯一EndGame/空AccountData、现金保持；普通可省略Wild文本，11个FreeSpins停止。'}
        if plan and plan.get('adapter') == 'eurekablast-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own Payline sum','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注50；自己的readyY→readyN唯一EndGame/空AccountData，Payline奖和与现金一致；普通reelset0或1、Dynamite/FS停止。'}
        if plan and plan.get('adapter') == 'deepseamagic-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own Payline sum','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注200；自己的readyY→readyN唯一EndGame/空AccountData，Payline奖和与现金一致；BonusSymValues只形状、DL/FS停止。'}
        if plan and plan.get('adapter') == 'dragonspin-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own Payline sum','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注210；Payline计数/奖额/位置、BonusBet0与MSReplacement形状一致；自己的Header/Balances EndGame确认，特殊停止。'}
        if plan and plan.get('adapter') == 'jekyll-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own Payline sum','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注100；普通reelset0/1、Payline计数/奖额/位置一致，bonusN/scatter0；自己的Header/Balances EndGame确认，特殊停止。'}
        if plan and plan.get('adapter') == 'desertcats-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + own Payline sum + QuickHits.winValue','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注200；自己的Payline计数/奖额/位置和QuickHits/Symbol/WildReel联合形状一致；唯一EndGame确认，未知特殊停止。'}
        if plan and plan.get('adapter') == 'drumsexplosion-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + sum of own AnywayWin.winVal','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注176；自己的AnywayWin计数/奖额/ways tuple/位置与BG替换形状一致；readyY后唯一EndGame readyN确认，DecisionInfo等未知特殊停止。'}
        if plan and plan.get('adapter') == 'dancingdrums-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + sum of own AnywayWin.winVal','bet':'stakeRaw / 100','mul':'Logic totalWin / stakeRaw',
                'required':'下注528/Stake.paylineCount1；AnywayWin奖额/计数/ways tuple/位置一致，唯一EndGame确认；UPicksDecision等特殊停止。'}
        if plan and plan.get('adapter') == 'cheshire-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + ordinary Logic totalWin','bet':'stakeRaw / 100','mul':'ordinary Logic totalWin / stakeRaw',
                'required':'总下注240/40线；普通未知形状拒绝，Payline sum/spinWin/Logic/BG/现金一致，唯一EndGame确认；自身没有ready字段。'}
        if plan and plan.get('adapter') == 'celestial-base-wms-v1':
            card['parameters'].update(wmsGameId=plan['wmsGameId'])
            card['settlement']={'stakeRaw':'startBalanceRaw - final CASH_BALANCE + ordinary Logic totalWin','bet':'stakeRaw / 100','mul':'ordinary Logic totalWin / stakeRaw',
                'required':'固定实际100而非90；普通无HNS/Feature，奖额和/BG/每帧现金一致，唯一EndGame确认；没有readyForEndGame字段。'}
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
