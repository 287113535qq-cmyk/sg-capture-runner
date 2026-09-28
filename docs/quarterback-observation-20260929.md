# 32836 Quarterback Fields of Glory 自然选择现场

2026-09-29 05:38 北京时间只读核对：secondary 在 32833 全文终审后自动进入 32836，运行 `36486208416`。当前普通计划仍是 buy0、BPR1/RB5、299900 个新局加 100 个核验历史局。触发自然选择后池按协议保护关闭，等待所有旧租约结束，再由原调度器写 parked 快照；没有共同源端故障，primary 32747 继续采集。

本次读取 4 个批次，实际完整日志共 42 个、checkpoint0，全部 42 个原始/标准化/摘要离线核验通过。唯一 pending 为 batch2 / worker21 / sequence113，只有一个已成功 BET 响应，awaiting=null；原始摘要 `832e48ccd79221965768f3ad29566500db6155bec56cd4207938279594a9231a`，pending 摘要 `e5d11d5088d9656740214abb16b5e521ab9d29535b2753f8f429054f2df32b05`。FID2、CFG2、FS_2=0、NFR_2=1，NFG/TFG/CFGG 缺失，不能把缺失写成 0 后判为完成。

私有完整副本为本机 `.local/parked-32836-private.json`，原始现场继续保存在私有 Mongo 日志。未删除、重放、重新下注、改额度或清除保护。05:47:57 北京时间再次读取确认：全部 worker 租约结束，自动保存的 1 个 parked-pool 与 4 个 parked 批次均与当前原值逐条一致，pending 摘要未变。独立最终副本 `.local/parked-32836-final-private.json` 的规范化快照摘要为 `1468cc5bab060212fd42eab9aed49f0dfa8756bc4c57509acb2fd36ab9d6b4d3`。05:49:33 campaign 已标记 parked-protocol、secondary.activeGame=null；该组 ready 已耗尽。

## 官方缓存证据

只读目录 `quarterbackfieldsofglory`：

- `412.bundle.js` SHA256 `43c79de4ffeeebec57ab1a0c7765b47a310d489f82a589bd69be4a495be233a2`。
- `game.bundle.js` SHA256 `789a750fbcc2e3539d1257a3926908c04f5d478cf957b5464b691f06d79fb3ec`。

平台明确映射 FID0 为 freespins、FID1 为 pickABonus、FID2 为 **foamPickBonus**。不能把 FID2 套成另一款的免费或转盘玩法。

`game.bundle.js` 的 foam controller 按 START → PICK → END 接续：START 后从格式化 GSD.featureData 取得候选展示内容，保存其首项为 `this.val`；按钮位置用于本地动画，而 `sendFeaturePick` 实际提交的 pickIndex 使用 `this.val`。平台层构造 `CFG=featureID`、`FP=0|currentPick|pickIndex`，currentPick 来源于 CFP_2 加 1。成功 PICK 后客户端请求 END。这与 32651 的 FP 首项 1、按位置选取规则不同，不能直接共用原适配器。

GSD 采用 `#` 分段、`~` 分键值，不是 JSON。本次 BET 只观察到 BVAL 和 display，没有 START 后的 featureData；不能从尚未取得的字段臆造下一次 PICK。412 中还独立解析 CFR_2、CFP_2、NFR_2、FTV_2、FS_2 与 TW，完整结算仍需独立核对原下注、B/AB/TW 和后续免费/其他功能。

只读历史 `assets/sg/32836/traffic.jsonl` SHA256 `b706500b71ce8a6d3d27ba54cd0f3872592e8aae560774cf39d50457ec8a3ae5`，包含 100 BET、10 FREE_GAME、INIT/REELSTRIP 各一次；仅缺失 FID 或 FID0，没有 FEATURE_START/PICK/END 成功链。

## 下一步

实现本游戏独立 foam 状态机及增量 bonus 映射，保留普通/FID0 旧映射，验证 START 响应、由官方字段推导的唯一请求、END 后完整状态与金额核对，再针对这个现场建立独立 Mongo v2 恢复证据。当前只完成证据定位及旧完整记录核验，未授权源请求、未宣称新玩法真实结算。不得套用 32739 的固定恢复锚点。
