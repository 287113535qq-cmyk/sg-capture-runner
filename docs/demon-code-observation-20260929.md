# 32739 The Demon Code：自然免费模式转换观察

本报告记录运行 `36474147259` 保留的真实现场和只读客户端证据，不表示该分支已经适配或完成结算。该游戏仍属第一轮，目标及会话保持不变。

- 164 个完整局已有持久日志；6 个未完成局均已取得完整源响应，`awaiting=null`。不能将未完成局计入完整数，也不能删除自然触发后重复下注。
- 停止点为 batch 5 / worker 0 / sequence 432：同一大局已有 1 次 BET 与 8 次 FREE_GAME。
- BET 响应 `FID=0|, NFG=1, TFG=1, CFGG=0`。随后前 7 次 FREE_GAME 中 `NFG` 保持 1，`TFG` 从 2 增长至 8，`CFGG` 从 1 增长至 7。
- 第 8 次 FREE_GAME 转为 `FID=1|0|, NFG=10, TFG=10, CFGG=0, IFG=1`。因此 `NFG` 并不必须逐帧减 1，且游戏内存在免费模式转换；不能套固定次数循环，也不能将两槽 FID 合并为旧普通免费映射。
- 该 pending 的完整摘要为 `a1413020a467c8d7e91fdc7f00cc1aae7e8d5d899c47b5020a4870073bd14b30`。原始请求、响应及会话证据只保存在私有备份和 Mongo 日志。

官方本地缓存为 `html5/thedemoncodecap250c/js/game.js`，SHA256：`c3327610020e409155c59cd19ff22d3aec5251f4a1f57d478d2ac80baf14295c`。它不是其他 Huff 游戏的 `app.js`。客户端的 `parseGameMessage` 将 `NFG/TFG/CFGG/IFG` 分别映射为剩余免费数、总免费数、当前免费进度及免费状态；`FID` 原值保存为 `featureId`，在免费触发时首槽另用于 `triggerId`。免费旋转状态使用 `FREE_GAME` 并附带原下注参数。

这只确定了字段结构和免费请求方向。FID1 的完整嵌套转换、特殊阶段含义、最终返回普通模式条件、TW/B/AB 结算及独立 bonus 映射仍待专用适配与完整链验证。通用适配器继续拒绝未支持分支；安全暂挂后让其他 ready 游戏继续采集。后续适配必须保留已有普通/FID0记录的字段及 hash。
