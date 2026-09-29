# SG 第一轮采集

当前状态（2026-09-29 10:00:37 北京时间）：累计 **13 / 178 款**。第二账号32836已经通过20分片各10局短采和651条全文验收，正式运行36510315315已实际采集，快照5375完整日志/4631checkpoint、20有效worker；定时续接已开启。

原1008的明确会话拒绝已单独私有归档，独立替代attempt已结算；451条旧完整全部保留，旧BET没有重放。Foam20和Pick A Ball1705真实功能证据逐条不变。primary32739仍164/164与4个原pending，变量false、未新采；需要独立恢复。两个global-hold均false，第二轮关闭。详见[本轮实际结果](docs/pick-session-recovery-20260929.md)。下方旧运行数字仅为历史。

优化减少重复控制/租约/批次查询，将最多 100 条日志批量读回；每次 SG 意图和完整响应持久化、CAS 防冲突、Mongo 全文读回及未知结果不重发均保留。离线 100 局夹具的数据库调用由 1220 次降至 518 次，该数字不等于官方采集提速百分比。详见 [优化报告](docs/runner-io-optimization-20260928.md) 和 [验收结果](docs/runner-io-optimization-20260928-result.json)。

采集、调度、玩法、标准化、恢复和全文审计全部在 GitHub；测试服只提供受限 MongoDB 读写与原始系统指标。完整局只写 `sg_capture_staging_v1.official_rounds`，用户批准的 `capture_state_v2` / `capture_journal_v2` 保存进度和现场。旧 SQLite / 原始文件冻结保留，见 [迁移报告](docs/github-processing-migration.md)。

恢复后 114 秒实际窗口：primary 约 6623 局 / 分钟，secondary 约 6002 局 / 分钟，均为完整大局日志增量；不同游戏不能据此作精确同条件提速比较，完整报告保留窗口和落库检查点。

测试服 CPU 或内存任一达到 95%，或采样失效，GitHub 暂停提交写入；两者低于 90% 稳定 60 秒后小批恢复。资源恢复不解除其他故障；无法可靠保存响应时停止新源请求。详见 [当前规则](docs/rules.md)。

178 款各累计 300000 个完整普通 buy0 大局，单份目标不变。上述快照 complete13、active2、parked-protocol8、ready0、needs-adapter155。未适配玩法保留现场暂挂后处理下一款，不能删除自然功能或重放 BET；第二轮关闭。旧报告不覆盖本页最新运行状态。

本仓库已准备 GitHub 授权、脱敏游戏编号映射，以及从最新上游提取的采集器离线预检副本。本次写入限于新建的隔离服务、测试文件和暂存库；原 API 工作区、历史局数据、现有游戏 Mongo 集合和完成标记未由本次测试修改。

## 已提供

- [每游戏分析档案](docs/game-rules/README.md)：178 款独立规则卡，记录大局完成条件、特殊环节字段、映射、已知边界与既有报告版本。新版本终审顺带保留实际观察统计；不增加 SG 请求或历史重扫。详见 [留档机制](docs/game-rule-archive.md)。
- `config/games.json`：178 款保留游戏的官方 sourceId 映射；`gameId` 为历史采集编号，`runtimeGameId` 为当前运行编号。不能用运行编号直接寻找历史采集文件。
- `collector/`：上游代码来源和原始文件哈希见 `docs/upstream.json`。该副本仅开放 dry-run，正式采集入口和协议请求入口均硬性拒绝，环境变量不能解除。
- 安全 dry-run：默认并发 1，禁止共享 session 和无限并发；不回填完成标记、不更新 skip ledger、不覆盖正式报告。报告仅在明确传入 `--preflight-report` 时创建，已有文件一律拒绝覆盖。
- 流式读取局文件；拒绝损坏 JSON 行与非 round 结构；特殊类型分别达标，free-choice 只认可要求的选项编号。
- `.github/workflows/preflight.yml`：只允许手动触发的 Linux 离线验证，无 push 触发、无定时触发、无服务器或 SG Secrets，只执行编译和隔离测试数据验证。

## 离线检查

```sh
cd collector
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
```

测试生成的数据均为临时测试夹具，不是官方采集结果。预检不会验证旧 session 是否仍有效；也不证明每条历史局的协议完整性、Mongo 与 NDJSON 的身份及内容一致性。

真实本地预检需要在本机明确指定 `SG_CAPTURE_ROOT`、`--metadata`、`--static-manifest`、`--capture-rules`、`--skipped-games`。这些路径对应既有数据与配置，不能将会话文件提交到 GitHub。报告保存在被忽略的 `.local/`。

```sh
node scripts/build-source-catalog.cjs <当前运行目录清单> <本地历史launch清单> <全新输出文件>
```

映射只采用严格唯一的官方 sourceId，不按名字猜配，不导出 launch URL、session 或 operator 字段。

## 初期链路准备记录

初期隔离服务验证了 claim/lease/heartbeat、日志恢复、幂等写入、唯一索引和文件/Mongo 一致性，记录见 `docs/link-verification.md`。早期测试 RPC 只接受夹具，不能作为正式采集入库接口；之后已建立独立的第一轮 campaign/pool 采集服务，当前运行状态及剩余协议适配以本文开头和最新报告为准。未把历史会清库的上游导入脚本复制进本仓库。

唯一采集 workflow 为每仓库的 `trial-300k.yml`，每组最多 20 个 `ubuntu-latest` 矩阵任务；primary 固定全局 worker 0–19，secondary 20–39。任务唯一归属、批次、租约与检查点算法均在 GitHub，通过可信 SSH 组身份读写 Mongo 的 `capture_state_v2` / `capture_journal_v2`。同一游戏不会跨组重复分配，每会话仅一个在途请求。实时状态以这两个辅助集合及 GitHub 状态入口为准；旧 SQLite control / group_control / dispatch_control 仅为冻结历史，初始 config 标签也不是实时队列。每 20 分钟续采定义保留，Mongo 凭据只留在测试服。

原工作区还有尚未提交的协议/金额等修改。本副本以最新远端 main 为基线，不擅自合并它们；真实采集前须核对所需的最新已审阅修复。

## 隔离链路验证

业务字段链路已通过19条协议样本的实际入库验收，包含原始协议分析、bet/mul/buy/bonus 复核、顶层 Mongo 字段写入和跨运行恢复；同批次重跑新增0条。buy 与 bonus 按用户定义独立编号，详见 `docs/business-fields.md` 和 `docs/business-fields-result.json`；真实游戏类型映射不能由测试配置代替。

`SG isolated link verification` 为手动 workflow。单节点写入 → 模拟 Mongo 成功后进程中断 → 新 Runner 恢复 → 20 个 Runner 分别处理不同测试任务 → 文件/Mongo 身份与内容校验 → 在隔离验收集合重复导入。所有测试数据带 `fixtureOnly=true`，服务拒绝正式游戏编号。正式游戏集合不参与测试。

历史隔离验证使用 SQLite 持久化租约/进度和追加日志；该架构已由上方 Mongo-only 迁移替代。旧文件仍保留，Mongo 继续使用专用账号及唯一约束。

2026-09-27 验收：21 个测试任务、43 条记录，20 个独立 Runner 的矩阵任务全部成功；实际任务步骤同时运行峰值为 6，尚未证明 20 台同时持续采集。21 项持久化及隔离测试通过。

- [完整链路通过](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36311422228)
- [同批次重跑通过，新增 0 条](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36311817903)
- 脱敏回执、部署代码哈希和任务时间见 `docs/link-verification-result.json`。官方取数和现有游戏库写入未包含在本次验收中。
