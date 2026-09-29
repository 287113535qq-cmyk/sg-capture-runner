# 32836 FID1 Pick a Bonus 新自然触发

2026-09-29短采`36502517559:1`，代码`e2db5812406de1d962fc495d7c9de066213df290`：此前明确会话拒绝的旧113已经私有归档，独立替代attempt成功普通结算并Mongo全文核验。新停点是batch11/worker38/sequence1008的成功BET，不是会话或HTTP拒绝。

新pending只有一帧，awaiting为空。FID=`1|`、CFG=1、FS_1=0、NFR_1=1、CFR_1=0、CFP_1=0；NFG/TFG/CFGG缺失，不补0。pendingHash=`8959351887191370ac8c5b6d9e6b63a56d9620559f68bae6076198ad3bf99405`，rawHash=`77bf564632a3b14fae8af2b4f2e1ac9683356325c6616818ab3a00e563255878`。仅游戏pool因UNKNOWN_TRIAL_FEATURE停下，两global-hold均false；短采未达到318验收，不转正式。

官方只读缓存仍是`quarterbackfieldsofglory/game.bundle.js`，SHA256=`789a750fbcc2e3539d1257a3926908c04f5d478cf957b5464b691f06d79fb3ec`；平台`412.bundle.js` SHA256=`43c79de4ffeeebec57ab1a0c7765b47a310d489f82a589bd69be4a495be233a2`。对game文件字符偏移244094附近的Pick a Bonus controller定向审查，没有修改缓存。

- controller使用`platformFeatureLookup.pickABonus.id`；startFeature调用requestFeatureStart，事件携带该featureID。START成功只确认进入功能，不提供Foam的`this.val`选择规则。
- sendFeaturePick发送`featureID:Tt, pickIndex:e, currentPick:jt+1`，该controller的jt初始化为0。平台编码`FP=0|currentPick|pickIndex`，CFP_i单独解析为currentPick。正式适配仍需校验START实际计数，不能凭UI初始化把所有后续帧都当0。
- Pick A Ball的左/中/右三个演出按钮均调用`sendFeaturePick(1)`；Run the Yards发送3；Field Goal发送2。三个客户端分支有明确协议选择值，不能按最高奖励选择，也不能套FID2使用GSD.featureData首项的规则。
- PICK结果使用BVAL及prize/featureData显示所选玩法；Pick A Ball演出结束请求FEATURE_END。其他两种演出各有计数和显示流程，尚未完整实现。
- receivedFeatureEnd更新余额和总赢奖，检查`isFoamFingerNext()`；panelEnd最终调用`checkForBonus(BVAL,savedWinnings)`。因此不能假定FID1的END必然结束整局，必须独立核对后续Foam/其他功能、FID栈和TW/B/AB。

本次只定位真实新分支、下一步START方向和选择编码；尚无FID1完整成功链，也没有新的正式FID1适配器或恢复proof。后续应实现独立bonus映射，保持已有普通/FID0/FID2 hash不变，测试明确支持的选择及终局/后续功能边界，再用新的证据绑定许可沿原1008继续，不能删除该自然触发或套用已应用113异常归档操作器。

现场190条完整原始/规范化/摘要全部通过，178条Mongo全文相等，12条待写；原118条逐条不变。新单帧和其他完整记录均已私有保存，第一组164条及4原pending完全未变。详见[本轮会话恢复与结果](foam-session-recovery-20260929.md)。
