# 2026-10-02 04:07 四路实际验收

源36915539745固定e529a782b24c20dc8bf0a2baa2a28cd3171efefb成功，20个父任务、80个独立子会话均成功；新增15484完整，独立审查36918673860通过262918完整/剩余37082，旧247434保全。池预留、活动批次、待写和活租约均0，源错误0。

确定的十分钟窗口四路8924完整，对照两路5951提升49.96%，对照一路4480提升99.20%；P95直方图上界仍8000ms，80路服务器及宿主资源证据完整且安全，窗口缺失与无效均0。不可把累计工作线程时间当墙钟吞吐。四路证明c3d86dd7fb9da7527b3987c827756c9d3a3ecdfcba9ec49454846b947af3fc4b已保存。

新长时四路配置只保留37082剩余目标，不增加BET额度；真实2876批次/394证明内存回放只增加一条运行回执，所有旧状态不变。CAS快照优化已通过Linux36917558538，1280处理/写入保护测试通过，旧两处存储替身已按正式异步回调契约修正，原断言保留。长时实采、自动接力和下一游戏持续准入尚待验证，全部效率优化不能称已完成。

实际父任务开始到各子会话资源ready为91.76–254.42秒，均值168.29秒，包含安装、准入、进程启动和保护性观察，尚不能归因于重复健康等待。此次累计源与RPC时间中源请求75.71%；完整read响应约10.03GB。下一固定版本的文档类型诊断用于定位真实开销；当前不猜测全部属于pool，也不跳过保护。

# 2026-10-02 CAS 快照复用优化

按 AG 的最新所有权快照与 CAS 领取方式，注册、领取、完整结算和部分结算直接验证本次 CAS 读取的最新池，去掉此前额外的一次完整池读取。每次 CAS 冲突重试仍重新验证最新计数账本，公共 countPermission 仍鲜读；不可变许可缓存、租约、额度及完整 Mongo 读回条件保持。三项新增测试实测注册→领取→完成从六次池读取减少至三次，三次冲突对应四次独立最新账本验证，冲突期间计数被改则拒绝且不预留。35项受影响本机测试通过；这是离线 RPC 次数改善，尚无线上吞吐提速结论。

数字文档类型诊断已通过 Linux36916080874（c3a5db6）；当前 e529a78 源版本不受开发修改影响。该快照复用改变运行代码，后续许可须绑定新的完整 Linux 预检，不能借旧预检启动。四路实测和长时接力仍待验收，不称全部效率优化完成。

# 2026-10-02 03:39 实测更新

累计仍15/178完成，Rhino247434完整、剩余52566。上一四路试验有77个成功子任务，新增16056已通过独立Python全文与Mongo读回；3个首次read断连任务源请求0、注册0、写入0，不能作四路吞吐验收。首次只读有限重连与采集入口联动已修正并通过本机及Linux，旧许可原样冻结。

新四路36915539745固定e529a782b24c20dc8bf0a2baa2a28cd3171efefb已通过formal-admit，20个父任务正在启动会话；20分钟上限，仅用原52566剩余完整目标，不新增额度。四路稳定窗口和长时验证未完成。1→2的32.83%实测增益继续有效。当前源结束后自动进入独立全文/80路资源窗口审查；通过后再准入长时四路。

最新两份私有准备增量分别3821858字节/17文件与544150字节/13文件，两端全文读回通过，传输62.07秒与11.26秒。固定SSH身份/主机/文件I/O不变，使用传输压缩及旧档案hash引用；文件大小不同，不能据此宣称固定倍数提速。详见[启动故障与修正](ag-initial-read-recovery-20261002.md)。

已结束的不完整四路日志显示源请求占源与RPC累计时长80.14%，完整read响应累计约8GB；这是费用拆分，不能当稳定窗口或CPU结论。新增固定文档类型的请求/响应字节和耗时诊断，本机44项相关检查通过，将用于下一固定版本区分pool、batch与journal开销。字段不包含文档身份、原文或会话值，计时嵌套在网关操作内，禁止相加重复计算。

