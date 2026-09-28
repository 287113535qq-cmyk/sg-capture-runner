# 32714 自然免费玩法停采审查

2026-09-28，原组正式运行 `36405044999` 完成 32711 Hoppily Ever After 的 299900 个新采大局并通过全量终审，加 100 条已核验历史达到 300000。当前队列 complete6、active1、ready16、needs-adapter155；活动游戏为 32714 Huff N Puff Money Mansion High Limit。

## 停采证据

32714 的 batch5 / worker14 / sequence402 普通 BET 返回完整成功响应，`FID=1|`、`NFG=6`。现有 `native-nextgen-v1` 适配器只接受零 FID，因此在 `frame`、`next_request`、`settled` 离线审查中均报 `UNKNOWN_TRIAL_FEATURE`；存储记录为 `PROTOCOL_VALIDATION_FAILED`，pool 为 `BATCH_HALTED`，campaign 为 `ACTIVE_GAME_REQUIRES_REVIEW`。

该 pending 只有 1 个 BET 响应，`awaiting=null`；没有未知源请求结果。原始 hash 为 `67d1e0dae3eab7e26ac6d5706798fc1ceef5b10f86d57e14e402e404952b47b7`，完整 pending hash 为 `004f77f474cdc5735605abc1825899ac2abce998a2968fb416ff74d665792562`。这次停采不是 HTTP 502 或第二账号的 Runner 启动问题，不应反复删除触发局来避开自然功能。

冻结计划仍为普通 buy0，目标 299900，实际下注 500 原始单位，请求 `AP=false, BPR=25, RB=5`。configHash、planHash、会话和额度均未改变。

## 官方缓存客户端证据

只读文件：`html5/huffnpuffmoneymansionhighlimit/js/app.js`，SHA256 `67bcebfd2f16477c8c3b2686b6e10b70f41bde3579d929e89e04e321ffa4e93d`。

- 第 2333 行：NFG 解析为 `qra`；第 2331 行将其赋给免费游戏剩余次数 `ib.Ye`。
- 第 2336 行：剩余免费次数存在且不是 replay 时，普通 spin 使用 `FREE_GAME` 请求。
- 第 2804、2822 行：该游戏配置自己的 BPR/RB 请求类并沿用上述免费 spin 路径。
- 第 2812 行：将 FID 数组的第一项和第二项分别保存为 `Jg` 和 `b2a`，不能无条件丢弃第二项。
- 第 3187 行明确列出 5 类：FID0=MONEY_MANSION_FS、FID1=HARD_HAT_FS、FID2=TOUCH_UP_FS、FID3=HOME_IMPROVEMENT_FS、FID4=MANSION_FS。GSD 的 FEAT 使用 MMANSION/HARDHAT/PAINT/HOMEIMP/MANSION。

因此本次响应属于自然 Hard Hat 免费玩法，下一步协议方向是 FREE_GAME；完整适配仍需核实整段状态迁移、组合 FID/嵌套功能、最后一帧余额和奖金，以及独立 bonus 类型映射。不能只移除通用 FID 防护，或把所有不同自然玩法静默映射为旧 bonus1。已有普通局和 FID0 历史局的映射 hash 必须保持不变。

历史小样本仅包含 100 个 BET、1 个 FREE_GAME，后者 FID0、NFG0；此前 ancillary traffic 审查没有发现错误，不等于覆盖全部自然功能。没有在缓存流量中找到本次 FID1 的完整成功链。本次没有发送任何官方 SG 请求，也没有声称新分支已适配完成。

## 私有保存与核验

服务器目录 `reviews/sg_r1_20260928_32714-run36405044999-stop` 已保存 queue/pool、批次 SQLite、原始/标准化文件、pending 和摘要清单，均位于 `/var/lib/sg-capture-runner` 的私有区域。manifest hash 为 `1259f7472a1a300db78ce98ca53803e361ac02553b7ca36d28ba1fb2d4560917`。

2 个完整记录的原始、标准化和内容摘要已核验；其中 1 个 durable 记录与文件及 Mongo 全文一致，另 1 个仍仅在持久日志中。1 个 pending 原样保留。删除 0、恢复应用 0、租约变更 0、额度变更 0。公开脱敏回执见 [审查结果](huff-natural-free-stop-20260928-result.json)。

原组 workflow 已由保护机制禁用，定时变量已设 false；campaign/source 均关闭。第二组手动入口依用户要求保持 active、定时变量 false，截至本次检查旧运行 `36403634321` 仍为 attempt1，没有新的手动采集。不要把第二组旧启动失败当成本次协议故障，也不要重用 32711/32651 的清理或恢复 proof。
