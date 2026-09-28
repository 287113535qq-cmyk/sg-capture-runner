# 两个明确会话拒绝与未启动短采的精确恢复

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
