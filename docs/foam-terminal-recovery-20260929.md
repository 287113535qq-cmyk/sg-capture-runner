# 32836 已收到完整 END 的精确结算恢复

该操作器仅处理 `36495948701` 的已保存完整 Foam 四帧，以及没有运行的32739接续许可重新绑定。原始现场见[前次结果](session-recovery-20260929.md)。不能重用已经应用的 session/protocol proof。

`terminal-recover / terminal-validate / terminal-formal` 仍在原采集 workflow 的 GitHub 维护 job 执行，无 SG 配置或请求能力。测试服仍只有受限 Mongo 原生读写。配置固定两组 campaign、pool、每批次、原许可、计划与实现文件摘要，并限定两小时有效。恢复前两仓库无其他运行/排队、当前组全部租约到期、CPU/内存/磁盘保护正常，状态必须与精确现场一致。

先执行 secondary：保存新 proof、完整原现场、原许可和逐批72条完整记录、双端解析产生的候选terminal记录，全部持久化确认后才改现场。batch1/worker23/sequence20 已有 BET/START/PICK/END，无未知请求；以原 attempt、sequence、raw、会话摘要生成唯一 receipt，不发送任何 END/BET。随后批量补写原10条积压和这一条新规范化记录，Mongo全文核验，应为73条。旧72条逐条不变；原batch2/worker21/sequence113仍保存原BET。完成后记录新许可及短采绑定，最后仅CAS解除此次明确FOAM_MISSING_END_COUNTERS共同hold。部分失败拒绝盲目重做。

再执行 primary：只能在本次secondary审查标记存在且两hold为false时，保留原164条完整与4个原pending，重新生成固定提交、原会话/worker/pending摘要的接续许可。此前2个明确失效attempt仍私有归档，绝不恢复或重BET。

新短采每组20个固定worker各10局；先secondary单独运行。验收应为secondary273和primary364条完整记录，全量readback、全部原记录不变、原Foam113和Demon432必须真实特殊结算。已离线结算的新Foam20不替代原113的接续验证。Demon两个替代attempt须与被归档的原attempt不同且在本次恢复后独立开始。一次性短采run/attempt及所有阶段固定同commit；validate后15分钟且现场hash未变才formal。

未知请求、拒绝响应、其他hold、租约活动、原始数据变化、余额/奖金不符或备份不完整都不能被本操作器清除。候选实现与离线测试本身不代表已经应用恢复；实际运行与proof在执行后记录。
