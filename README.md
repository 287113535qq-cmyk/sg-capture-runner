# SG 采集准备仓库

最新状态（2026-09-28 11:38 UTC 后续审查）：**第二组已按“就绪分片先领任务、排队分片启动后加入”实际采集成功。** [短采 36416561237](https://github.com/287113535qq-cmyk/sg-capture-runner/actions/runs/36416561237) 的 20 个分片分批完成，每个新增 10 局，共 200 局原始/标准化/文件/SQLite/Mongo 全文核验通过。这不代表 20 台同时采集，也不把此前 10 台观测值视作永久上限。两账号分组调度已受控迁移：primary 保留 32714 协议现场，secondary 独立领取 32717，178 款目标和历史仍各一份。详见 [实施与实际结果](docs/available-workers-20260928.md)。

随后第二组正式运行 36416743264 在 32717 自然 FID=2 功能触发协议保护而停止，最终 244 个完整日志记录保留，其中 228 个已落盘全文核验、16 个待落盘，另有 1 个成功 BET 后的自然功能待完成。全部私有备份，未删除或重放；32714 原有现场不变。**当前完成 6 款，每款累计 300000 局；队列 complete6、active2、ready15、needs-adapter155。两个组均因协议适配暂停，定时采集变量 false，第二组保留手动入口。** 详见 [32717 新停采审查](docs/huff-goals-natural-feature-stop-20260928.md) 与 [32714 原停采审查](docs/huff-natural-free-stop-20260928.md)。第二轮关闭，新数据只写隔离库 sg_capture_staging_v1.official_rounds。

本仓库已准备 GitHub 授权、脱敏游戏编号映射，以及从最新上游提取的采集器离线预检副本。本次写入限于新建的隔离服务、测试文件和暂存库；原 API 工作区、历史局数据、现有游戏 Mongo 集合和完成标记未由本次测试修改。

## 已提供

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

唯一采集 workflow 仍为每仓库的 `trial-300k.yml`，每仓库最多 20 个 `ubuntu-latest` 矩阵任务。可用分片先领取任务，迟到分片就绪后加入；每会话一个在途请求。primary 使用全局 0–19，secondary 使用 20–39，各组独立活动游戏，同一游戏不能跨组重复分配。178 款目标、历史和全局磁盘/存储保护仍共用；实时状态从可信组身份的 `status` RPC 及 `group_control`/`dispatch_control` 读取，迁移前 `control` 表和初始 config 标签均不能视作实时队列。每 20 分钟定时定义保留，当前双方 `SG_TRIAL_ENABLED=false`，不会自动采集；第二组手动入口 active，正式源端恢复需完成协议审查。Mongo 密码仅保留在服务器。

原工作区还有尚未提交的协议/金额等修改。本副本以最新远端 main 为基线，不擅自合并它们；真实采集前须核对所需的最新已审阅修复。

## 隔离链路验证

业务字段链路已通过19条协议样本的实际入库验收，包含原始协议分析、bet/mul/buy/bonus 复核、顶层 Mongo 字段写入和跨运行恢复；同批次重跑新增0条。buy 与 bonus 按用户定义独立编号，详见 `docs/business-fields.md` 和 `docs/business-fields-result.json`；真实游戏类型映射不能由测试配置代替。

`SG isolated link verification` 为手动 workflow。单节点写入 → 模拟 Mongo 成功后进程中断 → 新 Runner 恢复 → 20 个 Runner 分别处理不同测试任务 → 文件/Mongo 身份与内容校验 → 在隔离验收集合重复导入。所有测试数据带 `fixtureOnly=true`，服务拒绝正式游戏编号。正式游戏集合不参与测试。

服务使用 SQLite 持久化租约/进度和追加写入日志，Mongo 使用专用账号及唯一索引。恢复不会清空已有文件。

2026-09-27 验收：21 个测试任务、43 条记录，20 个独立 Runner 的矩阵任务全部成功；实际任务步骤同时运行峰值为 6，尚未证明 20 台同时持续采集。21 项持久化及隔离测试通过。

- [完整链路通过](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36311422228)
- [同批次重跑通过，新增 0 条](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36311817903)
- 脱敏回执、部署代码哈希和任务时间见 `docs/link-verification-result.json`。官方取数和现有游戏库写入未包含在本次验收中。
