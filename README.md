# SG 第一轮采集

2026-09-30 05:05附近：Beaver CFG1识别已修正；Linux/新代际维护/原预算剩39短采均成功，新增39完整全部入库，当前Beaver137/Demon446，pending0。原100 BET预算已耗尽（99完整、1作废），未正式放行、不追加试采。详见[CFG1实测](docs/beaver-cfg1-20260930.md)。

2026-09-30 最新实采：独立维护已解除旧任务启动阻塞，36624576401在3秒启动，20分片实采新增60完整局，Beaver当前trial98条全部Mongo核验。1条免费半局因本方CFG1误判停止，已通用留样作废，pending0；Demon446保留。尚未正式持续采集，仍14/178完成。详见[实际结果与耗时](docs/demo-pilot-result-20260930.md)，覆盖下方旧“新采尚未开始”。

2026-09-30 最新用户口径已实际执行：通用清理36605813543成功，Beaver旧半局作废并移出活动队列，38完整局补写Mongo并全文核验；Demon446不变。源请求0，不再补救中断半局。下一步新demo会话最多100局试采，尚未启动；累计仍14/178。详见[清理结果](docs/demo-retirement-20260930.md)。下方恢复与续局记录仅为历史，以最新规则为准。

2026-09-29 23:20北京时间实际结果：双拒绝统一恢复36588335481成功；残余短采36588874588成功新增179完整，累计446局全部Mongo全文核验，旧267及所有旧journal原样，pending0、待写0，七独立替代全部通过。原200额度已用完；本轮无自然bonus2终局，validate/formal未调用，两source变量仍false，尚未持续正式采集。详见[本轮结果](docs/demon-pair-recovery-20260929.md)和效率方案。

2026-09-29 21:52北京时间实际结果：嵌套适配及调度状态修正已部署，11条完整积压已补齐，当前267日志/267Mongo全文相等。独立恢复36576758603成功；随后短采36577344185真实发出2次FREE_GAME，原218和440均明确INVALID_SESSION，0新BET/0新完整。两原局及完整拒绝保留，未知0，尚未归档；正式采集仍暂停。累计14/178，剩余额度179不能重置。详见[实际结果](docs/demon-nested-rebind-20260929.md)和[效率方案](docs/sg-efficiency-plan-20260929.md)。

2026-09-29 19:44北京时间实际结果：最后1706恢复36562547221成功，原246全文保留；fresh-short36562923330真实新增21完整。当前267日志/256Mongo全文、11完整待写、2pending且未知0。新218自然免费进入嵌套FID0|1|，现适配器明确未支持而暂停；440原BET保留待续。806替代已落库，434替代已日志待写，117/902/1706仍未替代。尚未正式恢复，需适配嵌套免费并独立审查续接，不能复用已应用许可。详见[实际结果](docs/demon-zero-recovery-20260929.md)。

2026-09-29 19:04北京时间实际结果：902独立恢复36558680223成功，246全文不变；同commit短采36559066920仅请求原1706一次FREE_GAME，明确INVALID_SESSION。1706成功BET与拒绝已保留，未知0，当前246完整/1pending，新BET0/完整0，后续20分片跳过。902新proof永久冻结；下一步独立处理最后1706并支持无原pending的有限短采，不能复用902许可。详见[实际结果](docs/demon-one-recovery-20260929.md)。

2026-09-29 18:43北京时间准备进展：902独立恢复已接入，332项Runner及31项私有现场离线测试通过；保留246完整与原1706，只处理明确拒绝902。尚未派发新恢复，Linux预检与新鲜双份备份待完成，不能视为902已归档。详见[恢复准备](docs/demon-one-recovery-20260929.md)。

2026-09-29 17:54北京时间：旧排队记录的精确接替已实现，117恢复36551302211成功；同commit短采36551698305实际接续时902明确INVALID_SESSION，1706未请求且保持原样。246完整全文不变、2pending、未知0，新BET0、新完整0；后续20分片跳过。117新proof已应用冻结，902需独立恢复，不能复用或推断1706失效。累计14/178，两变量false。详见[最新实际结果](docs/demon-queue-recovery-20260929.md)。

