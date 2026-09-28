# 32717 自然功能停采审查

第二组按可用分片启动并通过 200 局真实短采全文审计后，[正式运行 36416743264](https://github.com/287113535qq-cmyk/sg-capture-runner/actions/runs/36416743264) 在 32717 Huff N' Lots of Goals! 触发未适配的自然 `FID=2`。这与此前等待 20 台 Runner 同时就绪的启动失败不同。

## 保存的现场

- trial：`sg_r1_20260928_32717`；普通 buy=0，betRaw=200、BPR=10、RB=5，目标 299900 新局加 100 已核验历史。
- planHash：`9cc1a10383a43ca90dc809bf052f8b95037899bcc51561b9288cabccccad3d4d`，未修改。
- 244 个完整持久日志记录；228 个文件/SQLite/Mongo 全文通过，16 个尚待落盘。
- 唯一 pending：batch=5、全局 worker=37、sequence=427。只有一个成功 BET 响应，`FID=2|`、`NFG=1`、`TFG=1`、`IFG=0`、`CFGG=0`，`awaiting=null`。没有未知在途请求，也没有证据将本次停采归因为网络异常。
- 完整删除 0、pending 删除 0、源请求重放 0、恢复 0、租约修改 0、配额修改 0。

原始及标准化内容、所有 batch 数据库、pool、queue 和 pending 已私有全量备份并核验。脱敏回执见 [审查结果](huff-goals-natural-feature-stop-20260928-result.json)。pending rawHash 为 `3a74bab9f1861122a38c626355a1ab293d25ae9762de3b496f5cfc9209b98e91`，pendingHash 为 `c2232121b17fc58e076ad84fa29eff05c22878199e1a300f807c7014eb0bf7ed`，manifestHash 为 `12fcdd36191b7f879cc9bd459eba45b4c4a2f850f94a271986ce3e51c26df319`。私有数据不提交公开仓库。

## 暂停原因与后续边界

原始 batch 失败为 `PROTOCOL_VALIDATION_FAILED`。随后 Runner 上报退出，服务端返回 `TRIAL_HALTED`；当时按最后一次异常分类，使单款协议暂停被升级成全局 `SOURCE_OR_STORAGE_REQUIRES_REVIEW`。修复提交 `c9b02dc1e9beb44f866f5d314c9cebb9cf28b6fb` 改为读取持久化的原始 failure，新增回归测试覆盖“协议拒绝后再次 fail”的真实路径；真正的源端、磁盘或存储故障仍按全局边界停采。修复不会自动清除已保存的停采原因。

primary 的 32714 原始 trial/pending/receipts 再次核对未变。当前两个组均协议暂停，global dispatch 也保留待审查状态，两个仓库定时采集变量均 false；第二仓库保留手动入口不等于恢复采集。本次没有生成可应用的 32717 恢复 proof，不能套用 32714、32711 或 32651 的旧恢复/清理脚本。

已定位只读官方缓存 `html5/huffnlotsofpuffgoals/js/app.js`，SHA256 为 `f41a7744c5d2d5f966fa3c9c2ccf0b77ac3fc0d68614f985518090d3e3fbed7f`；本次仅定位和固定证据，未宣称完成协议适配。后续需核实 `FID=2` 的完整请求序列、转移条件、奖金分类、最终余额和结算，并编写专用适配及双端测试。成功 BET 必须保留，不能删除自然触发局后反复重新下注。新的绑定证据、原始现场复核及受控恢复通过后，才可先完成此局、补落盘 16 个记录并进行短采全文核验。

暂停原因修复已完成 Windows/Linux 各 168 项 Python 测试，确认两仓库无活动或排队任务、服务端工作和 batch 租约为 0 后，部署为线上 current=`c9b02dc1e9beb44f866f5d314c9cebb9cf28b6fb`。原始暂停状态和失败证据保留，未执行协议恢复。

后续离线审查已确认本游戏 FID2 为 Wheel，WheelIntro 明确发送 FREE_GAME；不能套用 32714 同编号玩法。历史只有 FID0/FG 完整链，尚无 FID2 完整结算，详见 [客户端证据及历史复核](huff-goals-client-review-20260928.md)。
