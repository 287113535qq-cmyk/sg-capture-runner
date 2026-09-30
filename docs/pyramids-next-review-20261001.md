# Pyramids 下一款与 Inca 并行修复

32719已正式关闭，94完整保留，29已用、71注销；修复与32721下一款准备独立推进。累计完成仍14/178。健康主线保持固定runtime继续采集，本分支不改变其运行代码。

32721固定旧档案107文件/1239691 bytes，SHA72b7cdcaef7ef9ccfab1a417476bf420946d06efef4580fe840934cb2f87bb8b。13页游标读全1102 Mongo，解码1262完整、160待补写、27批次、4中断。生产导入仅精确绑定新固定档案/数量/layout，原通用1000上限不变；没有线上补写或续旧半局。

官方客户端SHAfd11152a04daf94fa730bcdd4a4309085fb5a7d1aac93c7a1a8c055369942cfc。原始异步helpers、计数映射、请求路由及outro执行确认15自然Hold链（9–25帧，含+2/+4）中间FREE_GAME/Spin、终帧BET/settle，4中断仍FREE。新增独立免费outro确认FGRS与外层NFG不一致时路由和退出可能不一致，因此严格相等。UI/transport/wallet为桩，不是完整浏览器。

Python/Runner/collector及capture已接独立Hold和固定10免费。Hold严格CFGG+1、TFG+0/+2/+4，priorNFG1→0无追加，HNSTW+首BET赢奖=TW；免费固定10次、内外层计数一致。独立核完整XML/同会话/金额/下注20。拒绝混合、外部JPV、Grand、未知字段、强制终止。旧Hold/base mapping不变；10免费独立bonus2，终局只有合成证据。

实际1262 Pyramids和94 Inca记录经Python/Runner/collector比对规范化不变；4旧前缀仍未完成。真实档案在内存调用正式import→retire→rollover→fresh及1262 session audit通过，160补写/4作废仅内存，旧Inca94和29/71结论不变。第二账号next-game路径及未来零源中断结案已接；独立profile/native32721及线上运行仍未应用。

Inca金币免费修复增加独立bonus3 mapping，CL/BGCL官方现金值和3x5唯一位置校验，三方/capture BET→10FREE通过，旧94规范化不变；完整终局仅合成，负值奖池/Hold/混合未支持，未重入、不复用已注销71额度。

本次明确协议缺口走游戏隔离和零源repair，金额/计数/会话/存储错误仍保留共享停写保护。特征索引记录可复用组件与差异，不能继承其他游戏终局或追加语义。此报告不授新源权限或formal资格。
