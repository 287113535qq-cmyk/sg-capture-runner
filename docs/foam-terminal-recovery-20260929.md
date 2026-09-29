# 32836 已收到完整 END 的精确结算恢复

## 实际结果：2026-09-29 07:56 北京时间

恢复已在固定提交 `9b637908d7a5ef00f146d435b41e42ace9b7c447` 执行成功，不能再次执行这两个 `terminal-recover`。下方原设计中的短采目标仍是验收条件，未达标。

- secondary维护运行 `36498957876`：旧72条逐条保留，补齐10条待写，并以原identity/attempt/raw结算sequence20。73条Mongo全文核验通过，原113保留。proof `4b60c3a4e187ac1e5dedd0465404416a6a52a19f1fb54768f37482b43abcbece`。
- primary维护运行 `36499203054`：164条完整记录全文不变，4个原pending原样保留并绑定新许可。proof `1aea9b7064eb4ac5d682c0d6aca5a2a74693b1ebba9a103bbd4ff13d1ed84bef`。没有派发primary短采。
- 两次维护源请求均为0，删除有效完整记录0，重发BET/END为0。sequence20的Foam奖金350、实际下注25、bonus2已真实落库，不能再称仅离线候选。
- secondary短采 `36499471583` 的20个采集步骤均启动，64次源请求、45次BET、新增45条完整日志。原batch2/worker21/sequence113第一次接续FEATURE_START明确返回 `ERROR_INVALID_SESSION`，触发共同保护。不能把这次失败归因为END计数、容量或已证实的网络/TTL问题。
- 当前primary164/164、4原pending；secondary118/103、15条待写、1个pending113。282条完整日志原始/标准化/摘要核验通过，267条Mongo全文一致；恢复后原237条完整记录逐条不变。113保持原BET/attempt并追加完整拒绝，awaiting为空、无未知在途。

`terminal-validate` 和 `terminal-formal` 均未执行，不得重跑失败短采或清除runKey。原Foam113无法以新Foam20替代接续验收；只有针对这次明确拒绝生成新精确proof、私有备份后归档113，才可建立独立新attempt，并采用新的明确验收条件。第一组其他4个未请求原局不得推断失效。

07:56两仓库无活动/排队，worker/batch租约均到期。两个变量false；primary手动入口active，secondary被verify保护关闭；secondary共同hold为SOURCE_REJECTED/batch2。累计仍13/178，ready0，实际采集0。磁盘约140.80GiB。

本机及私有服务器 `reviews/terminal-end-session-stop-20260929/full.tar.gz` 保存四次运行完整metadata/jobs/ZIP、恢复前后及新停点原始快照、两个冻结profile和逐条审查结果。ZIP CRC与21个归档文件SHA256验证通过，压缩包SHA256为 `0ecc19021f9ea61f6f2bf2f3a420d21447be7a7631adac300401c1a14b91c247`。07:52:44完整现场规范化hash为 `d10ab17a791d2c9e72efab96ee5b208de16c2dacbe69c1545d6eea3645de92e0`；该时刻仍有未到期时间戳，07:56另读确认租约全部到期。未删除任何GitHub运行。

Windows与GitHub Linux均通过236项Python、92项Mongo v2 Runner、41项协议Node；Linux预检 `36498630144` 另含25项collector、TypeScript与3000离线夹具。这些离线测试不计官方新增。新操作器覆盖备份先行、部分执行拒绝重做、完整END幂等补写、原记录/许可/会话不变与拒绝未知请求等约束。

下一步是新的32836会话拒绝精确恢复：先补齐15条已完整记录；仅归档113有拒绝证据的旧attempt，保留成功BET及拒绝全文；新独立attempt不能重发旧BET。保留已真实结算的Foam20作为新方案的功能证据，重新绑定唯一短采run/新commit并核验118旧记录不变、20worker各新增10及替代attempt身份。新方案尚未实现/应用，不能直接套用本次或旧session操作器。

## 已执行操作器的设计边界

该操作器仅处理 `36495948701` 的已保存完整 Foam 四帧，以及没有运行的32739接续许可重新绑定。原始现场见[前次结果](session-recovery-20260929.md)。不能重用已经应用的 session/protocol proof。

`terminal-recover / terminal-validate / terminal-formal` 仍在原采集 workflow 的 GitHub 维护 job 执行，无 SG 配置或请求能力。测试服仍只有受限 Mongo 原生读写。配置固定两组 campaign、pool、每批次、原许可、计划与实现文件摘要，并限定两小时有效。恢复前两仓库无其他运行/排队、当前组全部租约到期、CPU/内存/磁盘保护正常，状态必须与精确现场一致。

先执行 secondary：保存新 proof、完整原现场、原许可和逐批72条完整记录、双端解析产生的候选terminal记录，全部持久化确认后才改现场。batch1/worker23/sequence20 已有 BET/START/PICK/END，无未知请求；以原 attempt、sequence、raw、会话摘要生成唯一 receipt，不发送任何 END/BET。随后批量补写原10条积压和这一条新规范化记录，Mongo全文核验，应为73条。旧72条逐条不变；原batch2/worker21/sequence113仍保存原BET。完成后记录新许可及短采绑定，最后仅CAS解除此次明确FOAM_MISSING_END_COUNTERS共同hold。部分失败拒绝盲目重做。

再执行 primary：只能在本次secondary审查标记存在且两hold为false时，保留原164条完整与4个原pending，重新生成固定提交、原会话/worker/pending摘要的接续许可。此前2个明确失效attempt仍私有归档，绝不恢复或重BET。

新短采每组20个固定worker各10局；先secondary单独运行。验收应为secondary273和primary364条完整记录，全量readback、全部原记录不变、原Foam113和Demon432必须真实特殊结算。已离线结算的新Foam20不替代原113的接续验证。Demon两个替代attempt须与被归档的原attempt不同且在本次恢复后独立开始。一次性短采run/attempt及所有阶段固定同commit；validate后15分钟且现场hash未变才formal。

未知请求、拒绝响应、其他hold、租约活动、原始数据变化、余额/奖金不符或备份不完整都不能被本操作器清除。上方实际结果区分了成功恢复与失败短采；没有正式续采验收。
