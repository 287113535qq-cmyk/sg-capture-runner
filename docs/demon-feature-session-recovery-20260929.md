# Demon 第432局明确会话拒绝恢复

本次只处理36516662912:1中batch5/worker0/sequence432的明确ERROR_INVALID_SESSION。成功BET与9帧原前缀、完整拒绝XML必须私有保留。195条有效完整记录全部保留，先备份并补写1条完整待写、全文核对，再归档这个旧attempt；替代局使用独立新INIT/newattempt。第9局已恢复的独立替代记录保持全文不变，不再次处理其事故。

batch9/806与batch10/902没有发源请求，不能按时间认定失效。它们保留原attempt、会话和原前缀，仅用绑定本次新proof/commit/唯一短采run的两小时单次许可，从FREE_GAME接续。任何新拒绝、未知或存储错误继续保护停止。

固定入口需17批次、19稳定绑定、195日志/194Mongo、3个精确pending、原12e4恢复proof和失败runKey、两组hold/全部现场hash一致。两仓库空闲、租约全部结束，CPU/内存及磁盘保护允许时才能维护。先保存proof/before/逐批完整记录/拒绝全文/backup-complete，才补写和更新现场；部分失败拒绝盲目重做。服务器仍只做原生Mongo读写及指标。

## 功能验收边界

原第432局已经明确拒绝，不能把它作为原identity结算。此次验收区分：432的新独立替代身份、806/902原identity前缀接续结算、旧195条逐条不变、20worker各新增10、395条Mongo全文一致及pending0。

**上述条件仍不足以转正式。** 同一有界短采中必须至少出现一个新增自然Demon FID1完整大局，Python金额/原始协议校验通过，独立Runner状态机确认有FID1的实际后续FREE_GAME、终帧完成、bonus2，并与Mongo全文相等。记录sequence及attempt/raw/record摘要，formal再次核验该证据，不能用普通免费bonus1或被拒绝旧432代替。

短采仅20worker各10，不加注、不购买、不按结果选择，不改变计划、总目标和会话归属。如果200局内没有观察到该自然功能，validate以LIVE_DEMON_FEATURE_EVIDENCE_REQUIRED拒绝，保持validationLimit10与正式开关false；不自动扩展、不自动无限重试、不将未观察当作验证成功。后续额外有界验证需要新鲜现场审查和独立证据绑定方案。

原demon-session及其他所有已应用profile冻结。新角色demon-feature-session-recover/validate/formal使用原trial-300k.yml。实现与离线测试不代表已应用恢复或真实特殊结算，实际结果另附。
