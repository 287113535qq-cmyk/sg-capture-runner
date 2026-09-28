# 第二个仓库的 20 个 Runner

> 2026-09-28 更新：下文是初次接入的历史快照。原组随后已完成 32651、32704，目前 complete5、active32711。第二组两次旧失败运行已按用户要求备份并删除；新运行 36403634321 仍未通过 20 台集体启动，观察到 7 台就绪，实际采集全部跳过。最新状态以 [删除后重试报告](secondary-retry-20260928.md) 和 [32711 恢复报告](hoppily-recovery-20260928.md) 为准。已删除运行的旧 GitHub 链接不再有效。

用户指定 `287113535qq-cmyk/sg-capture-runner`，要求与原账号的 20 个分片同时采集。本次准备的是同一第一轮队列、同一游戏、同一累计 300000 局目标下的两组 Runner。原账号占全局 worker 0–19，第二个账号占 20–39；两个仓库均继续使用 `trial-300k.yml`，每仓库矩阵仍为 20。

## 实际状态

第二个公开仓库的邀请 `335034808` 已接受，CLI `zyzuoyang` 已有 push 权限。两仓库已同步代码，第二仓库的独立受限 SSH key、Secrets 和变量均已配置。线上 current 已部署 `7463e7fd1bf4736c8f5fcdd3280a8a3656d28cc3`，运行容量已受控迁移为 40，原 20 个 worker、2491 个批次、冻结配置与计划保持不变。两组越界 register 均实际返回 `RUNNER_GROUP_MISMATCH`。

原正式运行 `36391708988` 在分片 1 的 BET 请求遇到 HTTP 502 后停止。静止状态为完整日志 248682 局，文件/Mongo checkpoint 248384 局，298 局待持久化；加上已核验的 100 局历史，当前记录进度为 248782/300000。该快照不替代一次新的全量终审。

该次未完成大局共 6 个：batch2473/worker7/sequence247738、2479/0/248400、2480/2/248565、2481/12/248645、2483/10/248940、2491/1/249697。依据用户已授权的异常大局处理方式，已全量核验、私有备份后清理这 6 个未完成 attempt。完整 248682 局全部保留，原 20 个会话绑定不变；最后一个原 BET 结果仍记为 unknown，归档为 abandon_without_replay，未重发。独立清理 proof 为 `39d5119d8b567a5f9d761291bb1edc40150be2bd8eba96c3e98a7f2dd136ec27`，已应用一次，不可重用。容量迁移 proof 为 `73dc1cb923610269d0d980102d118114f829304945c2a132a74d997cebbccf63`，也已应用。

两仓库短采同时派发。原组 [36398269790](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36398269790) 成功：20 个 worker 各新增 10 局，共 200 局，原 298 条日志全部完成持久化，6 个替代大局均以新 attempt 结算。随后四进程全量审计 248882 局的原始/标准化/文件/SQLite/Mongo 全文一致，耗时 129.225 秒；旧 248682 局逐条保留，pending=0。加 100 条已核验历史为 248982/300000。审计结果见 [验证回执](runner-federation-validation-result.json)。

