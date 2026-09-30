# More Puff 有限试点实际结果（2026-09-30）

32718 新增38条完整普通局，原53条全部保留，当前trial共91条Mongo完整记录。另1次BET进入未适配轮盘续玩，已由既有AG停止路径私有留样作废，活动pending和完整待写均为0。真实消耗为39次BET，100次上限中61次未用；尚未办理剩余额度结案，不得重置配置或重新派发原运行。第一轮完成数仍14/178，本款未ready/formal。

固定运行源码为 `2e70191930c1639d5446aafb90afa683c83a91e2`。无源维护 [36682910038](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36682910038) 成功：补写4条旧完整局、保留49条旧Mongo、作废1条旧半局后激活新代际。维护15:18:04创建、15:18:08启动、15:21:09结束，合计185秒。旧Jinzita415条及原关闭证明保留，没有借用其已注销5次。

试点 [36684942513](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36684942513) 于15:39:16创建，首任务4秒后启动，15:42:45结束，合计209秒。20个worker各最多5次BET，6个任务成功、14个失败；仅一个任务遇到原始协议缺口，其余因停池退出。新增完整数逐worker为0/3/5/7/9/18各5，17为4，12为2，4/10各1；worker8的1次BET未完整。不能将14个失败任务当成14条丢失局，也不能用38个完整数替代39次BET消耗。

失败两帧为首BET独立FID2、NFG1/TFG1/CFGG0，随后FREE_GAME返回FID1|2|、NFG1/TFG1/CFGG0/IFG1，GSD含WHSTOP3、WHEELSPIN与新增WHSLICE。现有严格字段集首先以 `UNKNOWN_TRIAL_FEATURE` 拒绝WHSLICE；即使补上该字段，混合FID及继续功能也不符合cash-only范围。已有官方WheelOutro审查将stop3导向Spin，与真实响应仍需继续一致，尚未证明该分支的后续请求和最终结算。不能只加白名单后恢复，也不能称已观察自然轮盘现金终局。

停止路径先持久化两帧全文，写不可变 `sg-abandoned-demo-v1` 留样并读回，再清空batch20的pending/pendingOriginal和租约；disposition为 `interrupted-abandoned-without-replay`。留样内sourceRequests0表示作废动作没有请求SG，不表示原局没有BET。campaign保留的pendingReview只引用该留样的batch/sequence/rawHash；实际活动半局已移除。pool禁用、失败原因为PROTOCOL_VALIDATION_FAILED，campaign仍parking-protocol，有限试点不会调用正式采集的自动下一游戏finalizer。

15:52后的鲜读独立Python全文核验91条，91条receipt与Mongo逐条相同，全部batch的journaled/checkpoint一致；旧53和Jinzita415不变。39次BET由38条完整记录及1条已作废两帧逐条计得；24条INIT/REELSTRIP加39 BET及1 FREE共64条已保存响应。全13个pool、相关3217个batch按nextBatchId核齐，无未来worker/batch租约，磁盘129.55GiB。GitHub仅剩两条已精确隔离旧queued、其余活动0。该快照用于审计，不授权以后派发。

本轮补充5项Python和5项Node针对性检查：未知WHSLICE续玩两帧保存后拒绝，既不产生normalized记录，也不产生下一请求；已应用profile固定hash `9ed50c4e0376120e8a8f2a78a441c72e9a9b231498c7b0094202135076051ead`，代际及Jinzita关闭引用永久冻结。公开测试使用合成数据，真实XML/PID/会话/日志仅在私有证据中。仅测试与报告变更，没有部署或再派Linux/维护/源运行。

## 效率与下一步

实采209秒与数小时适配等待要分别计时。复用已完成的native scope、Python/Runner/collector接线、旧数据导入、会话审计和轮盘入口结论；后续只检查新增分支及其影响，统一提交后运行一次必要Linux检查，不反复定位客户端、重建VM基线、重传旧53或重复全量测试。

下一步用现成两帧私有留样核新的混合轮盘续玩分支，或在无ready时推进下一有限候选。切换前须复用通用退休/结案实现并支持“部分已用且含明确作废”的预算证据，独立绑定39已用与61未用；现有close-v1仅接受每worker0或5且池正常，不能直接套用或放宽已关闭Jinzita配置。修复队列没有源额度；本轮旧半局不续接，未用61不自动授权新会话，也不增加新的100次。完成真实分支适配及独立许可后再安排源运行。

私有增量36文件、581922字节，两端逐文件/总包SHA校验通过：`d5da0a1959c28d1bda137d07bf4b9ea25ba978e1194f808b451387c2805dd807`。旧53完整记录替换为原档案引用，离线还原后快照hash逐字一致；服务器只做文件I/O，并验证原Morepuff、轮盘边界和Jinzita关闭备份。鲜读两仓SG_TRIAL_ENABLED均false，主仓trial工作流disabled_manually。本轮未派发新运行。
