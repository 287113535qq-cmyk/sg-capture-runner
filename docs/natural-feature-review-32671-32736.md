# 第一轮两款未开始游戏的自然功能补充审查

2026-09-27 20:14 UTC 起，只读核对已保存的普通下注流量和官方客户端。当前采集仍因 GitHub 账户限制暂停，未再次派发 Runner、修改付费设置或调用 SG。

## 32671 Thunder Drums Samurai Storm

普通模板为 AP=false、BPL=5、LB=25，实际下注沿用已验证的 100 原始金额单位。保存的 traffic 第 47 行普通 BET 触发 FID=1、CFG=1、NFR_1=16；第 48 行 FEATURE_START 成功响应省略了 CFG/FS。FTV 包含多轮选项，每轮只有一次选择，和 32651 的同一轮多次选择不同。

只读客户端 `html5/thunderdrumssamuraistorm/scripts/ci_gdm_thunderdrumssamuraistorm_desktop.min.js`，SHA-256 `9f52bade9da5a47a71e0c8035383d7e801da187bb54c15fc2af4355ed87fbf7c`：

- 原文件第 794–795 行，游戏自己的 createFeaturePickRequest 覆盖通用实现，FP 为 `(已选择次数+1)|1|选项`，不能照搬 32651 的 `1|次数|位置`。
- 原文件第 816–819 行，选奖结束取决于 GSD 的 JACKPOT_AWARDED，再发送 FEATURE_END；不能仅用初始 NFR=16 强行选择满 16 次。
- 同一客户端处理 FID=0|1| 的免费局与选奖组合，部分触发会出现在 FREE_GAME 阶段，不能只检查最初 BET。
- 保存的普通流量没有足够的成功 FEATURE_PICK → FEATURE_END → 最终余额结算证据。下一步仍需核实选项编号、选择后的状态更新、组合局结算，并实现独立适配和验证。

## 32736 Squid Game One Lucky Day

普通模板为 AP=false、BPL=5、LB=10，实际下注沿用已验证的 50 原始金额单位。保存的 traffic 第 44 行 BET 触发 CFG=1、NFR_1=24，GSD FEATURE_ID=1；第 45 行 FEATURE_START 返回 RLGL_STEP=0，但 NFG=0。这里的 NFG=0 显然不是整局结束。

只读客户端 `html5/squidgameoneluckyday/js/app.js`，SHA-256 `2d3886a4aa6e2933676db592889674fa948a5b020321dc0594d2b18dbc3f352f`：

- FEATURE_ID 枚举含 TugOfWar、RedLightGreenLight、Picker、Bridge、BridgeFreeSpins 和 BuyPassRequest；最后一个购买请求不在第一轮授权范围内。
- 原文件第 2829–2830 行的 FP 元组仅第一个字段必填，后两个字段可以省略。RedLightGreenLight 分支把所选移动步数放入名为 round 的字段，不能将它机械理解为第几次选择。
- 状态还需要 RLGL_STEP、RLGL_DIED、RLGL_WON 等 GSD 字段；其他小游戏使用不同的选择和结束条件。
- 当前普通历史流量缺少成功完整小游戏结算链，不能默认 bonus=0，也不能套用 32651 的固定 15 格选奖适配器。

## 队列处理

这两款原先由小样本 BET/FREE_GAME 回放进入 ready，但补充流量已经证明适配不完整。本次增加 operator-only `campaign_review.hold_unstarted` 和只读默认的命令入口。只有 campaign 已暂停、游戏不活跃且从未创建 trial、没有新采进度、历史基线未变时，才允许将 ready 改为 needs-adapter。变更先在同一 SQLite 事务内保存原状态和证据摘要，重复执行保持幂等。

这两款仍属于第一轮，目标各 300000，历史计数与全部计划保持不变。待补齐协议及验收后，再通过受控迁移重新加入可执行队列。当前 32651 的三局恢复点和已完成游戏不受该操作影响。

证据清单见 [待适配证明](natural-feature-holds-20260927.json)。只读验证与实际应用结果会记录于 [队列审查结果](natural-feature-holds-result.json)。

## 实际应用结果

Windows 和 Linux 均通过 11 项相关测试，覆盖暂停要求、不能移动活动/已开始/已完成游戏、不能改变历史计数、批量操作不部分生效及幂等性。服务器先通过只读审查，并再次核对 32651 全部 233 条完整记录摘要及 3 个 pending 原始摘要未变，再备份 queue.sqlite3 并在事务内应用两款待适配标记。

应用后的控制器统计为：complete=3、active=1、ready=19、needs-adapter=155，总数仍为 178。目标、历史基线、会话和当前游戏原始数据未变，控制器与源请求开关仍关闭。原 runtime release 733dde4 保持不变，本次 operator-only 审查代码 1ee6121 独立存放于服务器 reviews 目录。没有新增采集请求，也没有重新派发被账户限制阻止的 GitHub 检查任务。
