# 两个明确会话拒绝与未启动短采的精确恢复

## 2026-09-29 07:14 北京时间实际执行

固定 a6ee0b9：primary session-recover `36495340810` 成功，proof `922baf840c37342a2fb0125712cd727fe59be519b283a1066ab1b726959954bb`；164旧完整记录全文保留，仅明确拒绝的2个attempt私有归档，另4个原pending不变。secondary `36495748952` 成功，proof `ab5e7634aa159e0df2aef22ad9ac535a11a488de9601bcbba717ce3e2a1ee5e8`；42旧完整记录与唯一原pending保留。两个proof均已应用，绝不能重跑。

随后只启动 secondary 短采 `36495948701`；20分片进入采集步骤，合计45次源请求、31次BET、30条新增完整日志。第一组没有派发短采。worker23在 batch1/sequence20 的新局实际完成 BET→FEATURE_START→FEATURE_PICK→FEATURE_END，END成功返回FID2但省略整组结束计数，旧判断报FOAM_MISSING_END_COUNTERS并共同保护停止。不是会话拒绝、网络未知结果或Runner容量失败。旧原sequence113尚未发送START，原pending及许可未消费。

32836现有72完整日志、62条Mongo全文一致（10待写），另2pending：新sequence20含完整四帧，原sequence113含原BET。32739仍164/164、4pending，两个已归档attempt不恢复为原局。全部236条完整记录已离线逐条校验，原206完整数据保留不变。

END修正精确限定此游戏四帧独立Foam链，FID保留但CFG/FS/NFR/CFR/CFP全缺失允许结束；部分计数和正免费计数仍拒绝。真实sequence20独立Python/TypeScript回放得到stake25、TW350、start99958、end/AB100283、bonus2；尚未写入完整局，不计为新增完整记录。已应用profile文件完全冻结，测试校验原完整profile摘要并确认新代码无法沿用旧许可，生产版本检查没有放宽。

Windows236项Python、124项Node（83 Runner+41协议）、TypeScript通过；真实数据回放源请求0、现场改写0。后续必须新建本次END现场的Mongo v2证据绑定操作器：无源重发地结算已收齐四帧、补写10条待落库记录、保留原113及Demon4pending，审查共同hold及新run/commit许可后重新短采。不能直接点重跑、修改runKey或沿用本次session-recover。

以下是本次已经执行的操作器设计说明，不能作为下一次恢复的授权proof。

实现针对 [已归档事故](protocol-short-session-stop-20260929.md)，使用原 `trial-300k.yml` 的 `session-recover / session-validate / session-formal`，只在 GitHub 执行。没有增加通用忽略错误或自动更换会话逻辑。服务器继续仅执行受限 Mongo 原生操作。

primary 的 `config/session-demon-20260929.json` 固定失败运行 `36492435648:1`、当前 campaign/pool/15批摘要、此前已应用 proof 及旧备份摘要；secondary 的 `config/session-quarterback-20260929.json` 固定 `36492439112:1` 及其4批现场。配置有效期两小时，只能使用已绑定文件版本。两个仓库必须均无其他活动/排队任务，全部原租约已结束，没有 bootstrap / 请求未知在途、完整记录与 Mongo 全文一致。

## 允许的改变

- 只允许 primary batch2/sequence115 和 batch4/sequence333 的异常 attempt 归档；必须逐帧保留原成功 BET 前缀，并仅多出一个成功传输的 FREE_GAME 拒绝响应。`sourceRejected=true`、`MSGID=ERROR/EID=ERROR_INVALID_SESSION`、XML SUCCESS/PAYLOAD 和精确摘要全部匹配。其他错误、BET 拒绝、未知请求、前缀变化都拒绝此操作器。
- 先持久保存新 proof、两组各自完整前状态、逐批完整局副本、两个异常 attempt 原文及 backup-complete，再清理这两个未完成 attempt。有效完整局删除0、源请求0、BET重放0；原会话标识、批次范围、计划、历史及目标不变。
- 其余 primary 四个 pending、secondary 一个 pending 必须与原恢复前完全一致且原许可未消费。为它们重新生成绑定新提交、原会话、原 worker、原 pending 摘要的单次接续许可；原成功 BET 不重发。
- 两个异常原局归档为 `source-invalid-session/abandon_without_replay`；后续只能在正常初始化流程中建立不同 attempt，不能将原下注转给另一会话或把原局记作完整。
- primary 只有在所有备份、记录核验及精确修改完成后，才以 CAS 解除本次固定的 SOURCE_REJECTED 共同保护。其他组有 hold、原 hold 已变化、磁盘或资源异常均不解除。secondary 的重新绑定必须在 primary 本次精确审查完成后执行，本身不修改任何共同 hold。

## 短采与正式采集

重新绑定后的短采仍限20个固定worker各10局，绑定唯一run/attempt与同一代码提交。primary 应有364个完整局，其中164旧记录不变、4个原局以前缀和原attempt接续、2个替代attempt身份全新；原special batch5/sequence432仍须真实bonus2结算。secondary应有242完整局，42旧记录不变且原sequence113完整BET→START→PICK→END、bonus2。全文 readback、全部 worker 增量及无 pending 通过后，15分钟内且现场未变才允许 formal。

若其余原会话也返回拒绝，立即按原共同保护停止并保存新响应，不能沿用本次两个异常的授权证据来批量丢弃其他局。部分执行失败、已使用proof、过期或不同提交、重复短采均拒绝；不得直接修改runKey或套用旧protocol-recover/Panda/SQLite清理。

实现入口 `scripts/runner-v2/session-control.mjs` 与 `session-recovery.mjs`。专项测试覆盖仅归档明确两局、未知/权限/错误XML拒绝、前缀和许可变化拒绝、活动运行/租约/共同hold拒绝、备份失败不动原局、保留secondary原BET、不同新attempt与真实特殊结算验收。当前本文件记录实现，实际执行结果另行追加，不能把离线测试当恢复成功。

Linux预检 `36497112735` 在结束修正提交 `6a29299` 成功：236 Python、83 Mongo v2 Runner、41协议Node、25 collector、TypeScript、3000离线夹具，未连接SG或Mongo。尚无本次新END现场可应用恢复proof。

六次新运行的metadata、全部jobs、日志ZIP已校验CRC/SHA，连同恢复前后完整私有现场双份保存于本机.local及服务器reviews/session-end-stop-20260929。归档session-runs-20260929-full.tar，SHA256 `fdce1fd866b03e87bdc7fecdc7ef8326992697c84339eb8176addd34af6de99c`；新快照规范化摘要 `107c3472fbbd4a9960f624e77eed666a6285878bce0f187908135013c81d00d3`。07:21北京时间两仓库无活动/排队，已保存租约均到期；下次操作仍需读取实时边界。GitHub运行没有删除。
