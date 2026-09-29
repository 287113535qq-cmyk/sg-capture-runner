# Pick A Ball 原1008明确会话拒绝恢复

本次仅处理短采36507292885中32836的batch11/worker38/sequence1008。原成功BET之后的FEATURE_START明确返回ERROR_INVALID_SESSION；完整拒绝已持久保存，未知在途为0。旧attempt不得重新下注或跨会话接管。

独立操作器 `pick-session-recover` 绑定本次451条完整记录、440条已落库、20批原摘要、原恢复证明和唯一失败运行。先写私有proof、完整现场、逐批完整记录及原BET/拒绝归档，再补11条待写并全文读回。仅清理明确拒绝的1008旧attempt，新的INIT建立独立身份。primary的164条完整和4个原pending保持原样。

真实功能证据为Foam20（bonus2、stake25、TW350）和Pick A Ball1705（bonus3、stake25、TW500）；两者必须与私有备份、协议分析器和Mongo全文相同。不能把1705的成功当成1008原局结算。

后续短采绑定同一提交及唯一run/attempt。`pick-session-validate` 必须核验20个worker各新增10局、总651条完整全文、原451不变、1008替代身份不同且BET晚于归档、原归档未被改写、pending0。随后15分钟内且状态不变才允许`pick-session-formal`。已应用的旧profile不修改；新故障不能复用本profile。当前文档记录实现方案，实际应用结果另附回执。
