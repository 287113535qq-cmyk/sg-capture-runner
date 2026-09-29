# Luxor 32835 独立有界采集结果（2026-09-30）

本轮已实际切换到 Pyramids of Luxor 并完成 **100 新完整普通 buy0 大局**，20 个 worker 各5，全部 Mongo 全文字段读回通过。当前 trial 为182完整（原82全部保留），另有既有历史100独立保留。Beaver137和Demon446原样。没有新增中断、未知响应或待补写，原Luxor旧中断1条已在维护中私有留样作废，未续接。

## 运行与额度

固定源码 `6b7c90b9c394e4dc2d7a6b5fd11dd40f9147942e`：Linux预检36644050092、唯一无源维护36644441306:1、唯一实采36644841969:1全部success。新profile `config/demo-pilot-luxor-20260930.json` canonical `308018e257496dd02091d523b605e32d13c60b73227720f41076ff823e932375` 绑定325源码文件，已应用永久冻结。该一次100 BET额度全部用完，不重派、不刷新、不复用旧Beaver/Demon许可。

维护先验证Beaver已耗尽的残余许可及完整现场；调用通用退休将Luxor82完整真实校验、补写、Mongo全文读回后推进checkpoint，原半局分析留样作废。独立版本记录保全Beaver137及旧run许可，切换新demo代际；旧完整batch会话不变，新worker不接管旧batch。只有最外层切换complete也完成后，新的capture run才能获准20各5。所有写入/采集均由GitHub执行。

## 实际覆盖与完整性

新100=98 bonus0 +2 bonus1（旧独立FID0各一FREE），实际保存100 BET+2 FREE，不含INIT。这次没有触发自然FID2完整终局，不能把bonus1当bonus2，不能称全部玩法已验证或正式300000已放行。

真实Python核验765条当前完整（446+137+182）；Luxor182另经独立Runner/TypeScript全字段与旧新代际会话归属核验。原记录、journal及已冻结历史batch保持。新FID2终局/重触发仍只有合成证据，其他混合与切换分支保守隔离。

同一份新100/20会话实采数据离线执行投注窗口与官方free计数构造器、readyForNextSpin出口，100终帧+2中间帧全部与原完整链一致，额外SG请求0。UI及respin控制器是桩，未执行完整浏览器/main。此对照不能补足未出现的FID2覆盖。

## 耗时与效率

| 阶段 | 创建到首job | 创建到最后job完成 |
|---|---:|---:|
| Linux预检 | 4秒 | 107秒 |
| 无源切换、补写与作废 | 3秒 | 174秒 |
| 100完整实采 | 2秒 | 187秒 |

采集成功job中位162秒，20个worker内部计时中位77.1695秒，记录到的source累计中位422ms、gateway RPC累计中位5453.64ms。RPC含控制/解析/存储，source统计不含所有INIT；健康等待与解析CPU尚未单独测量，不把差额当CPU，也不能将并行耗时相加视为墙钟。

同100局离线微基准（30样本，每样本20轮）：旧识别中位0.581580ms/p95 0.608800，新窗口+客户端出口0.846625/0.990010ms。工作内容不同，无网络/Mongo，不代表线上吞吐提速；本次验证的是新游戏独立切换及分组结果可复用。未再为旧半局写恢复链。

## 安全收尾与后续

两source变量仍false，primary采集workflow由收尾保护disabled_manually，secondary active。全11pool及4trial的3155batch按nextBatchId完整读取；快照时0 worker未来租约、20 batch未来租约，不能说全部已过期。磁盘124.878GiB，两hold false。两个精确旧queued已隔离，不等待或重新诊断。

本次有限试点结束。下一款继续独立适配和有界准入，异常游戏进入独立待修队列；采集队列可跳过异常款，但当前没有ready款，repair任务不是自动修复器。正式完整计数activation/Python许可与规模分页仍缺，和本次100试点分开推进，不扩大已耗尽试点额度。

257 Python、530 Runner（新增实际campaign→controller→capture Luxor路径）、14入口专项、完整Linux/62协议/25collector/TypeScript/3000offline/178档案通过。首次本机Runner遗漏PYTHON环境导致6个调用命中Windows别名，显式解释器后530全过；未放宽规则。首次预检按SHA dispatch返回422未创建run，随后按已固定main唯一派发并核head。

私有准备18文件3490268bytes，SHA `dc9550fb1dc6d3e188dbdbfe9a1a081e644fbba1d46ef44fcf83177b8ebd8334`；最终36文件7108926bytes，SHA `c925de3115b31155d3ba135b9b09d4d8b4a527be72ccfb84a0e9c5ad5ac99762`，包括前后现场、审查、源码及运行metadata/jobs/logZIP校验。本机与服务器两端36文件均实际readback通过，准备18文件也双端通过；旧档案不覆盖。报告后4项冻结profile测试、6档案测试及178卡检查通过。
