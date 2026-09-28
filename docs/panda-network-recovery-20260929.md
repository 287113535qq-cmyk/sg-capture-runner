# 32833 网络结果未知与受控恢复

2026-09-29 04:06 北京时间巡检发现两个矩阵已停。32746 已完成新采 299850 局全文终审，加 150 局核验历史达到 300000，总完成游戏增加至 10 款。

第二组运行 `36472693926` 在 19:52 UTC 报告 `SOURCE_NETWORK_OUTCOME_UNKNOWN`。32833 Panda Pow 的 batch 81 / worker 38 / sequence 8004 保存了 BET 意图，没有响应；它仍属于未知结果，不能宣称下注失败或重发。20,493 个完整局保留，其中 19,800 个已落库、693 个待核验补写。唯一未完成 attempt 将依据用户既有授权，私有完整备份和精确 proof 核验后归档为 `unknown/abandon_without_replay`；新 INIT 后建立新 attempt，额度、会话绑定和有效完整局不变。

第一组 32739 The Demon Code 在运行 `36474147259` 触发 `UNKNOWN_TRIAL_FEATURE`，pool 进入协议暂挂流程。保留 164 个完整日志和 6 个已有响应的未完成局，均没有未知在途请求；错误局 batch 5 / worker 0 / sequence 432 已有 BET 和 8 个 FREE_GAME 响应。该游戏不能删除自然触发以绕开适配。共同保护解除后由既有协议暂挂机制保存现场，再继续其余 ready 游戏。

私有 Mongo 备份包含这两款的全部状态、日志及已落库全文，manifest SHA256 为 `d7870a8910a4892db498cee5f34e9ab7369a6ceed22d62f4c4c50bb577c55f71`。本机独立压缩副本逐文件核验通过，SHA256 为 `2974f3da210d12cf38f45cb93b74f394d33e2bc5e9004e5a11a520a5d9f290ee`。三个相关 GitHub 运行的元数据、完整 jobs、日志 ZIP 已留存并核验 CRC / SHA256；未删除 GitHub 运行。

新增 `incident-control.mjs` 只从 GitHub 使用 Mongo-only 通道执行本次精确 profile，不能代替通用自动丢弃。它检查计划、状态版本与摘要、批次/会话、无活跃或排队运行、租约过期和 proof 时效。先重放校验所有完整记录并核对 Mongo，持久保存原 failure / pending，再归档唯一未知 attempt，补写 693 局并全文读回。恢复后仅每分片 10 局短采，全部新旧记录核验和独立 formal 步骤通过才正式续采。资源和磁盘保护继续生效，原 SQLite 恢复脚本不参与。

同时修复共同停采记录：第一个 active hold 保留原原因，其他分片退出时的 `GLOBAL_SOURCE_STOPPED` 不再覆盖首个故障；新增安全的错误代码字段。它不改变触发停采的条件。

此文件首次提交时恢复尚未应用，源请求仍为 0；实际执行和短采结果随后补充。规则档案区分当前观察与完整覆盖，30 万局不代表观察到所有玩法。
