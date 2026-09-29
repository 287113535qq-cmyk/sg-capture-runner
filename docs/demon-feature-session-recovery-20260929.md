# Demon 第432局明确会话拒绝恢复

本次只处理36516662912:1中batch5/worker0/sequence432的明确ERROR_INVALID_SESSION。成功BET与9帧原前缀、完整拒绝XML必须私有保留。195条有效完整记录全部保留，先备份并补写1条完整待写、全文核对，再归档这个旧attempt；替代局使用独立新INIT/newattempt。第9局已恢复的独立替代记录保持全文不变，不再次处理其事故。

batch9/806与batch10/902没有发源请求，不能按时间认定失效。它们保留原attempt、会话和原前缀，仅用绑定本次新proof/commit/唯一短采run的两小时单次许可，从FREE_GAME接续。任何新拒绝、未知或存储错误继续保护停止。

固定入口需17批次、19稳定绑定、195日志/194Mongo、3个精确pending、原12e4恢复proof和失败runKey、两组hold/全部现场hash一致。两仓库空闲、租约全部结束，CPU/内存及磁盘保护允许时才能维护。先保存proof/before/逐批完整记录/拒绝全文/backup-complete，才补写和更新现场；部分失败拒绝盲目重做。服务器仍只做原生Mongo读写及指标。

## 功能验收边界

原第432局已经明确拒绝，不能把它作为原identity结算。此次验收区分：432的新独立替代身份、806/902原identity前缀接续结算、旧195条逐条不变、20worker各新增10、395条Mongo全文一致及pending0。

**上述条件仍不足以转正式。** 同一有界短采中必须至少出现一个新增自然Demon FID1完整大局，Python金额/原始协议校验通过，独立Runner状态机确认有FID1的实际后续FREE_GAME、终帧完成、bonus2，并与Mongo全文相等。记录sequence及attempt/raw/record摘要，formal再次核验该证据，不能用普通免费bonus1或被拒绝旧432代替。

短采仅20worker各10，不加注、不购买、不按结果选择，不改变计划、总目标和会话归属。如果200局内没有观察到该自然功能，validate以LIVE_DEMON_FEATURE_EVIDENCE_REQUIRED拒绝，保持validationLimit10与正式开关false；不自动扩展、不自动无限重试、不将未观察当作验证成功。后续额外有界验证需要新鲜现场审查和独立证据绑定方案。

原demon-session及其他所有已应用profile冻结。新角色demon-feature-session-recover/validate/formal使用原trial-300k.yml。离线测试不代表真实特殊结算。

## 2026-09-29 11:52 北京时间实际结果

固定代码 `cb56952a820c86e2663a99901fc935b5f9efc3cd`，维护36518251211成功，proof `ec23f9e0c9a3e28ef03504cf87e9a952bb0ec63d046d6d00f0c89e5a3f15395f` 已应用，禁止重跑。1条完整待写已补齐，195条Mongo全文一致，仅旧432失效attempt归档，806/902原局保持原样。维护源请求0、旧BET重放0、有效删除0。新profile整体hash `05f5396f4113779d0b48111ca58049581a39ac20086f1534c767b3bdd145a8fb` 已冻结，后续不能重新生成其代码摘要来接受旧许可。

随后同版本短采36518623937:1结束failure：20分片实际采集步骤启动，101源请求、54BET、51个新增完整局，3个worker各10成功。432的独立新attempt已普通结算并完整记入日志（bonus0），rawHash `35179d9d2913f4f7ea6b1df58e242eab90b77f9bfb841e29efc53d7a72c76e5e`；它仍在已完整待写的21条内，不能说已经Mongo全文落库，也不能说旧432成功接续。

新首错为原batch9/worker13/sequence806接续FREE_GAME明确 `ERROR_INVALID_SESSION`。成功BET与2次免费响应前缀保留，追加完整拒绝后4帧；awaiting=null，没有未知在途或HTTP失败。batch10/worker2/sequence902仍未请求、原前缀/attempt/许可不变。另有三个正常已响应未完成局被共同保护保留：batch2/worker1/117（1帧）、batch5/worker0/434（3帧）、batch18/worker7/1706（1帧）。这4个未拒绝pending当前FID0、NFG1，独立字段检查下一步均FREE_GAME，不应与失效806一起删除。

当前246条完整日志原始/规范化/摘要全部通过，225条Mongo全文一致，21条完整待写，旧195条逐条不变。5个pending仅806明确拒绝，未知在途0。没有新增bonus2完整证据；validate/formal均未执行，395条短采及自然特殊验收未通过。primary共同hold为SOURCE_REJECTED/batch9，secondary自身hold=false；两变量false，primary被verify保护关闭，secondary保留手动入口。11:51:44核对仍9个worker/11个batch租约时间戳未到期，不等于实际采集；两仓库无活动/排队，实际源端0，累计14款。

本次新806拒绝尚无新proof。下一步新鲜核对边界并全量备份，补21条、246全文核验，只归档806的明确失效attempt，保留902及117/434/1706四个未拒绝局。恢复应优先设计并测试“先接续已有pending，再开放新BET”的短采阶段，避免另一个旧局拒绝时产生更多新的半局；不能以此绕过共同hold。新的proof仍须绑定具体现场和代码，新增自然bonus2的真实结算要求继续保留，不能以数量或替代普通局放宽。

Windows241 Python和198 Node通过；Linux预检36518120859成功，含241 Python、44协议Node、154 Runner（含共享导入）、25 collector/TypeScript/3000离线夹具。真实旧195记录与3pending已独立只读核验。离线结果不计官方新增。

三次运行全部metadata/jobs/logZIP经过CRC与SHA检查，前后全量现场、冻结profile及逐条核验双份私有备份于 `reviews/demon-feature-session-stop-20260929/full.tar.gz`：23文件、2945326字节、SHA256 `b36f22f9ae3ae14173d4da8d0dcde93e3a895e34e4f7a77fcdbe5395b45717ec`。Mongo日志前缀 `primary/demon-feature-session:demon-feature-session-36516662912` 保留proof/before/17批records/abandoned:5/backup-complete/reconciled，新许可仍按对应proof私有保存。旧GitHub运行未删除。
