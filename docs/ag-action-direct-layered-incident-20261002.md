# Pyramids 首 BET 双层动作入口

真实运行36983664943:1已结束失败，固定版本a4708c41fc9cf263cc1ca8849d2c4c8d9357e0b5。最先停止的会话返回FLOW_TRIGGER，其余19会话随后GLOBAL_SOURCE_STOPPED。native checkpoint累计132093，本轮新增80500；这些是checkpoint计数，完整增量Mongo/receipt/Python审查尚未完成，不以该数字替代全文验收。

故障batch1499、sequence149023只有1帧BET，FID0|1|，内层NFG/TFG/CFGG=6/6/0，外层FGRS/FGTS/CFGC=10/10/0。旧流程入口禁止首BET带双层状态。这属于首帧组合缺口，不是陌生展示字段、不需要先解释新玩法或新增请求类型。

针对该唯一新首帧执行固定官方客户端已有route/counter/outro函数，得到FREE_GAME/Spin/isFinal=false/未结算；UI和wallet仍为桩，没有自然终局证据。未重放旧BET或请求旧会话。

Python与JavaScript增加明确opt-in的独立首帧检查，要求内外层均为正数初始计数且已完成计数为0。默认旧模式仍拒绝该首帧，已应用profile/runtime/contract保持不变。两端对实际1帧均返回FREE_GAME及非终局；合成内层结束→恢复外层→外层结束验证，以及跳帧/已推进外层/空外层拒绝测试通过。该opt-in尚未由新动作契约、capture入口或独立许可采用，不能宣布部署或复采成功。

本次运行不足10分钟即失败，不可作为10分钟资源稳定窗口或自动接力父运行。独立relay草案拒绝失败父运行；不能借用失败结果授予下一段。完整原文按分页保存，后续使用无源结清保留完整记录、归档中断，再独立准入新会话，禁止续旧局。

验证：10项Python流程测试、4项原动作字段测试、2项JavaScript流程测试、3项relay隔离测试及5项capture/冻结检查通过。源码报告只描述当前证据，不代表Linux预检、线上结清或全部效率优化通过。

补充真实增量审查：17段固定序号文件保存80500 Mongo/80500 receipt；逐条哈希相等并由独立Python按100条分页验证通过。运行20份final统计共81253完整，native批次journaled-checkpoint合计753，与未入库差额相等。1 pending、reserved1800尚未无源结清。合并全文超过Node字符串上限，已改逐段审计并完成，无需重读线上原文。该审查不写Mongo、不请求游戏，也不将待写753冒充已入库。
