# Demon 四个未启动续局的新许可

primary32739原terminal恢复后一直未启动短采，旧许可绑定9b637908且已过期。164条完整记录和4个原pending均未变；许可过期本身既不证明SG会话失效，也不允许删除原局。

新独立操作器 `demon-rebind-recover` 只接受原terminal proof `1aea9b7064eb4ac5d682c0d6aca5a2a74693b1ebba9a103bbd4ff13d1ed84bef`、runKey仍null、15批/17个稳定worker及全部已绑定摘要。4个原局是batch1/seq9、batch5/seq432、batch9/seq806、batch10/seq902；下一步由Python及独立Runner同时核验为FREE_GAME。原已归档的batch2/115与batch4/333不恢复。

旧许可仅用于核对历史来源，不被重新授权、延长或修改。新恢复须确认两仓库没有其他运行/排队、原租约到期、两个global-hold关闭、资源可写及磁盘至少30GiB。先持久备份完整现场、原许可、原记录，再创建新proof和绑定新commit的两小时单次续局许可；原attempt、session、下注前缀、计划和额度不变。发生部分失败后禁止盲目重跑。

短采只能由唯一run/attempt消费新许可，从FREE_GAME接续；不重发INIT/BET。`demon-rebind-validate` 要求20worker各新增10、总364条完整全文、旧164逐条一致、4原pending以相同身份/前缀真实结算，且特殊seq432为bonus2。验收后15分钟内且状态不变才允许formal。新的明确会话拒绝必须另行留证审查，不能推断其余会话失效。

本次仅实现与离线验证，尚未执行新恢复或源请求。第二账号正常采集期间不启用该维护，不取消正常运行制造窗口。候选profile若超过两小时应重新读取未变现场、生成尚未应用的候选证据并测试；任何已经应用的profile永不改写或复用。规则和旧普通/FID0映射不变，Demon原FID1的真实结算仍待受控短采。

候选dbd703d已通过本机173项Node，以及GitHub Linux预检36511528799的241项Python、44项协议Node、129项Runner（含共享导入）、25项collector、TypeScript和3000离线夹具。真实primary164条原始/规范化/Mongo全文与旧现场一致，4个原pending通过Python和Runner的下一步核验。测试包含过期旧许可拒绝、备份失败不变更、唯一短采run、原身份/前缀/记录变化拒绝及364条全文验收；没有把夹具当成官方新增。

当前候选profile创建于2026-09-29 10:09:17北京时间，两小时后会被拒绝，尚未应用。10:15:57第二账号仍20个有效worker、171527完整日志/170500checkpoint，两holdfalse，因此未派维护或短采。完整原primary现场、候选profile、预检metadata/jobs/ZIP已在本机和私有服务器双份核验，516293bytes/8文件，SHA256 `5bb73fdad2e2c5a9883261d78a8240953bd7d1b7b877b11be737da4554b37a97`。见[候选结果](demon-unstarted-rebind-20260929-result.json)。
