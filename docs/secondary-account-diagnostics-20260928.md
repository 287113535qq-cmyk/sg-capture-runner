# 第二账号启动排除检查

检查时间：2026-09-28 09:52 UTC。第二账号为 `287113535qq-cmyk`，仓库为 `sg-capture-runner`。本次只读检查，没有再次派发采集或容量任务，没有改动权限、费用、Secrets、采集开关或等待期限。

## 已核实

| 项目 | 证据与结论 |
| --- | --- |
| 仓库状态 | public、非 fork、未归档、未禁用；没有发现需要删除重建的仓库状态问题。 |
| 代码一致性 | 两仓库 main 同为 `644a4adc28aa66187ac3bc24bbde1513f0a6e586`（本检查报告提交前）。 |
| CLI 身份 | 仅有 `zyzuoyang` 已登录；第二仓库 pull/push=true、admin=false。 |
| 同账号其他工作负载 | 公开仓库清单和当前协作者可见清单均只有该仓库，其所有可见 workflow 均无活动/排队运行。不能据此排除协作者不可见的私有仓库。 |
| 分片配置 | `ubuntu-latest`，matrix 0–19，max-parallel=20，工作流并发组作用于本仓库。没有将矩阵限制为 7。 |
| Secrets | 所需 4 个 Secret 名称均存在；没有读取或公开其值。 |
| 下载与依赖 | 最新失败运行的全部 20 个 capture job 均成功 checkout、配置 SSH 和安装依赖。 |
| GitHub API 权限 | Runner 日志显示 Actions: write、Contents: read、Metadata: read；等待期间成功取得 jobs 状态，没有 API 403/429 或 fetch 超时错误。 |
| 服务器链路 | 同一运行的 verify job 成功执行 Read aggregate confirmed count，证明该次 Runner 到受限 SSH/RPC 的状态读取成功。配置 SSH 的步骤本身不单独证明连接成功。 |
| SG 请求 | 全部 20 个实际采集步骤 skipped，sourceRequests=0。因此本次启动失败不能归因于 SG 请求超时；第二组游戏源会话尚未验证。 |
| GitHub 公共状态 | 检查时官方状态 API 显示 Actions operational、无公开事故。这不能排除特定账号或特定 Runner 池的问题。 |

## 排队时间线

[运行 36403634321](https://github.com/287113535qq-cmyk/sg-capture-runner/actions/runs/36403634321) 于 09:27:40 UTC 创建。前 7 个任务于 09:27:43–44 启动，本地分片为 1、6、8、10、11、15、17，随后进入等待步骤。

分片 11 日志在 09:28:02 记录 7 个就绪，09:30:59 报 `RUNNER_CAPACITY_NOT_READY`。等待期限 180 秒由仓库脚本设置，不是 GitHub 返回的账号限额错误。

第一个任务 09:30:59 结束；后 13 个任务最早从 09:31:00 起陆续获得 Runner，完成依赖安装后发现先前任务已失败，因此退出。分片 19 日志直接记录 `A capture runner failed before collective startup`，不是其自身网络错误。

按全部 capture job 的 started_at/completed_at 区间计算，交接阶段峰值重叠为 8；这与首次超时前 7 个就绪是不同统计口径。两者都不能证明账号永久并发上限为 7 或 8。实际未达到 20 台集体就绪。

## 未能核实的账号侧信息

Actions 管理策略和默认 workflow 权限两个只读接口均对当前协作者返回 HTTP 403。这里的 403 是管理信息读取权限不足；运行日志已证明 Runner 能读取 jobs，不能将这两个 403 当作采集失败原因，也不应扩大 CLI scope 来试探。

当前账号权限无法查看第二账号的邮箱验证、账号验证提示、不可见私有仓库和平台内部并发分配限制。需拥有者登录第二账号核实：

1. GitHub 页面是否有邮箱或账号验证、Actions 限制提示，以及其他私有仓库是否存在活动任务。
2. 若没有提示和其他负载，向 GitHub Support 提供本次运行链接及上述时间线，请其核查该账号的标准 Linux Runner 并发分配；不申请付费升级或改变预算。

可复制的支持说明（尚未发送）：

> In public repository 287113535qq-cmyk/sg-capture-runner, workflow run 36403634321 requested 20 ubuntu-latest matrix jobs with max-parallel: 20. Seven jobs reached our startup barrier before its 180-second deadline. The remaining jobs started only after the first group exited. All 20 jobs completed checkout and dependency installation, and the final SSH status-read job succeeded. Our barrier timed out; GitHub did not report an account-specific reason. Please check whether this account has a verification restriction, concurrency allocation restriction, or runner scheduling issue. We are not requesting a paid plan or budget change.

## 结论

现有证据将故障缩小到 GitHub Runner 分配/排队与本地 180 秒集体启动门槛之间，尚不能确定平台内部原因。没有证据支持删除重建仓库；不应通过降低 20 台要求、轮换账号、修改费用或忽略失败来掩盖问题。第二组继续暂停，原组独立运行。

参考：[GitHub Actions 并发限制](https://docs.github.com/en/actions/reference/limits)、[公开仓库标准 Runner 计费说明](https://docs.github.com/en/billing/concepts/product-billing/github-actions)、[GitHub 状态 API](https://www.githubstatus.com/api/v2/summary.json)。公开标准 Runner 免费不等于保证立即分配所请求的并发数量。

## 10:25 UTC 后续检查：手动 attempt2

用户在网页重跑了同一个 run，最新 `36403634321/attempts/2` 于 10:17:19 开始分配 capture job，10:21:15 以 failure 结束。必须区分此次 attempt2 与上文 attempt1。

- 日志在 10:17:41 记录本地分片 1、2、5、8、11、14、15、17 共 8 个就绪；180 秒后仍未达到 20 个。这里的 8 是本次观察值，不是永久并发上限。
- 全部 20 个采集步骤仍为 skipped，没有 SG 请求，也没有第二组会话采集验证。最早的 capture job 于 10:20:29 退出，剩余任务最早于 10:20:31 开始。
- verify 成功读取共享 campaign：complete6、active32714、paused。它按原 workflow 的保护步骤重新禁用了本仓库 workflow，因而手动入口再次关闭；这不是本机退出登录或仓库损坏。
- 排队的定时运行 `36408847012` 因 `SG_TRIAL_ENABLED=false` 全部跳过，没有采集。

随后核实两仓库均无活动/排队运行、两边定时变量均 false，按用户既有要求恢复第二组手动入口为 active，没有派发新运行。全局 source/campaign 保持暂停，等待 32714 协议适配。未删除本次运行、未改变 180 秒门槛、未调整账号权限或费用；同类已知容量问题不再重复派发验证。
