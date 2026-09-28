# 32711 HTTP 502 后的受控恢复

原组正式运行 `36399061495` 已将 32651 和 32704 分别采至累计 300000 局并通过全量终审。随后在 32711 Hoppily Ever After 的分片 15 BET 请求遇到 HTTP 502。暂停边界有 12638 个完整记录、12561 个已落盘记录、77 个待持久化记录和 4 个未完成大局。

依据用户已授权的异常大局处理方式，新增仅适用于本次运行和 32711 的 operator-only 清理配置。它绑定 4 个 pending 原始摘要，其中 HTTP 502 的 BET 结果继续记为 unknown，归档为 abandon_without_replay，不能据此重发原 BET。完整旧记录、目标和会话绑定均保留。代码提交 `b8adb53d81dc7846762ca4c3d8f7f4f4482101fe`，Windows/Linux 各 12 项清理测试通过；线上 current 仍为 `7463e7fd1bf4736c8f5fcdd3280a8a3656d28cc3`，operator 代码独立部署在私有 review 目录。

在两仓库没有活动采集、原租约过期后，全量检查并私有备份 queue/pool、146 个批次、日志及文件，使用 proof `a15c895705a748bd9a81f25913171d7c5881f5632afbff7dc20c349667e919b2` 应用一次清理，不能重复应用。清理 4 个未完成 attempt，完整记录删除 0 条。

[短采 36403281535](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36403281535) 成功，20 个 worker 各完成 10 局，共新增 200 局。4 个替代大局使用新 attempt 完成；77 个待落盘记录补齐。随后全文核验原始数据、标准化字段、哈希、文件、SQLite 和 Mongo：12838 局完全一致，12638 个旧完整记录逐条不变，pending=0，原 20 个会话绑定及额度不变。加 100 条已核验历史为 12938/300000。

本次核验辅助脚本曾在已持有 trial.lock 时调用再次加锁的 dispatch 而等待；仅终止该只读核验进程，改为在已有锁内调用审计实现后重新核验成功。一次本机 SSH 连接重置未中止远端核验，最终以服务器持久化回执确认结果。此问题未修改采集运行代码或源端请求。

核验通过并确认两仓库无活动任务后，已派发正式续采 [36405044999](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36405044999)，`allocation=round-one`、`round_one_limit=0`，原组 `SG_TRIAL_ENABLED=true`。第二组启动未通过，仍暂停。队列此时 complete5、active1、ready17、needs-adapter155；未完成整个 178 款第一轮目标，第二轮保持关闭。
