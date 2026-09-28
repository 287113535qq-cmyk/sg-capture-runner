# 第二账号完全独立的 20 Runner 检查

按用户本次排查要求，[运行 36411958007](https://github.com/287113535qq-cmyk/sg-capture-runner/actions/runs/36411958007) 使用第二仓库原 `trial-300k.yml` 的新 `role=runner-check`，代码版本 `05b8c38a4477131558051b026e691e936a5c2fec`。2026-09-28 10:49:18 UTC 创建，10:59:49 UTC 以 failure 结束。

## 结果

- 请求 20 个 `ubuntu-latest`、`max-parallel=20`。第一仓库没有活动任务，第二仓库只有此检查；这不排除协作者不可见的账号其他负载。
- 显式诊断等待由 180 秒延长为 600 秒。启动后本地分片 0、1、2、3、4、6、7、11、15、17 共 10 台进入检查；10:49:27 日志已记录这 10 台，后续快照保持 10 个运行、10 个排队。
- 10:59:34 起第一批报告 `RUNNER_CAPACITY_NOT_READY`；第一个 job 于 10:59:35 结束。后 10 个 job 从 10:59:37 起获得 Runner，随后因前面的 job 已失败退出。最终所有 20 个 checkout 成功，但没有 20 台同时通过门槛。
- 没有 `RUNNER_READINESS_HTTP_403`、429 或网络超时导致的退出；失败分别为等不齐 20 台、或同组已有失败。
- 诊断步骤只 checkout 和读取 GitHub jobs，没有采集 Secrets、SSH 配置/连接、游戏分配、SG 请求或采集存储写入。`verify` 被排除，因此此次检查不会因共享 campaign 已暂停而关闭手动入口。

**延长等待和脱离共享游戏都未解决本次第二账号的 20 台集体启动。** 证据将阻塞定位在 GitHub Runner 分配/排队阶段，不能归因于本机网络、SG、Mongo 或两个账号共用游戏。这里的 10 是本次观测值，不是已证实的永久账号上限；GitHub 没有向本次任务返回内部调度原因。

## 已完成和仍未解决

已增加可复现的独立检查入口，隔离了启动故障，并保留 20 台门槛；6 项 readiness 单元测试通过，workflow 的 20 台矩阵、只读诊断权限、无 Secrets/SSH/采集步骤以及排除 verify 已解析核验。正式采集等待仍为 180 秒，未降低分片数。

第二账号的 20 台并发分配尚未恢复。当前协作者无账号管理权限，不能代查拥有者的账号验证或平台内部限制，也没有扩大权限、更改收费或创建额外账号。若需要坚持两组各 20 台，第二账号拥有者须核实账号提示/其他任务，必要时请 GitHub Support 检查本次运行的并发分配。支持内容已准备如下，但没有代用户发送：

> Public repository 287113535qq-cmyk/sg-capture-runner, run 36411958007, requested 20 standard ubuntu-latest matrix jobs with max-parallel 20. This isolated test only checks out code and reads GitHub Actions job states; it does not contact our capture server or any game service. Ten jobs reached the startup barrier; the other ten remained queued throughout a 600-second wait and started only after the first jobs exited. All twenty jobs completed checkout. Please investigate account verification, other account workloads, concurrency allocation, or runner scheduling restrictions. We are not requesting a paid upgrade or a budget change.

[GitHub 并发文档](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency) 和 [Actions 限制](https://docs.github.com/en/actions/reference/limits) 描述账号范围的并发和平台限制，并不保证立即分配所有请求的 Runner。删库重建或更换游戏没有解决当前排队的证据基础。

两账号分配不同游戏在技术上可改造，用来隔离单款协议暂停；具体设计见 [分游戏审查](secondary-independent-games-review-20260928.md)。本次未实施该迁移，它不会改变本次 Runner 分配结果。32714 原始记录和 pending 保留，协议问题仍待适配；已完成 6 款保持不变，没有新采集。

## 留存与结束状态

完整 run 元数据、22 个 jobs（含 20 个矩阵任务和 2 个 skipped 占位/verify）、全部日志 ZIP、检查期间快照已在私有目录归档，ZIP CRC 验证通过，每个文件有 SHA256。归档 `secondary-isolated-36411958007.tar` 的 SHA256 为 `8aa727cd6124359feda4226a0a0e991b6a7f275129ba72141e2678a61f4bf6e0`。GitHub 运行保留，未删除或自动再派发。

归档已复制到服务器私有 reviews 目录，文件 fsync 后再次核对 SHA256 与本机一致。

结束后两仓库无活动/排队运行；原 workflow 为 disabled_manually，第二 workflow 为 active 保留手动入口，两边 `SG_TRIAL_ENABLED=false`。未部署 runtime、未应用恢复 proof、未修改游戏队列或采集开关。脱敏机器结果见 [结果 JSON](secondary-isolated-runner-check-20260928-result.json)。