第二组 [36398275924](https://github.com/287113535qq-cmyk/sg-capture-runner/actions/runs/36398275924) 未进入采集：180 秒启动期限内只有本地 shard 0、4、6、7、13 获得 Runner 并就绪，其余 15 个排队，报 `RUNNER_CAPACITY_NOT_READY` 后停止剩余任务。20 个任务的采集步骤全部 skipped，官方源请求 0，第二组会话绑定 0。观察到 5 台就绪并不能证明账号永久上限为 5；API 未提供账号限制原因。第二仓库 workflow 已禁用、`SG_TRIAL_ENABLED=false`，不反复派发同样检查，不降低启动要求来掩盖容量不足。详细证据见 [容量回执](runner-federation-capacity-result.json)。

原组已开启 `SG_TRIAL_ENABLED=true` 并派发正式续采 [36399061495](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36399061495)，allocation=round-one、round_one_limit=0。第二组仍待 Runner 容量明确后验证。因此当前是原 20 分片续采，不能声称 40 台已同时采集。接入时队列仍为 complete3、active1、ready19、needs-adapter155，实时进度以 status RPC 为准。

## 实现和边界

- `runner-group.mjs` 按确切仓库名映射本地分片为全局分片；第二组只能使用第一轮普通局。HMAC 的原 0–19 输入不变，新增 20–39，保持原会话稳定。
- 服务端组名来自专用 SSH forced command 设置的 `SG_RUNNER_GROUP`，不读取 RPC 自报组名。primary key 只能 register 0–19，secondary key 只能 register 20–39。第二组禁止访问旧 trial/fixture RPC。
- 两组共用原 SQLite 动态分配器、全局序列和额度，事务领取互不重叠。批次仍绑定原 worker/session；不能借扩容迁移未知大局、重置序列或复制额度。
- 各组初次开工分别等待本组 20 个有效租约。原已通过的 startup 记录继续有效；不要求原组等待新组上线。
- `runner-federation.json` 是服务端 operator 配置，独立于不可变 campaign config 和游戏 plan。缺少配置时容量仍为 20；内容不匹配则拒绝。新批次、状态统计和审计按启用容量工作，旧固定分片仍限制 20。
- operator-only `federation_migration.activate` 必须在 campaign/pool 暂停、全部 worker 和批次租约过期、磁盘空间达标时运行。先只读生成状态 hash，apply 绑定相同 hash；私有备份 queue/pool 和审计事件后，仅扩展 worker ID 的数据库约束。保留已有 worker、绑定、范围、configHash、planHash 和所有 pending/receipts；不解除原故障或采集开关。
- 工作流停止步骤使用本仓库的 `GITHUB_REPOSITORY`，避免第二仓库尝试关闭原仓库。服务端全局 source gate 仍约束两组。

## 第二组后续验证

1. 账号拥有者检查 Actions/账号页面是否有验证或额度提示。GitHub 官方 [Actions limits](https://docs.github.com/en/actions/reference/limits) 列明标准 Free 总并发通常为 20，具体本次只分配 5 台的原因仍需账号侧证据，必要时通过 GitHub Support 核实。不要擅自改变费用或增加账号。
2. 配置、权限和容量迁移已完成，无需重新接受邀请、换 key、重跑迁移或清理旧 pending。第二仓库 schedule 保持 false，直到新容量证据支持重试。
3. 在两个仓库无活动/排队采集、原任务安全结束且租约过期的边界，读取最新 campaign、活动 trial、完整记录基线和绑定。不能沿用 248682/248882 旧快照，也不能中断在途 BET 来制造新的未知结果。
4. 第二组以 `allocation=round-one, round_one_limit=10` 短采，确认真正获得 20 个 Runner、20–39 注册成功，原 20 个绑定不变，总共 40 个独立会话，分配不重叠；对照当次新基线核验全部新增完整局及文件/SQLite/Mongo。再让两组同时运行以确认实际并发。全部通过才开启第二仓库定时和 limit0。

## 已完成验证

离线测试覆盖 40 个并发分配连接、精确耗尽同一目标且无重叠；真实旧 SQLite `id<20` 约束迁移、未知 intent 不变、活动租约和陈旧 proof 拒绝；两组各自 startup 屏障与 40 个夹具完整局的文件、SQLite、模拟 Mongo 全文一致；原 20 个会话输出完全一致。追加的清理验证确保最多同时打开一个历史批次，2491 批次不会无界占用 SQLite/文件句柄。测试数据不计为官方新采，也不表示 40 台云端实际运行。

原 federation 代码的 [Linux 预检 36395090374](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36395090374) 成功；最终 runtime `7463e7f` 的第二仓库 [Linux 预检 36396807308](https://github.com/287113535qq-cmyk/sg-capture-runner/actions/runs/36396807308) 也成功，包含 143 Python、25 collector、21 Node、TypeScript、20 会话/3000 局离线集成。部署时服务端再次通过完整 143 Python 测试。官方源端已验证的是原组新增的 200 局；第二组源端验证仍未完成。