2026-09-29 13:03北京时间最新覆盖：434明确拒绝的精确恢复已应用，246完整全文保留。三原局优先短采只发1次FREE_GAME，117明确INVALID_SESSION；902/1706未请求，后续20分片跳过，新BET0、新完整0。当前246/246、3pending、未知0，累计14款，实际源端0、两变量false。本次117尚无新归档proof；806/434已归档但尚无独立替代局。真实自然Demon bonus2仍待验证。详见[最新实际结果](docs/demon-three-recovery-20260929.md)。下方带时间记录仅为历史。

2026-09-29 12:38北京时间最新覆盖：806明确拒绝的精确恢复已应用，补21条后246完整全部Mongo全文相等。新的分阶段短采只发1次FREE_GAME；434明确INVALID_SESSION，117/902/1706未请求且原样保留，后续20分片全部跳过，新BET0、新完整0。当前246/246、4pending、未知0，累计14款，实际源端0、两变量false；本次434尚无新归档proof。806已归档但尚无独立替代局；真实自然Demon bonus2仍待验证。详见[最新实际结果](docs/demon-pending-session-recovery-20260929.md)。下方带时间记录仅为历史。

2026-09-29 12:12北京时间代码进展：已实现“4个原局持有分片先接续、成功后20分片补足短采”的阶段控制。接续阶段禁止新INIT/BET并立即全文落库核验；接续局计入每分片10局额度，总增量仍200。当前仅离线候选，未生成或应用本次806事故的新proof，线上246/225与5pending保持，尚未恢复采集。详见[分阶段短采](docs/pending-first-short-20260929.md)。

当前状态（2026-09-29 11:52 北京时间）：累计 **14 / 178 款**。第二账号32836已完成299900新局全文终审，加100历史达到300000，玩法观察档案已经保存。

第一账号32739原432失效attempt已归档，195旧完整已全部核验落库。本次短采新增51完整，432独立替代局已记入完整日志；原806接续FREE_GAME明确返回INVALID_SESSION，902仍未请求，另3个正常续局现场保留。当前246完整日志/225条Mongo全文核验、21完整待写，旧195不变；共同保护暂停、两变量false，尚未取得Demon自然bonus2真实结算及短采验收。新806拒绝需独立证据绑定恢复，第二轮关闭。详见[最新实际结果](docs/demon-feature-session-recovery-20260929.md)。下方旧运行数字仅为历史。

优化减少重复控制/租约/批次查询，将最多 100 条日志批量读回；每次 SG 意图和完整响应持久化、CAS 防冲突、Mongo 全文读回及未知结果不重发均保留。离线 100 局夹具的数据库调用由 1220 次降至 518 次，该数字不等于官方采集提速百分比。详见 [优化报告](docs/runner-io-optimization-20260928.md) 和 [验收结果](docs/runner-io-optimization-20260928-result.json)。

采集、调度、玩法、标准化、恢复和全文审计全部在 GitHub；测试服只提供受限 MongoDB 读写与原始系统指标。完整局只写 `sg_capture_staging_v1.official_rounds`，用户批准的 `capture_state_v2` / `capture_journal_v2` 保存进度和现场。旧 SQLite / 原始文件冻结保留，见 [迁移报告](docs/github-processing-migration.md)。

恢复后 114 秒实际窗口：primary 约 6623 局 / 分钟，secondary 约 6002 局 / 分钟，均为完整大局日志增量；不同游戏不能据此作精确同条件提速比较，完整报告保留窗口和落库检查点。

测试服 CPU 或内存任一达到 95%，或采样失效，GitHub 暂停提交写入；两者低于 90% 稳定 60 秒后小批恢复。资源恢复不解除其他故障；无法可靠保存响应时停止新源请求。详见 [当前规则](docs/rules.md)。

178 款各累计 300000 个完整普通 buy0 大局，单份目标不变。上述快照 complete14、active1、parked-protocol8、ready0、needs-adapter155。未适配玩法保留现场暂挂后处理下一款，不能删除自然功能或重放 BET；第二轮关闭。旧报告不覆盖本页最新运行状态。

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
