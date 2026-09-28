# 32836 Mongo v2 原局接续

本候选将 `protocol-recover / protocol-validate / protocol-formal` 扩展为两个**固定**场景。primary 保持 32739 的固定锚点；secondary 仅接受 `config/protocol-quarterback-20260929.json` 的 32836、4批、42完整局、1 pending 和全部原摘要。不是可由输入游戏ID执行的通用解锁。

恢复前读取两个仓库所有活动/排队运行、当前 attempt/jobs、两个 global-hold 及目标 campaign/pool/batch。目标组必须无其他运行、无活动游戏/终审/ready、目标租约全部过期；旧 parked 快照必须逐条一致。secondary 的恢复可与 primary 的**已确认正常 capture 矩阵**共存，不改 primary 文档或租约；另一组维护任务、未知/截断 job 列表、失败采集和共同 hold 均拒绝。primary 的 Demon 恢复继续要求两个仓库整体空闲，不抢占正常游戏。

所有决策在 GitHub 内执行；测试服仍为原 Mongo-only 入口。使用受限 SSH 确认的组权限，不能由 RPC 参数更改目标组。恢复不修改 plan/session/baseline/目标/其他游戏。独立 proof 绑定当前提交、快照、记录摘要和两小时有效许可。私有 journal 保存 proof、完整原快照、逐批完整记录及 backup-complete 后才改现场；逐批备份包装为 `{records: [...]}` 文档，符合 Mongo 原生入口约束，修正此前 Demon 候选的数组传输问题。旧固定 profile 的数据锚点未变，仅重新绑定候选代码摘要；此前未应用的候选没有被当成已应用恢复。

对 42 个旧完整记录执行原始/规范化/摘要复核、幂等落库、全文 readback。原 batch2/worker21/sequence113 的 pending 不变；一次性许可只能由原 worker/原会话消费，交回原采集循环，从 FEATURE_START 接续，不再 INIT/BET。新运行/attempt 不能额外消费一次性许可，任何未知在途或部分恢复失败拒绝盲目重做。

短采为同一提交的原工作流、round_one_limit=10。验收要求20个固定worker各新增10局，共242完整局全文审计；42旧记录完全不变，原 pending 的 attempt/成功 BET/会话不变且真正完成 START/PICK/END、bonus2。不能用离线合成链冒充此验收。只有验收后15分钟内且池/campaign摘要未变，formal 才解除短采限制。恢复、短采、验收、转正式期间不得切换提交。

本文件记录实现和检查要求。实际是否执行、运行编号和真实结算结果单独写入结果报告；配置锚点不是恢复 proof。当前原始证据仍保留，第二轮关闭。
