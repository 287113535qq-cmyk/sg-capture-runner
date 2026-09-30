# 32795 网络未知请求结案与继续采集

2026-10-01 01:43 北京时间，无源维护 36752023895:1 在固定准备版本 49c08f70cf37549ec2329565fdfcfb91b515ec51 成功结束。304 批次、25,392 完整局经 GitHub Python 校验及 Mongo 全文读回；896 待写全部补齐，14 中断局私有归档作废，其中1局请求结果未知。pending/待写/reserved 均0，原完整数据、旧已结算批次、activation、300000目标及所有已应用许可保留。

closeHash 0601194c295e31143ce5e78ac75a594bac947b25dc999009099e26dac7340269；retirementHash 3db17615723e5b3ad02c81ab84c8359fa7c010d7130881242a5e19a81fbc5a9c。仅原精确故障 hold 在结清及最终读回后解除，两组 hold=false。维护源请求0、未新增BET许可。

源36744028113:1结束前实际新增22,796完整；累计25,392。新样本中已出现自然17帧免费完整链，经过独立全文校验；不能把它扩称所有玩法均覆盖。网络根因仍未唯一确认。

维护从创建至结束675秒，包含25,392条的在线完整校验及304批次处理。17:43:00Z维护结束→17:43:47Z源36753473985派发，间隔47秒；原main固定5c513a6f55dfaccfc0e5e8f13b30ab7c3ab18c7a及formal-repair-pearl-awards-20261001.json继续使用。正式准入已成功，20分片使用新会话，目标剩余274608；报告时仍需观察实际产出，不能把派发当已完成。累计完整游戏仍14/178。

私有准备81文件17622404字节，两端SHA11f8969b767b68511495dd1b0d2ace8ddfeff84b91d8c17fab036961c502b05c；增量结案26文件259114字节，两端SHAcb2ae02e97878e0d71630e4813a45029afbd0f81ef25b7dba1bca7d269cc9161。增量引用原样本，未重复上传25,392全文。准备包原整体传输超时后采用256KiB分块、逐块hash读回及完整清单验证，传输原因单独记录，不归为GitHub排队。维护logSHA9f8b7d6f86ce9650b854b6c2f81e84768587fc388b6078ad1d3d1e4da6137249。

下方为准备时证据，计数及执行状态以本段为准。


源运行 36744028113:1 已失败结束，固定采集版本仍为 5c513a6f55dfaccfc0e5e8f13b30ab7c3ab18c7a。worker19 的 SOURCE_NETWORK_OUTCOME_UNKNOWN 触发共同保护；其他已采 worker 为 GLOBAL_SOURCE_STOPPED，worker13 在源请求前 GATEWAY_DISCONNECTED。底层网络根因尚未唯一确认，不重发未知请求。

只读现场：304 batch，24496 Mongo、25392 已持久化完整，896 待补写，14 中断（1 请求结果未知）。25,392 条经独立 Python 全文校验，24,496 条 Mongo 全文一致；Runner 与 Python 记录聚合 hash 均 bfb88a474f8784910b34aef7dc7d36ce473acddb1ad75d7ec82b43169935ce34。

新增无源结案入口复用现有有界分页退休、Mongo 全文读回、计数结算。必须等待源 run 全部结束及所有租约过期，绑定精确 hold、全部 batch、原 count-run 和原 activation。完整记录先补写，半局私有留样后标明 unknown/interrupted-abandoned，不续接。最后才释放同一 hold；改变的 hold、Mongo 冲突、半完成阶段仍拒绝。原 target、sequence、activation、已应用 profile 均保留；本维护不签发新 count-run、不授新 BET。后续需独立鲜读准入及新会话。

本地 10 项维护专项、3 项 Hard Hat 隔离专项通过。32714 未知玩法分类已接实际 capture→Python→controller 留样测试；金额错误仍共同停采。当前这里只记录准备，不能当线上已补写或恢复。
