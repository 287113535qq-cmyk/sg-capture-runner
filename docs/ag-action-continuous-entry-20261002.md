# Continuous action-channel entry

The Pyramids action canary completed 2,000 new rounds, including 18 natural continuation chains and 274 FREE_GAME responses. The longest complete chain had 39 frames. Full Mongo/receipt equality and independent Python verification passed. These are actual flow results; they do not establish complete gameplay coverage.

The successor executable is commit `9aafef9ac94300c02ce74bb83db7eb97dfcef00d`. Linux preflight `36973213007:1` succeeded. Zero-source refresh `36973418231:1` succeeded and its runtime receipt was read back. The applied independent revision is `count-runtime-pyramids-action-continuous-20261002.json`, canonical hash `c24171b25372612a54038a48121fdc4b1af9f16095d625320d22f1d38bd19a80`. It binds the successful canary, all 341 settled batches, the original activation and original target. It preserved 18,913 complete rounds and 280,937 remaining rounds without creating quota or changing old records. The applied revision must stay immutable.

Source run `36973608232:1` is a single 15-minute controlled continuous run with twenty hosts and one lane per host. Its worker deadline comes from the immutable admission permit rather than restarting a fresh duration for each child. Normal pending continuation and full readback protection remain in place. This revision does not authorize automatic relay or additional concurrent lanes.

At native snapshot `1790922668`, the pool was enabled without failure: 25,813 confirmed rounds, 6,900 more than the canary baseline, nineteen active batches and 1,900 reserved rounds. This is an in-progress count, not the final independent full audit. An independent one-second diagnostic at `1790922665` measured server CPU 55.12%, memory 61.65% and 129.56 GiB free disk. It does not prove a full resource window.

Independent analysis `36973693123:1` succeeded while continuous capture was running. The next 100 annotations were read back as classified, bound to their original hashes and sourceAllowance zero; the original documents stayed unchanged. Together with the earlier canary analysis, 200 of the original 2,000 action records have independently read-back annotations. Remaining classification does not block complete-flow capture.

The new admission and compact/delta bindings passed 71 targeted tests plus the workflow-choice check. Both workflow files parsed, and the actual 341-batch refresh/admission replay used pages of at most 100 and changed no existing documents. These offline checks supplement the actual preflight and maintenance evidence.

Private preparation archive `ag-action-continuous-prepare-20261002` contains 17 files, 102,268 bytes, SHA256 `e188605f2e38f21213bb54fe45739f3c34b1fc4c688dda7ec1cccb9126ee3c21`. Applied-entry archive `ag-action-continuous-entry-20261002` contains 15 files, 351,295 bytes, SHA256 `00c00deab70a82e5734def266ebd240439700653f54479105c8d59cf0088c0e1`. Both locations verified file bytes and hashes; old raw records are referenced, not exported again.

Full resource-window acceptance, matched controlled concurrency throughput comparison, final audit of this running source and actual cross-game automatic relay are still outstanding. No claim of all efficiency optimizations complete is made. The first-round completed-game count remains 16/178.
# 最新停采核验

无源结案 `36976529122:1` 已成功，执行代码 `6f7fa6f31c81ddb9d32f2111388ce13557f453b6`。实际补写 780 条并 Mongo 全文读回相等，49593 完整保留，660 批次全部结清，pending/reserved=0，两组 hold=false；旧池禁用、campaign.activeGame=null，修复队列 sourceAllowance=0。五个中断局的原始留样逐个读回 hash 不变。没有新的源请求，不恢复原中断。

`count-close-pyramids-evidence-20261002-flowbudget.json` 已应用永久冻结，canonical `796e445b4dd8f20e1e8c7500d01d9c899b725526781ba7f809842eff48c39468`；关闭结果 hash `25ca1a912e0c94f80ca4bf2ba735f442302441da92345e1dadd9bac90397a32a`，recordsHash `e448065b7a853be8a0f9fa269ca367858945453b5c14b1f9af277dc4b7f05cc7`。旧版本下方“尚未应用”仅记录准备阶段，以上述真实结果为准。

首次维护派发 HTTP 422 被明确拒绝，鲜读证明没有创建运行。维护工作流改用字符串接收独立结案文件名，仍由控制器限定固定游戏/群组、文件名范围、manifest、原运行和现场。入口专项 2 项、后续 Linux `36976220733` 成功；不绕过未知派发保护。

停采私有备份 16 文件/24171665 字节，SHA `d311c29fbd6c42279cf87dd12bd03186e2238a2d01477e84defe5dbcf99e19c6`；结案准备 19 文件/663571 字节，SHA `fe67720f08d5052baec3096f42b307a06c2fcd9c7f66ce5d4ab92e748c5a0a38`，两端逐文件 readback 完成。原 16913+2000 完整仅引用既有档案。

结案最终增量 18 文件/447755 字节，SHA `848f53cb5ba600481d1c269aa27767fe9faa8125efd02024c9f5e2f0549ab1c1`，双端逐文件核验完成。780 完整和 5 留样采用原档案引用，恢复后整体 hash 严格相等，未重复上传原文。实际维护 07:02:52Z→07:06:49Z，237 秒；日志 SHA `a9f3d966e523fd78353738e73f0c28e6cfacc61748c72ac8bd0bb1864ac33823`。详细结果见 [结案结果](ag-action-flowbudget-close-result-20261002.json)。

源运行 `36973608232:1` 已以 failure 结束，当前没有采集。新增 29900 条完整记录及 29900 个收据全部通过独立 Python 校验和 Mongo 全文比较，已确认总数 48813。另有 780 条完整持久收据尚未写入 Mongo，独立验证通过；补写读回后才可计入 49593。五个已响应中断局不续接、不重放。

真实第 99 帧将 TFG 从 100 增至 102，NFG/CFGG 仍满足进度关系。错误来自请求流程代码的任意总次数 100 上限。已移除内外免费总次数上限，保留 XML、身份、金额和逐帧进度验证；实际 99 帧原文回放仍只证明下一步 FREE_GAME，不能计完整。8 项 Python 和 4 项 Node 测试通过。原已应用计划 maxSteps=100 尚未改变，需要独立资源预算准入，不能直接重新派发旧许可。

通用无源结案内存回放使用 49593 条完整记录、780 条补写和 5 个中断留样，最大读取页 100，未执行线上写入。独立候选 `count-close-pyramids-evidence-20261002-flowbudget.json` 尚未应用；已应用旧 profile、runtime、源额度不改。完整资源窗口、吞吐对比和真实自动接力仍未全部验收。
