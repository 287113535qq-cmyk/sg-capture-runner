# 32836 独立 Foam Finger 协议

实际执行更新：恢复已应用，旧 42 个完整记录已落库核验；随后短采被 primary 的会话拒绝共同保护拦截，32836 源请求为 0。尚未验证真实 Foam 结算；旧 proof 不可重跑。见[现场结果](protocol-short-session-stop-20260929.md)。

候选适配按官方只读 `quarterbackfieldsofglory/412.bundle.js`（SHA256 `43c79de4ffeeebec57ab1a0c7765b47a310d489f82a589bd69be4a495be233a2`）及 `game.bundle.js`（`789a750fbcc2e3539d1257a3926908c04f5d478cf957b5464b691f06d79fb3ec`）实现。原现场和历史流量见 [观察报告](quarterback-observation-20260929.md)。本文件说明实现边界，不授权解除暂挂。

正式解析入口为 `service/quarterback_fields.py`，独立 Runner 镜像为 `scripts/trial/quarterback-protocol.mjs`。Mongo v2 GitHub 分析器按 sourceKey 精确选择本游戏；旧 SQLite 服务不启用。普通计划 BPR1/RB5、实际 stake25、buy0、planHash 不变。

## 请求和结算

仅独立 `FID2| / CFG2 / FS_2=0 / NFR_2=1 / CFR_2=0 / CFP_2=0` 的成功 BET 进入此路径。之后为 FEATURE_START、一次 FEATURE_PICK、FEATURE_END。START 的 `GSD.featureData` 以分号分段，客户端保存首项 `this.val`；`sendFeaturePick` 忽略按钮位置参数，提交 `FP=0|CFP_2+1|this.val`。不能选择最高奖值、把按钮索引或别的游戏 FP 代入。

START 必须提供可校验的 CFP_2 和 featureData；成功 START 可以缺 FS_2，但不能伪造缺失内容。PICK 响应必须保留当前 FID2、CFG2 且 CFP_2=1。END 必须成功，若 FID2 保留，则必须能核对 NFR_2/CFR_2；获赠一轮、已完成一轮允许 NFR_2=1/CFR_2=1。此含义来自平台 `picksRemaining = numberOfPicksWon - index`，并由 foam controller 收到 PICK 后请求 END、收到 END 后返回 readyForNextSpin 的路径限定。其他游戏的 NFR 完成保护不变。

整局只允许一次 BET、同一 PID、准确普通请求参数；每帧成功 XML 与保存 PAYLOAD 一致。最终 B=AB，TW 与初始/最终余额核算 stake25。NFG/TFG/CFGG 缺失仍原样保留；本独立路径若发现正值、其他 FID 栈或其他功能字段则继续暂挂，不能按缺 NFG 提前记完整。没有响应的请求不重放。

## 映射与保留信息

普通/FID0 使用原 profile 与 mapping hash。只有完整 foam 链使用追加 `quarterbackfieldsofglory96-round-one-base-v1-foam-pick-v1`，bonus2=独立 Foam Finger，buy0。没有将未经验证的复合玩法归为 bonus2。

规则卡保存请求、完成识别、字段和证据版本；终审顺带统计 FS_2/NFR_2/CFR_2/CFP_2 与功能字段存在次数。featureData、FTV/FPM、BVAL、display 原文仅留私有证据，不进入公开观察值。没有为留档增加 SG 请求或重扫已完成的30万局。

FID1 pickABonus、`2|0|`/`1|2|` 等复合栈、免费途中触发、二次选择仍未覆盖。历史只有普通/FID0；合成完整链用于测试，不是官方真实结算证据。原 batch2/worker21/sequence113 的成功 BET 必须由新证据绑定恢复后沿原会话接续。
