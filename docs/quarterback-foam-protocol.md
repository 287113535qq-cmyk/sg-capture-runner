# 32836 独立 Foam Finger 协议

2026-09-29 07:14 北京时间：session恢复已实际执行，随后新局sequence20首次走完真实Foam四帧。END保留FID2但省略CFG/FS_2/NFR_2/CFR_2/CFP_2整组字段，旧适配器拦下并保留原响应。客户端receivedFeatureEnd→panelEnd→readyForNextSpin支持这一结束形式；已修正Python/Runner/独立TypeScript并通过真实原始数据回放（stake25、TW350、bonus2），尚未受控补写或短采验收。部分计数缺失、正免费计数、其他功能栈仍拒绝。详见[新的实际结果](session-recovery-20260929.md)。下方要求保留FID必有计数的描述仅为旧实现。

实际执行更新：恢复已应用，旧 42 个完整记录已落库核验；随后短采被 primary 的会话拒绝共同保护拦截，32836 源请求为 0。尚未验证真实 Foam 结算；旧 proof 不可重跑。见[现场结果](protocol-short-session-stop-20260929.md)。

候选适配按官方只读 `quarterbackfieldsofglory/412.bundle.js`（SHA256 `43c79de4ffeeebec57ab1a0c7765b47a310d489f82a589bd69be4a495be233a2`）及 `game.bundle.js`（`789a750fbcc2e3539d1257a3926908c04f5d478cf957b5464b691f06d79fb3ec`）实现。原现场和历史流量见 [观察报告](quarterback-observation-20260929.md)。本文件说明实现边界，不授权解除暂挂。

正式解析入口为 `service/quarterback_fields.py`，独立 Runner 镜像为 `scripts/trial/quarterback-protocol.mjs`。Mongo v2 GitHub 分析器按 sourceKey 精确选择本游戏；旧 SQLite 服务不启用。普通计划 BPR1/RB5、实际 stake25、buy0、planHash 不变。

## 请求和结算

仅独立 `FID2| / CFG2 / FS_2=0 / NFR_2=1 / CFR_2=0 / CFP_2=0` 的成功 BET 进入此路径。之后为 FEATURE_START、一次 FEATURE_PICK、FEATURE_END。START 的 `GSD.featureData` 以分号分段，客户端保存首项 `this.val`；`sendFeaturePick` 忽略按钮位置参数，提交 `FP=0|CFP_2+1|this.val`。不能选择最高奖值、把按钮索引或别的游戏 FP 代入。

START 必须提供可校验的 CFP_2 和 featureData；成功 START 可以缺 FS_2，但不能伪造缺失内容。PICK 响应必须保留当前 FID2、CFG2 且 CFP_2=1。END 必须成功，若保留完整计数组，则核对 NFR_2/CFR_2；获赠一轮、已完成一轮允许 NFR_2=1/CFR_2=1。真实sequence20的END保留FID2但整组CFG/FS_2/NFR_2/CFR_2/CFP_2缺失；仅完整四帧独立Foam链允许该形式，不填0，部分缺失仍拒绝。依据平台 `picksRemaining = numberOfPicksWon - index` 及 foam controller 的 `receivedFeatureEnd → panelEnd → readyForNextSpin` 路径；其他游戏的完成保护不变。

整局只允许一次 BET、同一 PID、准确普通请求参数；每帧成功 XML 与保存 PAYLOAD 一致。最终 B=AB，TW 与初始/最终余额核算 stake25。NFG/TFG/CFGG 缺失仍原样保留；本独立路径若发现正值、其他 FID 栈或其他功能字段则继续暂挂，不能按缺 NFG 提前记完整。没有响应的请求不重放。

## 映射与保留信息

普通/FID0 使用原 profile 与 mapping hash。只有完整 foam 链使用追加 `quarterbackfieldsofglory96-round-one-base-v1-foam-pick-v1`，bonus2=独立 Foam Finger，buy0。没有将未经验证的复合玩法归为 bonus2。

规则卡保存请求、完成识别、字段和证据版本；终审顺带统计 FS_2/NFR_2/CFR_2/CFP_2 与功能字段存在次数。featureData、FTV/FPM、BVAL、display 原文仅留私有证据，不进入公开观察值。没有为留档增加 SG 请求或重扫已完成的30万局。

FID1 pickABonus、`2|0|`/`1|2|` 等复合栈、免费途中触发、二次选择仍未覆盖。历史只有普通/FID0；合成链不算官方数据。2026-09-29 sequence20已真实完成四帧，并以原attempt/raw生成receipt、Mongo全文核验（stake25/TW350/bonus2）。原batch2/worker21/sequence113接续FEATURE_START明确返回ERROR_INVALID_SESSION；该拒绝已保存，不能跨会话接管旧局或重发BET。新精确归档/替代attempt恢复尚未应用，本次短采与正式验收仍未通过。见[实际结果及证据](foam-terminal-recovery-20260929.md)。
