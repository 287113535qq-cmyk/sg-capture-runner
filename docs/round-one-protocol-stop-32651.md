# 游戏 32651 的协议保护停采

2026-09-27 18:56 UTC 跟进检查发现，原运行 `36338315642` 已以 failure 结束。控制器已经完成 3 款游戏（包含此前已完成的 Book of Sevens），当前 Squid Game One More Game（32651）因协议适配缺口暂停。服务端仍为已经验证的校验优化版本 `2f9aa749f994b5297788aa57389c839d6b7ac195`。

## 实际原因

普通 BET 的第 424 局响应出现 `FID=1|`、`CFG=1`、`FS_1=0`、`NFR_1=1`。这是当前 BET/FREE_GAME 适配器尚未覆盖的自然特殊分支，`NativeNextgenFields.frame` 正确拒绝为 `UNKNOWN_TRIAL_FEATURE`，批次随后保留原响应并记录 `PROTOCOL_VALIDATION_FAILED`。不能把缺少 NFG 当成这局已经结束，也不能把未知类型默认写为 bonus=0。

本机历史 `traffic.jsonl` 中同一普通下注模板确有触发后 `FEATURE_START` 的成功响应；但现有已结算的 100 条 `rounds.jsonl` 未覆盖这一分支。旧流量还包含 FEATURE_PICK 被拒绝的记录，因此不能直接复制旧脚本的选项请求或把 FEATURE_START 当作完整结算。后续需要核实完整续局、最终余额与总赢额、自然特殊类型及其稳定 bonus 编号。

## 数据与停采状态

- 233 个已完成大局在 SQLite FULL/WAL 日志中；这 233 条均再次重放通过金额、字段和摘要检查。
- 其中 189 条已导出并推进 Mongo 检查点，本次逐条读回完整文档通过；其余 44 条仍保存在日志中，未冒充已经入库。
- 另有 3 个未结束大局：第 424、1015、1708 局。全部最后响应已保存，没有等待未知官方响应的请求。保留原会话、原局号及全部步骤。
- 原始数据及 20 个批次的数据库、已导出文件另存于服务器私有证据目录，详见 JSON 报告。未清除 halted 标记、未重发下注、未修改配额或完成数。
- campaign 保持 `ACTIVE_GAME_REQUIRES_REVIEW`，源请求已禁用。检查时 GitHub workflow 仍 active，现已将 `SG_TRIAL_ENABLED=false` 并禁用该 workflow，避免定时任务重复启动。第二轮保持关闭。

## 补充覆盖检查

新增只读检查器 `scripts/review-native-coverage.py`，从精确匹配已配置普通 BET 模板的历史成功流量中查找适配器无法处理的分支，不修改现有队列。24 款配置游戏中，32651、32671（Thunder Drums Samurai Storm）、32736（Squid Game One Lucky Day）均发现普通局自然触发的 FEATURE_START 分支。其他游戏未发现矛盾也不等于所有稀有功能均已覆盖。

3 项针对性测试通过：额外自然分支可发现；加注请求和被拒绝的 BET 不误当成普通流程；缺失或截断流量需要复查。结果见 [覆盖检查](native-coverage-review-20260927.json) 和 [停采证据](round-one-protocol-stop-32651.json)。

恢复前必须完成基于原始证据的协议适配与测试，以及保留旧失败记录、固定会话和局号的恢复机制。不得仅删除失败标记、切换会话、跳过这些未结算局或重新发送 BET 来恢复运行。剩余 153 款仍属于第一轮，协议适配工作可以继续离线推进。
