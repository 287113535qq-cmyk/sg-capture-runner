# 第二个仓库的 20 个 Runner

用户指定 `287113535qq-cmyk/sg-capture-runner`，要求与原账号的 20 个分片同时采集。本次准备的是同一第一轮队列、同一游戏、同一累计 300000 局目标下的两组 Runner。原账号占全局 worker 0–19，第二个账号占 20–39；两个仓库均继续使用 `trial-300k.yml`，每仓库矩阵仍为 20。

## 实际状态

第二个仓库为公开空仓库。本机当前 GitHub CLI 账号 `zyzuoyang` 对该仓库 `push=false`、`admin=false`，且没有待接受的仓库邀请。尚未推送第二个仓库、配置其 Secrets 或启动其工作流；服务端仍运行 `733dde4248c9789306c9ab312c9f8d76e584786b`，容量仍为 20。新增代码默认关闭第二组，尚未执行迁移。

原正式运行 `36391708988` 在分片 1 的 BET 请求遇到 HTTP 502 后停止。静止状态为完整日志 248682 局，文件/Mongo checkpoint 248384 局，298 局待持久化；加上已核验的 100 局历史，当前记录进度为 248782/300000。该快照不替代一次新的全量终审。

未完成大局共 6 个：batch2473/worker7/sequence247738、2479/0/248400、2480/2/248565、2481/12/248645、2483/10/248940、2491/1/249697。前五个已保存响应，等待 FREE_GAME；最后一个仍有未知 BET intent、没有成功响应。数据未删除、原请求未重发。以前两次清理的 proof 不适用于这次停止。需依据用户已授权的异常大局处理方式，重新生成证据、备份及专门审查。

campaign/source 均暂停，原 workflow 为 `disabled_manually`，本次把原仓库 `SG_TRIAL_ENABLED` 同步设为 `false`。队列 complete3、active1、ready19、needs-adapter155。

## 实现和边界

- `runner-group.mjs` 按确切仓库名映射本地分片为全局分片；第二组只能使用第一轮普通局。HMAC 的原 0–19 输入不变，新增 20–39，保持原会话稳定。
- 服务端组名来自专用 SSH forced command 设置的 `SG_RUNNER_GROUP`，不读取 RPC 自报组名。primary key 只能 register 0–19，secondary key 只能 register 20–39。第二组禁止访问旧 trial/fixture RPC。
- 两组共用原 SQLite 动态分配器、全局序列和额度，事务领取互不重叠。批次仍绑定原 worker/session；不能借扩容迁移未知大局、重置序列或复制额度。
- 各组初次开工分别等待本组 20 个有效租约。原已通过的 startup 记录继续有效；不要求原组等待新组上线。
- `runner-federation.json` 是服务端 operator 配置，独立于不可变 campaign config 和游戏 plan。缺少配置时容量仍为 20；内容不匹配则拒绝。新批次、状态统计和审计按启用容量工作，旧固定分片仍限制 20。
- operator-only `federation_migration.activate` 必须在 campaign/pool 暂停、全部 worker 和批次租约过期、磁盘空间达标时运行。先只读生成状态 hash，apply 绑定相同 hash；私有备份 queue/pool 和审计事件后，仅扩展 worker ID 的数据库约束。保留已有 worker、绑定、范围、configHash、planHash 和所有 pending/receipts；不解除原故障或采集开关。
- 工作流停止步骤使用本仓库的 `GITHUB_REPOSITORY`，避免第二仓库尝试关闭原仓库。服务端全局 source gate 仍约束两组。

## 接入步骤

1. 本机通过 CLI 登录第二个账号，或获得第二仓库足以管理代码、Actions Secrets 和变量的权限。凭据只走 GitHub 登录界面或已有本机 CLI，不发到聊天、不写入 Git。
2. 两个仓库使用同一已验证 release；第二仓库 schedule 开关保持 false。其源配置通过 Secrets 提供，原始数据和 `.local` 不进入公开仓库。
3. 为第二组生成独立 SSH key，服务器授权为受限 forced command。secondary entry 禁止 shell command，再调用唯一的 root-owned secondary RPC wrapper，由该 wrapper 固定设置 `SG_RUNNER_GROUP=secondary`。不能给第二仓库原组 key 或任意 shell 权限；sudoers 只允许无参数专用 wrapper。
4. 核查两个仓库全部运行/排队任务和服务端租约，在暂停状态部署不可变 release，复核原 config 和 plan 字节一致。运行 `scripts/activate-runner-federation.py --root ... --backup-dir ...` 获取 hash，再以相同路径、`--expected-hash ... --apply` 激活容量。manifest 最后发布；迁移不会恢复采集。
5. 对上述六个未完成大局重新审查处理并核对 298 条日志落盘；先两仓库各 `allocation=round-one, round_one_limit=10` 短采，验证原 20 个绑定不变、40 个独立会话、范围去重、每个完成局的原始/标准化/文件/SQLite/Mongo 一致。确认后才启用两仓库定时续采和 limit0。

## 已完成验证

Windows：141 项 Python、21 项 Node 测试通过。新增测试实际覆盖 40 个并发分配连接、精确耗尽同一目标且无重叠；真实旧 SQLite `id<20` 约束的迁移、未知 intent 不变、活动租约和陈旧 proof 拒绝；两组各自 startup 屏障和 40 个测试完整局的文件、SQLite、模拟 Mongo 全文一致；原 20 个会话输出完全一致。测试数据均为离线夹具，不计为官方新采，不表示 40 台云端已启动或已达到某个速度。
