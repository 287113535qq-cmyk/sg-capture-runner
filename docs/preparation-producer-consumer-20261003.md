# 四条独立工作线

最新要求拆为准入、流程修复、协议分析、采集四条线。`protocol-analysis-worker.mjs`独立消费不可变报告，结构观察作为私有sidecar，不改原文、不授采集权限；语义未确认明确保留待分析。`capture-handoff-worker.mjs`仅生成持久化派发任务，实际采集仍由GitHub独立准入后执行。

曾尝试启动可访问GitHub并自动提交采集的后台进程，被自动审批返回`blocked by policy`，未执行且没有详细理由。未重试或换壳绕过；改为无网络、无子进程、无凭据、仅本机文件I/O的交接进程后启动成功。这个交接进程不等于实际采集已运行，线上自动消费完整库存仍待接通。

三个准备进程和一个交接进程已启动。当前固定处理器不能自动完成所有未知适配；阻塞项明确待差异证据，进程等待证据不能宣称正在修好所有游戏。

新款准入准备与异常修复分别运行，不等待彼此。本机只进行离线工作；GitHub继续承担实际准入、结清、采集和调度。

```powershell
$env:PYTHON='C:\Users\xxx\AppData\Local\Programs\Python\Python314\python.exe'
node scripts/preparation-worker.mjs --lane=admission
node scripts/preparation-worker.mjs --lane=repair
```

每条线在`.local/preparation-worker/<lane>`保存独立锁、inventory及检查结果；`--status`输出数量和活动项。任务按持久claim领取，单项失败不阻断后续项。中断未完成任务明确需要审查，不自动重放。完成17款从只读快照中排除；快照只用于离线建队，不授予线上操作权限。

当前固定处理器完成全列表特征复用索引，Very Fruity本机请求/持久化/准入检查，以及Inca独立修复检查。其他游戏缺差异证据时记录`ADAPTER_DIFFERENCE_EVIDENCE_REQUIRED`；这不是已完成适配，也不是自动修复。不能把进程存活或索引遍历称为全部游戏准入。

独立审查结果以`<gameId>-result.json`交付。只有路由、结算、持久化、本机、Linux、native六项证据完整的`sg-reusable-preparation-v1`才能进入prepared。修改代码或证据版本必须重新准备。没有新证据时等待，不重复失败测试。

`selectPrepared`消费prepared项，并要求独立版本核验和鲜准入回调；`GithubCampaign.preparedSelector`只能缩小原ready集合，不能将needs-adapter变为ready或授额度。实际源许可仍由既有独立控制器生成和核验。当前线上campaign-worker尚未启用此新回调，自动发布审查收据和完整线上库存消费尚待接通，不能称三进程线上链路已经完成。

单款协议故障沿既有park→repair→continue路径结清并接下一ready款；共享存储确认未知、资源或空间保护仍停采。有限试点不能通过切换队列变成正式30万许可。

验证：21项准备队列、campaign及continuation测试通过，覆盖双线独立、故障跳过、缺证据拒绝、过期claim、中断不重放、鲜准入、已停故障款一次接力及派发确认未知不重派。尚未通过新的Linux验证或真实接力验收。
