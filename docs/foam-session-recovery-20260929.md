# 32836 原113会话拒绝的独立恢复

## 实际执行结果：2026-09-29 08:29 北京时间

固定代码`e2db5812406de1d962fc495d7c9de066213df290`的Linux预检`36502113492`成功，与Windows均通过236项Python、99项Mongo v2 Runner、41项协议Node；Linux另通过25项collector/TS和3000离线夹具。

`foam-session-recover`运行`36502255869`成功，proof=`e7f27d5d32f136ee5b53c982d5ea0b887b9b15415f4dc286b4e54e36d32db7f6`，已经应用，严禁重跑。15条旧待写补齐，118条完整全文核验；只归档被明确拒绝的113，旧局结算0，源请求0、重BET0、有效完整删除0。私有日志前缀`secondary/foam-session:foam-session-36499471583`保留完整proof/before/逐批records/abandoned:2/backup-complete/reconciled，配置`config/foam-session-20260929.json`冻结。

随后同commit短采`36502517559:1`发出99次源请求、73次BET，新增72条完整日志。独立替代sequence113已成功普通结算，attempt与归档旧局不同，BET时间晚于恢复，原worker/batch/会话摘要归属不变，Mongo全文相等。没有复原或重发旧局。

本次首个新停点为worker38/batch11/sequence1008成功BET后触发FID1 Pick a Bonus，UNKNOWN_TRIAL_FEATURE。没有新的源端拒绝或未知在途；两global-hold均false，secondary pool因PROTOCOL_VALIDATION_FAILED暂停。当前secondary190完整/178落库、12待写、1原样pending1008；primary164/164与4pending未变。354条完整日志全部核验、342条Mongo全文一致，原282条完整记录逐条不变。仍完成13款、ready0、实际采集0。未执行validate/formal，不能把替代113已成功当整组318验收通过。

三个运行metadata、全部jobs与日志ZIP均CRC/SHA核验，连同完整恢复前/后/新停点快照私有归档为`reviews/foam-session-natural-stop-20260929/full.tar.gz`，SHA256=`a167cc8e345ff8f8aa23b4d82b2cd742348160be84e6569599f96e36d7c202c9`，17个文件。新停点规范化snapshotHash=`e11d1b434af9c8458d89e8e64af21a69b75f8e5b1754528703306ab53a3917aa`。本机另有完整副本；未删除任何GitHub运行。

两变量false，primary入口active，secondary被短采verify保护关闭。08:28无运行/排队，worker租约0；13个batch仍有未来时间戳，不能据此宣称全部租约已过期，也不能把它们当13个实际采集分片。任何新恢复仍需新鲜边界核对。服务器Mongo-only入口未变。

下一步是[新FID1协议适配](quarterback-pick-a-bonus-observation-20260929.md)，保留成功BET1008接续；它不是可按本操作器清理的失效会话。第一组4原局仍需独立受控接续。下方是已应用操作器的历史设计，不授权重跑或复用其proof。

## 已应用操作器设计

仅适用于短采 `36499471583:1`：原batch2/worker21/sequence113的FEATURE_START返回明确ERROR_INVALID_SESSION。旧BET和拒绝已保存；新完整118条、Mongo103条，其他pending为0。primary32739的164完整及4个原pending不在本操作器修改范围。

`foam-session-recover/validate/formal`在GitHub执行，测试服只执行现有Mongo原生读写。固定profile绑定16个batch、campaign/pool、原终局恢复proof、原113前缀与拒绝、真实Foam20的完整record及Mongo全文、代码文件摘要；仅两小时有效。运行前两仓库必须无其他任务，租约到期、资源/磁盘允许、共同hold精确为此SOURCE_REJECTED/batch2。任何未知请求、其他拒绝、XML/PAYLOAD不一致、其他hold或数据库内容冲突都拒绝恢复。

先保存新proof、完整当前现场、旧备份、逐批118条完整记录、被拒绝113的完整原文；备份确认后补齐15条待写并118条全文readback，再清除原113待处理状态，归档为`source-invalid-session/abandon_without_replay`。旧局永不重发BET或交给其他会话接管；下次原worker创建独立新attempt与INIT。最后重置当前组租约、绑定新唯一短采run/固定commit，并仅解除精确已审查的secondaryhold。部分执行失败不能盲目重跑。

短采必须20worker各新增10，共318条完整记录，全部Mongo全文一致、118旧记录不变、pending0；替代sequence113必须不同attempt、BET时间晚于恢复，并保持原worker/batch归属。真实Foam20原record/raw/奖金及Mongo内容不变。验收明确记录旧113已归档、旧局结算0、独立替代attempt结算1；不能把新Foam20称作旧113接续成功。15分钟内同代码同pool/campaign摘要才可formal，随后另行开启正式采集。

上方记录实际恢复成功与短采未通过；本次新proof及旧terminal/session/protocol/Panda操作器profiles全部保留冻结，不复用、不修改。