# 2026-10-02 02:45 实测更新

全部效率优化尚未验收完成。Rhino已全文核验231378/300000，当前总游戏完成15/178。相同十分钟的一路4480局与两路5951局比较通过，实测增益32.83%，P95直方图上界均8000ms，全40槽位宿主/后端资源覆盖通过，无错误或资源hold。源36902953286与审查36907604680绑定；四路源36908875451已通过formal-admit，20台各4个独立会话，20分钟上限、剩余额度不增加。四路吞吐及长时四路接力验收继续，不能称全部完成。

AG机制对应：独立session覆盖请求等待；CAS领取与不可变许可防重复任务；同源稳定窗口比较再扩并发；当前增量全文读回、旧保全hash复用；源结束后连续衔接审查、激活、fresh及派发；故障分类保留失败记录、不重采、不重置目标。阶段保护导致OTHER_RUN_ACTIVE的审查先保留零写入证据，等待精确预检结束再消费原源结果。详细证据见[实测与紧凑控制](ag-compact-control-efficiency-20261002.md)。

# 20:50 验收更新

Pyramids线上无源收尾保全3,627，预留和活动批次均0；另一仓Rhino继续采集。按AG canary方式增加资源分时覆盖及全会话绑定，53项受影响本机检查通过；详见[稳定窗口验收](ag-resource-window-efficiency-20261001.md)。自动接力、四会话实际对比和全目标终审尚未全部完成。

# 效率优化验收与执行链

最新进展见[连续采集与差异修复](ag-continuous-efficiency-20261001.md)：15/178完成，Rhino长时双会话已准入，35,722全文已通过，Pyramids修复继续；全部优化尚未完成。以下各时间段为历史记录。

2026-10-01。本次优先执行真实吞吐验证；全部优化尚未验收完成。累计完成15/178，Pearl已结束，不重采。Rhino双会话窗口实际新增10374条，累计已落库18694条，仍需本轮独立Python全文读回和稳定窗口对比。

AG参考固定源码：E:/platform-sync/api_new/api.numeric/capture/capture-ag。rolling-worker的独立会话/持续领取、scheduler的故障分类、client最近8步上下文、round精确映射分别对应下列验收。

| 环节 | AG参考 | 已完成证据 | 剩余验收 |
|---|---|---|---|
| 准备到启动 | 通道连续推进 | Rhino最新预检结束到试采派发4分34秒 | 自动跨工作流接力、无ready时准备和修复同时推进 |
| 请求等待 | 独立工作线程 | 被动连接分段和逐帧计时已接入口 | 两个稳定10分钟窗口、连接复用与长尾实测 |
| 会话并行 | 每线程独立session | Rhino独立2/4会话、租约、配额、Python准入已接线；双仓源码同步 | Rhino实际1→2→4吞吐对比，4会话只在有效比较后准入 |
| 故障处理 | 分类、最近8步、继续下一款 | AG留样、作废、修复队列已上线 | 双账号独立运行边界及持续自动接力 |
| 修复复用 | 精确游戏事件/家族差异 | 特征索引、固定客户端hash和三端回放 | 分组匹配后的差异验证和真实重新准入 |
| 完整计数 | CAS领取 | Rhino151保全后的正式激活和20分钟源准入已成功 | 本次窗口全文读回、全目标终审 |

Rhino修复试采36826318464成功：100新增完整，99普通加1自然免费完整结束；旧51保留。正式profile为独立v2，旧作废、批次、journal和已用额度保持。Python实际profile校验通过。原100许可已耗尽，不借旧额度进行性能测试。

Pyramids v2保全2127条、剩余297723的退休/修复重入内存链已通过；控制入口、工作流选择与准确Rhino双会话跨仓只读范围已接通并通过Linux36836947715。受限服务只增固定只读操作，旧操作字节不变、manifest不变、Mongo写0、SG0。独立新profile和线上重入仍未执行。Mansion single-slot的Python/Runner/collector各7正例6负例已接生产校验，Linux36833484513成功；实际重新准入尚未完成。两条修复均不可报告重新入正常队列完成。

