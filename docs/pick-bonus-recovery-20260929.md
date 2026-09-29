# 32836 Pick A Ball 实际适配与接续结果

2026-09-29 09:25 北京时间：FID1独立Pick A Ball已实现并观察到真实完整结算。新采sequence1705使用BET/FEATURE_START/FEATURE_PICK/FEATURE_END四帧，固定FP=0|1|1，实际stake25、TW500、bonus3，Python与独立TypeScript核验一致，Mongo全文相等。普通/FID0及原Foam20字段和mapping hash不变；组合栈、其他菜单及免费中触发仍保留边界，不代表整款所有功能全覆盖。

## 两次精确维护

- 36505642214（8f60217）成功，proof9484c5ba3f7e6411e91b23ee120f866101537f4f0a5b18bac6222765ca712136。私有备份后补12条已完整待写，190/190全文核验，原1008成功BET/attempt/session保持，生成新接续许可。源请求0。
- 短采36505910982：19worker各新增10，190新增完整全部落库。worker38在源请求之前被旧CFG2固定检查拦下，ERR_ASSERTION；原1008及许可未消费。确认是BatchController遗漏，未归因源端/网络/会话。修正为按原Quarterback完整序列由Runner与Python独立核对，并增加实际Controller领取回归测试。
- 36506986073（024f80c）成功，proofa03113395a74234cb3dbfec7c5b10ef4df579fdb8095313cf595a1043f659a05。新的380/380现场和全部记录私有备份后重新绑定，原1008、旧许可、全部有效记录保留。源请求0。
- 上述proof均已应用，不得重跑；两个config/pick-*.json冻结。历史session/terminal/protocol/Panda/SQLite证明也不能复用。

## 最新短采与保护现场

36507292885:1在024f80c运行20采集步骤，103源请求、71BET、71新完整记录。原batch11/worker38/sequence1008成功进入接续，但FEATURE_START明确返回ERROR_INVALID_SESSION，拒绝全文已追加原成功BET，awaiting=null，没有未知在途。此时许可已消费，不能清runKey或直接重跑。该错误不否定新1705真实FID1结算，但原1008未结算，不能用新局冒充原局恢复成功。

第二组451完整日志/440Mongo全文、11完整待写、唯一pending1008两帧。第一组164/164及4原pending逐条不变。本轮全部615完整原始/规范化/摘要通过，604Mongo全文相等；上次恢复前544条完整逐条不变。两个短采共新增261完整，原有效记录删除0、旧BET重放0。

目前13/178款完成，ready0；primary hold=false，secondary hold=true（SOURCE_REJECTED/batch11），共同保护停采。两个SG_TRIAL_ENABLED=false；primary手动入口active，secondary被verify关闭。未执行任何validate/formal，实际采集0。源码与非敏感报告同步两仓库，服务器Mongo-only入口未改。

## 后续处理

按新的明确拒绝证据建立独立Mongo v2恢复：私有备份最新451与原1008成功BET+拒绝，补11待写并全文readback；只归档这个明确拒绝attempt，建立不同身份的新attempt，绝不重放旧BET或换会话接管旧局。真实1705/bonus3与Foam20/bonus2是已验证功能证据，必须保持不变。新proof/commit/唯一短采run需重新绑定，旧451不变、20worker各新增10（预期651必须实测）、全量核验后才可formal。primary4原局保持，不按时间推断失效。

## 验证与私有归档

Windows/Linux241Python；最终Node160通过（含实际领取、协议、恢复及导入的共享测试），TypeScript、25collector、3000离线夹具通过。最终Linux预检36506755181成功；这些离线结果不算官方新增局。

7个运行全部metadata/jobs/logZIP已CRC/SHA校验，现场及冻结profiles共有33文件双份私有归档。规范化最新快照hash为d92060af49bdc0b95a3c1f4d8ac25621a8e5169f07449f7c8c8b3f8e146bdc68。完整归档SHA256为00afc902b5b3f440867f3e923811fa5506a38f8afbfe4caf7fafec794cc8ab3a，5793542bytes。原GitHub运行均保留。具体机器可读结果见[pick-bonus-recovery-20260929-result.json](pick-bonus-recovery-20260929-result.json)。
