# 32833 网络结果未知与受控恢复

2026-09-29 04:06 北京时间巡检发现两个矩阵已停。32746 已完成新采 299850 局全文终审，加 150 局核验历史达到 300000，总完成游戏增加至 10 款。

第二组运行 `36472693926` 在 19:52 UTC 报告 `SOURCE_NETWORK_OUTCOME_UNKNOWN`。32833 Panda Pow 的 batch 81 / worker 38 / sequence 8004 保存了 BET 意图，没有响应；它仍属于未知结果，不能宣称下注失败或重发。20,493 个完整局保留，其中 19,800 个已落库、693 个待核验补写。唯一未完成 attempt 将依据用户既有授权，私有完整备份和精确 proof 核验后归档为 `unknown/abandon_without_replay`；新 INIT 后建立新 attempt，额度、会话绑定和有效完整局不变。

第一组 32739 The Demon Code 在运行 `36474147259` 触发 `UNKNOWN_TRIAL_FEATURE`，pool 进入协议暂挂流程。保留 164 个完整日志和 6 个已有响应的未完成局，均没有未知在途请求；错误局 batch 5 / worker 0 / sequence 432 已有 BET 和 8 个 FREE_GAME 响应。该游戏不能删除自然触发以绕开适配。共同保护解除后由既有协议暂挂机制保存现场，再继续其余 ready 游戏。

私有 Mongo 备份包含这两款的全部状态、日志及已落库全文，manifest SHA256 为 `d7870a8910a4892db498cee5f34e9ab7369a6ceed22d62f4c4c50bb577c55f71`。本机独立压缩副本逐文件核验通过，SHA256 为 `2974f3da210d12cf38f45cb93b74f394d33e2bc5e9004e5a11a520a5d9f290ee`。三个相关 GitHub 运行的元数据、完整 jobs、日志 ZIP 已留存并核验 CRC / SHA256；未删除 GitHub 运行。

新增 `incident-control.mjs` 只从 GitHub 使用 Mongo-only 通道执行本次精确 profile，不能代替通用自动丢弃。它检查计划、状态版本与摘要、批次/会话、无活跃或排队运行、租约过期和 proof 时效。先重放校验所有完整记录并核对 Mongo，持久保存原 failure / pending，再归档唯一未知 attempt，补写 693 局并全文读回。恢复后仅每分片 10 局短采，全部新旧记录核验和独立 formal 步骤通过才正式续采。资源和磁盘保护继续生效，原 SQLite 恢复脚本不参与。

同时修复共同停采记录：第一个 active hold 保留原原因，其他分片退出时的 `GLOBAL_SOURCE_STOPPED` 不再覆盖首个故障；新增安全的错误代码字段。它不改变触发停采的条件。

## 实际恢复与短采

代码 `992d37f` 的 Linux 预检 `36478326724` 成功，本机 54 项 Runner 测试通过。后续 `8847a07` 明确识别短采时持久化的安全 worker release：仅在两仓库全部采集结束、同 owner/session、worker lease=0、resumeSafe=true 且无 pending 时，批次遗留时间戳才不被误认为仍在采集；未知现场恢复仍要求原批次租约过期。其 Linux 预检 `36479394467` 成功，Runner 测试增为 55 项。

恢复运行 `36478612647` 于 20:23 UTC 成功。新的精确 proof 为 `2e38b9613912dd503875b5a80bc8e31152dddc218d09de43ec9a202ca9d6252b`，**已经应用，不得重跑**。20,493 个原始/规范化/日志/Mongo 完整局全文核验通过，693 个待写局完成补写。唯一未知 BET 已私有归档，重放 0、完整局删除 0；会话、批次额度、计划不变。完整原记录摘要为 `d622f2087ef76f2669f41f19f54e5ce34856e2c20983025b4273511d728e8eaf`。

短采 `36479003106` 成功，20 个分片每个新增 10 局，共 200 个官方完整局。独立验收 `36479666551` 于 20:34 UTC 成功：20,693 局全文核对、20 个 worker 各增加 10、pending 0；再次核对原记录摘要不变。短采结果对应 poolHash 为 `7415f78039c8ddbe4a6072b4cfda41a470928c4c29bff4e3541f60fa4a5d4480`。

原故障运行日志的本机与服务器私有副本均已校验，压缩归档 SHA256 为 `1642ffa9bf5e867ac95d3cd36c6167c4c8cdb3ebfc7e41f05c434ea22685aea1`。正式续采实际运行证据见本报告配套结果文件。规则档案区分当前观察与完整覆盖，30 万局不代表观察到所有玩法。

## 正式续采已恢复

`incident-formal` 运行 `36480219360` 于 20:36 UTC 成功，两仓库均恢复 `SG_TRIAL_ENABLED=true`、原 workflow active。重新核对无采集/排队后，每组只派发一次正式任务：primary `36480623741`，secondary `36480630609`，均使用 `8847a07`。后续自动接续和原定时继续负责推进。

2026-09-29 04:42:17 北京时间实际快照：两组各 20 个 worker 有效工作，primary 已转入 32745，完整日志 9844、checkpoint 9000；secondary 继续 32833，完整日志 26777、checkpoint 25700。两组 pool.failure 均为 null，global-hold 均为 false，磁盘约 147.46 GiB。运行中数字持续变化，不等于全游戏终审。队列 complete10、active2、parked-protocol7、ready4、needs-adapter155，总数178。

32739 的 16 个原 pool/batch 状态与备份逐条摘要一致，并逐一匹配 16 个新的私有 parked 快照；164 个完整日志和 6 个已响应未完成局均未改动。新观察记录见 [The Demon Code 分析](demon-code-observation-20260929.md)。

本次对两组 `game-rules:` 日志前缀做了只读索引查询，尚无真实终审观察摘要：已完成款使用的是较早固定版本。当前新运行已经包含归档模块，后续全文终审时顺带生成；未为了补档重扫旧完整数据。静态 178 款规则卡和新增协议观察已更新。六个预检/恢复/短采/验收运行的完整元数据、jobs 和日志在本机与服务器双份私有留存，CRC/SHA256 已校验，归档 hash 为 `b04f49ddfdb2fac37de20948d2dda6db253bdeb76ad519263eacc2213ecc5f55`。