## 16:43 双会话收尾故障与连续处理

源36835017232的40个采集子进程全部正常退出，10374新增完整记录、源错误0；工作流20个父任务失败。原因是父进程用Promise.all同时向自身只能串行使用的同一gateway读取两份相同许可。已改为一次串行读取共同不可变许可后分别检查子会话，减少重复RPC；新增回归模拟单通道禁止并发，检查只读两份共同许可文档。当前真实池18694、无failure、待写0、活租约0。

不能把该失败运行改称成功或直接扩到四会话。新增精确结束故障审查绑定运行身份、固定日志SHA、40独立子会话终报及源错误0；只允许本次已识别父任务故障进入只读全文审查。后续runtime绑定仍核完整批次退休证明、记录数、已确认许可、无pending与fresh。该例外不接受任意failed run、不重放旧请求、不增加额度。实际记录全文审查仍待执行。

AG参考：子通道独立、共享控制通道串行；已正常采集的数据保全；按已识别故障修复调度外壳并从新会话继续。30分钟资源观测入口已通过Linux36837417938，但未应用或采集；保持两个会话，不能用它绕过四会话准入。

所有速度结论必须标清样本、并发、窗口、普通/免费比例、完整入库数、p95/p99、错误及资源暂停。嵌套RPC时间不重复相加；缺连接事件为unknown。前后并发对比只在同游戏有效独立许可内执行，不增加目标、不重放未知请求。

## 本轮已执行

Rhino正式计数无源激活36829512294成功，07:17:54Z→07:19:23Z，89秒。读回151完整和299849剩余，旧批次及journal原样。Linux36829253963成功，135秒；预检结束至维护派发29秒。

真实100条Rhino试采性能汇总去重后为20分片、228次请求、0源错误。完整局208帧连接观测均有效且均复用连接；超过1秒的请求占源请求时间87.53%。Logic平均980.15ms、EndGame401.79ms，读体约1ms。属于短试采，不是稳定10分钟窗口；不能与Pearl直接比较提速百分比。

新增离线日志汇总器通过3项重复/冲突/非有限数测试。新增初次正式运行的20分钟测速凭据，绑定成功的正式激活、151条基线及36旧批次，原计数和目标不变；10项正负测试和7项入口/冻结回归通过，真实151内存授权只增加1条凭据。尚未线上应用或派发。两会话和四会话的实际对比、独立跨账号边界与自动接力仍待完成，不宣称全部优化验收。

测速首次维护36830403114在数据库连接之前被COUNT_RUNTIME_REFRESH_SCOPE拒绝：工作流refresh步骤仍读取repair_profile默认Pearl，而本次传入formal_profile Rhino。已逐字段鲜读确认campaign、state、journal、151条全文和Pearl完成证明完全未变。未应用的首份测速profile私有保留；新增入口绑定回归通过，修订profile独立生成，旧已应用正式count profile永久不改。

双会话Rhino入口候选已生成40个不同工作槽与40个不同会话，11负例通过；独立Python与Runner计划一致、7负例通过。会话生成器原0—19限制已在候选中按独立计划许可扩展；尚未production import，后续正式重入须绑定成功测速源和精确计数，不依据候选直接派发。

### 15:36 measurement control entry correction

The first corrected maintenance 36831116015 failed before gateway connection at RHINO_FORMAL_OPERATION. Fresh readback preserves all 151 rounds, campaign, states and journals. The controller now uses an independently tested operation policy: only the bound Rhino v2 measurement refresh is admitted; wrong profiles, modes and unbound refresh remain rejected. Twelve scoped tests pass. No new source request or count write occurred. Stable throughput and multi-session comparisons still await actual runs.

