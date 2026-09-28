# 两款协议恢复与会话拒绝现场

2026-09-29 06:34 北京时间核验。累计完成 **13 / 178 款**；32747 已完成正常全文终审。没有取消正常采集来制造维护窗口。后续 32820 / 32835 按原机制安全暂挂后，两组 ready 均耗尽，才执行本次恢复。

## 实现、测试和实际恢复

固定提交 `37a419a78aa03340f0b838ccf39016dddf811107` 实现 32836 独立 Foam Finger 协议及受控接续，并修正恢复备份必须使用 `{records: [...]}` Mongo 文档的约束。普通/FID0 原映射及计划、会话、历史、配额不变。规则、字段、未覆盖分支见 [Foam 协议](quarterback-foam-protocol.md)。

Windows / GitHub Linux 均通过 235 Python、40 协议 Node、74 Mongo v2 Runner、25 collector、TypeScript 和 3000 局离线夹具。Linux 预检 [36491605005](https://github.com/287113535qq-cmyk/sg-capture-runner/actions/runs/36491605005) 成功，无 SG 请求和数据库连接。32836 的 100 条历史链、110 帧及 42 个旧完整记录与旧规范化一致。测试不等于官方真实特殊玩法已结算。

| 游戏 / 组 | 实际恢复运行 | 已应用 proof | 完整记录 / 原 pending |
|---|---|---|---|
| 32739 / primary | [36492164377](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36492164377) success | `b5ba5397c644c4e611ce5aabea24f34986a1404e176f5c327b1c074b629159d3` | 164 / 6 |
| 32836 / secondary | [36491868052](https://github.com/287113535qq-cmyk/sg-capture-runner/actions/runs/36491868052) success | `9c82aee7541428ecc2b44d4b8158a0aa933ae6879cbf8e6609b4e377c08b4533` | 42 / 1 |

两次恢复均先保存私有完整快照、逐批旧记录和 proof，再补齐旧记录落库并全文读回；原 7 个 pending 未删除，源请求 0。上述 proof **已经应用，不能再运行 recover**。

## 短采的实际结果

同一提交分别执行 [primary 36492435648](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36492435648) 和 [secondary 36492439112](https://github.com/287113535qq-cmyk/sg-capture-runner/actions/runs/36492439112)，均为每分片最多 10 局的受控短采，最终 failure；未运行 validate / formal。

primary 共发出 3 个源请求：worker1 的 batch2/sequence115 和 worker6 的 batch4/sequence333 各沿原会话发送一次 FREE_GAME，均收到 `MSGID=ERROR / EID=ERROR_INVALID_SESSION`，完整拒绝响应已经追加到原 pending。worker10 的一次 INIT 成功响应也已持久保存，随后共同保护阻止下一请求。没有新 BET，没有完成新局，没有未知在途响应。

首个持久化共同保护是 primary 的 `SOURCE_REJECTED`，batch4。它不是新的 FID 未适配，也不能据此断言失效由固定超时时间、本机网络或 GitHub 分片容量造成。secondary 所有源请求数为 0，尚未发出原 pending 的 FEATURE_START；其失败来自共同保护，不是 Foam 结算失败。

原 206 条完整记录逐条与恢复前、现有不可变 receipt、Mongo 全文相同。32739 仍为 164 journaled / 164 checkpoint / 6 pending，32836 为 42 / 42 / 1；全部原响应前缀和 attempt 保留，两个拒绝只是新增尾帧。32739 的特殊 FID1 pending432 及 32836 的 Foam pending113 均未实际接续，真实特殊玩法结算仍未验证。

两仓库矩阵任务已全部结束、没有活动或排队运行。workflow 由短采 verify 保护性关闭，两个 `SG_TRIAL_ENABLED=false`；primary global-hold=true、secondary 自身 hold=false，但共同保护禁止两组源请求。队列 complete13 / active2 / parked-protocol8 / ready0 / needs-adapter155。状态标签 active 不表示正在采集。06:36:43 的后续只读快照仍为相同队列，全部 worker 租约已到期，磁盘约 143.48 GiB。

## 私有留存及下一步边界

停采完整快照在私有服务器 `reviews/protocol-short-session-stop-20260929/snapshot.json`，本机另有独立副本。规范化 SHA256 为 `3ae8a18988c418eba36c58e294310ff214080b1683374e8e5e87ebe53dcb46c1`。包含两组完整控制、池、批次、bootstrap、原始及标准化 receipt、official_rounds、恢复 proof/许可及原备份。逐条比对在本机离线执行，测试服只执行原生 Mongo 读取及文件备份。

6 个相关运行的元数据、全部 jobs 和日志 ZIP 已 CRC/SHA 核验，连同现场及恢复前副本私有归档；没有删除 GitHub 运行。最终完整归档 `protocol-runs-20260929-full.tar` 已在本机和服务器双份校验，SHA256 `9e5fbf7d26482f962faa05613c1bacd73270cca49882bfa8c3301a7f29d5d89f`。32747 正常终审也已生成真实观察日志，记录 299850 个新完整局、代码 `21a0ef3`，没有为补档额外重扫。

不能直接重跑：两个 campaign 的短采许可已分别绑定本次 run/attempt；primary 两个失败 pending 的一次性许可已经消费，其他 4 个及 secondary 的 1 个许可未消费。许可还绑定旧提交及有效期，改代码或新 run 均须新的证据绑定，不能复用旧恢复 proof、清除 runKey 或直接解除 global-hold。

下一次应针对**两个明确收到 INVALID_SESSION 的异常未完成 attempt**独立制定 Mongo v2 精确恢复；用户已有异常 attempt 私有备份后归档的授权，但不能把其他尚未请求的 pending 推断为会话失效而一并删除。原成功 BET 的结果不能移到新会话，不能重新发送。若重建新 attempt，须记录原异常归档和新身份；特殊玩法的真实结算要求仍保留。当前没有应用这次会话异常的归档或重启操作，也没有可复用的新事故 proof。
