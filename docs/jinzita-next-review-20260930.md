# 下一款 Jinzita：旧现场与切换准入审查（2026-09-30）

下一候选为 32720 Hypercharged Jinzita。本轮没有新增 SG 请求、线上维护或数据库写入；Luxor182、Beaver137、Demon446及其耗尽许可不变。不能把旧数据核验当成新采集。

## 已查明的实际阻塞

32720 在 campaign 中已暂挂，但未迁入当前 native Mongo 控制池。其旧现场仍在冻结的 SQLite/WAL：18个batch、320完整、2个中断大局。Mongo现有314完整与旧记录全文一致，另外6完整仍在旧私有日志中待补写；不是丢失了6局。两半局分别为19帧和1帧，均无未知请求。它们只用于分析，后续统一作废，不续接。

已按文件字节备份旧现场并核验59文件，两端私有归档读回成功。服务器只做文件读写及native Mongo只读查询；SQLite解码和320完整Python核验在本机离线完成，没有在测试服执行玩法算法。

当前Runner私有旧档案导出入口已关闭且绑定原迁移目录，不能把旧档案替换为本款文件，也不能直接给一个不存在的native pool套新100许可。剩余需要一次受控的旧现场导入和本款FID1适配，再绑定新游戏独立有界计划。正式30万计数改造与这条有限试点路径分开。

## 已完成的通用切换修正

`demo-next-game` 现在同时识别已完成的旧残余额度和普通一次100 BET代际。普通代际要求20个worker各5已实际完成，逐条验证100个完整BET收据、会话与Python字段，并核对最外层activation、完整batch覆盖、未补写和租约。返回的是“旧额度已耗尽”的证明，不授予旧游戏更多BET。

11个专项测试通过，包含实际nextGame→retire→rollover→fresh准入、缺收据、篡改会话、重复BET、重复/缺batch、部分stage、活跃租约和未耗尽额度拒绝。完整Runner538通过。用真实Luxor新100逐条调用该证明通过。本轮未单独派Linux，待下一款完整链路统一预检；没有新可派发profile。

旧Jinzita转换候选在内存调用正式RunnerState、Python、MongoWriter、retire和nextGame：模拟补写6、全文320、作废2、保全Luxor182及其旧batch，320条跨代际会话审计通过。未来许可和存储为测试替身，未在线导入或作废。转换候选显式补齐native `pending:null`，没有放宽退休校验。

## 投注边界研究

官方只读 `hyperchargedjinzita/js/app.js` SHA256为 `c3b23a2c481fad8bde0d0d1d9ba36b32e3addc567d505318421020eae560a8b0`。客户端枚举FID1为FreeSpins、FID0为HoldNSpin。直接提取实际响应类的三层 `XM` 方法执行：320终帧判无后续、30中间帧和2半局尾帧判仍有后续，与旧链一致。

本款除NFG外还检查GSD.FGRS；合成NFG0/FGRS1仍判未结束。因此不能照搬“NFG0就是结束”。本次只执行响应方法，wallet/UI是桩，未运行完整请求路由或浏览器；FID1只有旧触发帧，尚无新适配及真实终局，不标ready。

下一步复用现有通用作废/切换流程补齐旧现场导入及本款最低必要适配。三款已耗尽的试点不重复派发，全部已应用profile保持冻结。


## 本次完整入口实现（尚未在线导入）

Jinzita的Python、Runner和TypeScript已接首BET独立FID1。逐帧核对TFG=NFG+CFGG和进度，允许重触发增加TFG；终局要求上一NFG1到0且TFG不变。GSD.FGRS/CFGC存在时必须与外层一致，GCT强制关闭和混合/嵌套仍拒绝。旧base映射不变，独立jinzita-free-v1为6ad07b593661eabd066cc211a7c39ba1192f5aa1ce47621afc768d3c3c6643ae。真实320完整三套解析全文一致；旧单FID1触发仅证明需要FREE，未证明终局，也不续旧局。

客户端边界对照增加了实际request dN及嵌套lN/jN方法，对352真实帧执行响应与请求出口。wallet、UI和基础BET回退为桩，不是完整浏览器；新的FID1完整终局仍是合成测试。

新增受控parked legacy导入：只允许固定私有备份的SHA和字节数，GitHub解码SQLite/WAL并验证记录，写入禁用native池后才生成完整回执；nextGame要求回执与同一profile/runtime/run一致。部分导入不能自动重跑或采集。正常retire负责6条补写及2半局作废，再以新代际切换。真实320通过实际decoder/import/retire/rollover内存链，原Luxor182及全部旧batch、journal保持，320历史会话审计通过；模拟存储不代表线上执行。

测试服新增入口只传输root配置的固定备份字节，不接受客户端路径或hash，不执行SQLite或玩法。此源码尚未部署，当前native范围仍未包含本款；上线还需完整检查、新scope/profile、鲜读租约及唯一维护和有限采样。已耗尽的三款额度保持0。
