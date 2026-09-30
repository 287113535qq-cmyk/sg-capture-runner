# 下一候选32718旧现场审查（2026-09-30）

Huff N’ More Puff High Limit（32718）已选为下一候选。鲜读确认它在primary队列暂挂，native state/journal均0，当前trial Mongo49条。固定旧SQLite/WAL共13批，离线复用正式parked_legacy解码器核验53完整：49与Mongo全文原样，4条是旧完整积压，另1条中断BET。没有新增采集或业务写入，尚未导入native。

原半局为FID2、NFG1、TFG1、CFGG0、awaiting=null，只有一帧。它仅作分析留样，后续按通用规则作废，绝不续接。

只读官方缓存实际目录为`huffnmorepuffhighlimit/js/app.js`（不是计划slug后缀96的目录），SHA256 `48898ee09234a8c2388358e6f1f0f760e79f18f7f9290f14b8f87e42a6ffd469`。本轮直接提取并在VM执行官方响应续局判断、计数映射、请求类型选择、WheelIntro和WheelOutro方法。53个真实旧终帧均回到BET边界；1个中断触发帧为FREE_GAME。没有执行网络请求，也没有续接旧局。

FID2在本款官方枚举中是Wheel，不能照搬其他游戏的独立免费局适配。`CFGG`映射`Bb.Wf`，`NFG`映射`Bb.Ee`；两者不能混淆。WheelIntro实际请求FREE_GAME；下一响应的`GSD.WHSTOP`才决定轮盘后续。官方12个分支以合成控制状态执行的结果如下：

| WHSTOP | 官方出口 | 限制 |
| --- | --- | --- |
| 0、2、7、8、11 | Idle | 独立组合功能标志Xi为真时仍进入CombinedFeature，不能直接结算 |
| 1、3、4、5、6、9、10 | Spin | 继续后续玩法，不是完整局终态 |
| 未知值 | 无已识别出口 | 拒绝判断完整 |

这些是实际客户端方法配合UI、动画和钱包桩的离线执行。12个轮盘结果均为合成控制状态，尚无真实FREE轮盘响应或完整FID2终局；不是完整浏览器或线上适配证明。只看NFG归零仍不足以放行下一BET。

私有`wheel-candidate.mjs`进一步约束原始字段：只接首BET独立FID2触发及单次FREE后的明确现金出口，核同会话、普通请求参数、有限计数、WHSTOP、组合符号、金额；拒绝进一步免费玩法、混合FID、未知字段、GCT强制终止及缺少轮盘结果。4组测试通过，包括真实旧触发和合成终局/负例。候选未接生产Python、Runner或collector，也没有XML全文及独立规范化集成，因此不是准入许可。原完整53不受改写。

原39个文件按字节留存本机和服务器私有备份，两端归档SHA `366dccfb04a68b9ad5936be9689ffa079d5ff02c174172c4d5a8abc8ce9c4184`，原文件未改。服务器只读文件字节和Mongo，不执行SQLite或玩法。下一步将上述有限轮盘范围接到独立Python/Runner/collector完整校验和实际capture入口，再复用受控legacy导入与已完成的试点关闭证明。32718的独立native scope/profile和统一Linux仍待完成。没有借用Jinzita已注销5局或新授采样额度；本轮仅本机离线，没有读取新线上快照、维护或实采。