### 15:48 concurrent-session implementation and bounded review

The 20-minute Rhino baseline source 36831981152 uses fixed runtime a5fcad83217260da96aef4262d0999ead09f0b34. All 20 capture jobs were observed running; no failed job was observed. Admission succeeded. Source allowance remains the existing 299849 complete rounds; this observation window does not reset it. Stable throughput has not yet been measured.

Rhino-specific independent session layouts now support the reviewed 1→2→4 steps with twenty host jobs. Forty session identities remain distinct, Python validates the same plan, and old single-session plans cannot expand through environment settings. The old failed historical baseline must retain its audited hash; new failed batches block handoff. Thirty-three affected Node tests and four independent Python tests pass. No new layout profile has been generated or applied. Four lanes still require a stored matched comparison proving higher throughput without errors, unknown outcomes, resource holds or request-tail regression.

A read-only observation-window review uses the existing native gateway, 100-record pages, batch settlement proofs and independent Python record verification. It does not mark a partial game complete or write capture state. Seven tests cover 2501 records beyond the old small helper bound, missing/unverified records, active batches, concurrent changes and baseline tampering. A separate local replay verifies all 151 actual historical records. This GitHub review route remains subject to Linux preflight and an ended healthy source run.

A compound local command preparing a custom server-side pagination reader was rejected by automatic approval review with only “blocked by policy”. It did not execute and was not retried through another wrapper. No custom server reader was installed. The new review instead uses the existing constrained native read operations and performs business validation on GitHub.

AG reference applied here: independent per-session ownership and canary-before-expansion; healthy work continues while local repair and preparation progress; failure evidence is preserved rather than replayed; staged concurrency is selected by measured throughput, error rate and resource limits. SG retains exact complete counts and current authorization. Actual two/four-lane comparison, full workflow relay and remaining repair reentries are still unfinished.

### 15:54 repair regression and avoidable-preflight reduction

While the fixed Rhino baseline remains running, Mansion single-slot additive Hard Hat retrigger validation was integrated independently into Python, Runner and collector. All seven private positive prefixes and six negative cases pass the production validators; all 152 historical complete records still pass independent Python verification. The six-to-seven award/count progression remains strict. A corrupted zero CFFGT with an increased total now selects the strict retrigger validator instead of falling back to the older Hard Hat path. The terminal sample remains synthetic; this change grants no new source budget and does not resume the old interrupted round.

Successful Linux preflight can now be reused for configuration-only commits only when the scripts, service, collector and workflow Git tree identities are exactly unchanged. Failed/running checks, foreign repositories, wrong workflow or attempts, dirty runtime files and any changed runtime tree are rejected. Profile validation, fresh ownership checks and unique run admission remain independent requirements. Three utility tests pass. This removes redundant full Linux runs for unchanged code; no measured end-to-end improvement is claimed yet.

### 16:00 bounded measurement without duplicate raw exports

The read-only paged window review now streams numeric ten-minute summaries while independently verifying each persisted complete record. It reports completed rounds, request histogram p50/p95/p99 upper bounds and reused connections. Missing or inconsistent timings, startup gaps and intervals shorter than ten minutes cannot qualify as steady-state evidence. It excludes abandoned and in-flight records explicitly. Nine affected review/timing tests pass, including a 2501-record bounded scan.

A separate draft builder requires the verified ended window, bound source permission and exact parent/pool/campaign hashes before preparing a two-lane profile. Seven draft tests preserve remaining counts and reject inconsistent proof or skipped concurrency steps. A draft grants no new allowance and requires fresh independent activation. No two-lane source has yet been dispatched.

Linux36833151565 failed on an old synthetic Huff fixture that expected a retrigger without award/board/slot evidence and then decreased its total. The fixture now explicitly rejects this malformed chain; the legitimate retrigger tests remain positive. All 44 affected Python tests passed locally and Linux36833484513 subsequently succeeded. The fixed Rhino baseline runtime was unchanged.
