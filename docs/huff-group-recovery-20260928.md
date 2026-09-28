# 32714 分组恢复及短采结果

2026-09-28 13:02 UTC，已部署 `a6ff8951b49296ade47d3269d396239f5b900023` 并实际应用新的分组恢复 operator。Windows/Linux 全量各 190 项 Python 测试通过。恢复前两仓库无运行或排队任务，两组租约均已结束；完整备份两组数据库和文件，核对已有记录、Mongo 全文、计划、会话及 pending 摘要。恢复只开放 primary；secondary 的 32717 协议现场逐条保持不变。

恢复 proofHash 为 `658e63fa6571d52a7bb4cf5a58e27ad3ba822536db4f98c924257374b81faca6`，备份 manifestHash 为 `4a0f856ca6ab70431bd8aa85e1c88ca91a8c2254e4121c39cbf12131dd1b4165`。原 failure 与完整现场保留在私有 `reviews/huff-group-recovery-20260928-backup`。此 proof 已应用一次，不能重跑。原先协议退出错误升级的共同暂停也在此证据审查内解除，真正的共同磁盘/存储/源端保护仍然有效。

随后执行原 workflow、`allocation=round-one`、`round_one_limit=10` 的[短采 36425867764](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36425867764)。20 个 capture 步骤全部进入执行，10 个 job 成功、10 个因协议停采或停止传播结束。成功 job 数不能代替完整局数，也不能据此称短采通过或 20 台持续并发。

本次新增 **101 个完整日志记录**，32714 累计新采完整日志为 **103**，此前两个完整记录保持原样。短采期间 batch4/worker13 的一个普通 BET 进入 Money Mansion；随后的成功 FREE_GAME 返回 FID2、NFG6、FEAT=MMANSION，表示转入尚未实现的 Touch Up。官方客户端将 FID2 命名为 TOUCH_UP_FS，与 32717 的 FID2 Wheel 不同。该帧已持久化，存储按 `HUFF_FEATURE_NOT_ADAPTED` 拒绝继续。

原 batch5/worker14/sequence402 的 Hard Hat 成功 BET 仍原样保留。其 worker 的源请求数为 0：它开始接续前，同组的新触发已使组暂停。因此本次**没有完成原 Hard Hat 的真实结算验证，未恢复正式续采**。两处 pending 均没有未知在途请求，不能通过删除正常自然触发或重发 BET 来绕过适配。

GitHub 元数据、22 个 jobs 和完整日志 ZIP 已核验 CRC/SHA256，在本机和私有服务器双份留存。归档 SHA256 为 `62a32e05475433a5eff449fb350c423f119a88d5c36f4f97ae2237c2a26dcc1c`，未删除 GitHub 运行。新停采现场的完整审查结果见 [机器回执](huff-group-recovery-20260928-result.json)。

后续需补足本游戏 Money Mansion 转入 Touch Up 的完整链，并一并核验同客户端其余命名免费模式及组合，避免把 FID 与当前 FEAT 混为一谈。新的映射必须保留既有普通/FID0/Hard Hat profile 和 hash。当前恢复 operator 绑定的是旧 2/1 记录、单 pending 现场，不能用于现在 103 条记录、两个 pending 的现场；必须使用新的精确审查和 proof。32717 仍保持独立暂停。
