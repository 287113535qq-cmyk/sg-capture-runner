# 32795 网络未知请求结案准备

源运行 36744028113:1 已失败结束，固定采集版本仍为 5c513a6f55dfaccfc0e5e8f13b30ab7c3ab18c7a。worker19 的 SOURCE_NETWORK_OUTCOME_UNKNOWN 触发共同保护；其他已采 worker 为 GLOBAL_SOURCE_STOPPED，worker13 在源请求前 GATEWAY_DISCONNECTED。底层网络根因尚未唯一确认，不重发未知请求。

只读现场：304 batch，24496 Mongo、25392 已持久化完整，896 待补写，14 中断（1 请求结果未知）。25,392 条经独立 Python 全文校验，24,496 条 Mongo 全文一致；Runner 与 Python 记录聚合 hash 均 bfb88a474f8784910b34aef7dc7d36ce473acddb1ad75d7ec82b43169935ce34。

新增无源结案入口复用现有有界分页退休、Mongo 全文读回、计数结算。必须等待源 run 全部结束及所有租约过期，绑定精确 hold、全部 batch、原 count-run 和原 activation。完整记录先补写，半局私有留样后标明 unknown/interrupted-abandoned，不续接。最后才释放同一 hold；改变的 hold、Mongo 冲突、半完成阶段仍拒绝。原 target、sequence、activation、已应用 profile 均保留；本维护不签发新 count-run、不授新 BET。后续需独立鲜读准入及新会话。

本地 10 项维护专项、3 项 Hard Hat 隔离专项通过。32714 未知玩法分类已接实际 capture→Python→controller 留样测试；金额错误仍共同停采。当前这里只记录准备，不能当线上已补写或恢复。
