# SG 采集准备仓库

当前状态：**第一轮已启动，20 台 GitHub-hosted Linux Runner 实际并发采集。178 款已登记：Book of Sevens 已审计达到 30 万局并跳过，24 款已通过普通局协议与历史数据验证并入队，其余 153 款仍需适配验证。每款累计补足 30 万完整普通局；第二轮购买、加注模式保持关闭。** 新数据写入隔离库 `sg_capture_staging_v1.official_rounds`。用户选择使用现有空间，剩余低于 30 GiB 停止新局。规则见 [第一轮说明](docs/round-one.md)，启动和 20 路持续出局证据见 [启动回执](docs/round-one-start-result.json)。原 Book of Sevens 结果见 [最终报告](docs/trial-final-report.md)。

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

## 通用采集的剩余工作

隔离服务已验证 claim/lease/heartbeat、日志恢复、幂等写入、唯一索引和文件/Mongo 一致性。正式启动前仍需将这些机制接入真实游戏队列，完成官方主机级跨运行冷却、独立 session 刷新、Linux WMS/NextGen 完整局采集、正式目标集合的受控导入，以及真实局的单节点续跑验证。测试 RPC 只接受少量夹具，不能直接作为正式采集入库接口。未把历史会清库的上游导入脚本复制进本仓库。隔离验证服务及验收范围见 `docs/link-verification.md`。

原多游戏计划未启用。已完成的单游戏试采后来扩展为 20 个独立会话；新的动态模式也是同游戏 20 个 `ubuntu-latest` Runner，每会话严格一个在途请求。唯一采集 workflow 仍为 `trial-300k.yml`，原有每 20 分钟的续跑只有在工作流启用且 `SG_TRIAL_ENABLED=true` 时才运行。目前唯一工作流以 round-one 模式启用，SG_TRIAL_ENABLED=true，SG_TRIAL_ALLOCATION=round-one。旧单款 trial-pool 模板仍未配置，不是第一轮的开关。Mongo 密码仅保留在服务器。

原工作区还有尚未提交的协议/金额等修改。本副本以最新远端 main 为基线，不擅自合并它们；真实采集前须核对所需的最新已审阅修复。

## 隔离链路验证

业务字段链路已通过19条协议样本的实际入库验收，包含原始协议分析、bet/mul/buy/bonus 复核、顶层 Mongo 字段写入和跨运行恢复；同批次重跑新增0条。buy 与 bonus 按用户定义独立编号，详见 `docs/business-fields.md` 和 `docs/business-fields-result.json`；真实游戏类型映射不能由测试配置代替。

`SG isolated link verification` 为手动 workflow。单节点写入 → 模拟 Mongo 成功后进程中断 → 新 Runner 恢复 → 20 个 Runner 分别处理不同测试任务 → 文件/Mongo 身份与内容校验 → 在隔离验收集合重复导入。所有测试数据带 `fixtureOnly=true`，服务拒绝正式游戏编号。正式游戏集合不参与测试。

服务使用 SQLite 持久化租约/进度和追加写入日志，Mongo 使用专用账号及唯一索引。恢复不会清空已有文件。

2026-09-27 验收：21 个测试任务、43 条记录，20 个独立 Runner 的矩阵任务全部成功；实际任务步骤同时运行峰值为 6，尚未证明 20 台同时持续采集。21 项持久化及隔离测试通过。

- [完整链路通过](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36311422228)
- [同批次重跑通过，新增 0 条](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36311817903)
- 脱敏回执、部署代码哈希和任务时间见 `docs/link-verification-result.json`。官方取数和现有游戏库写入未包含在本次验收中。
