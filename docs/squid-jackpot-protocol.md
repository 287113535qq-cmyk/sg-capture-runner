# 32651 自然选奖分支与受控恢复

仅适用于 Squid Game One More Game 的普通下注模板 BPR=108、RB=5。购买和加注仍关闭。实际请求只允许既有 GitHub-hosted Linux Runner 发出。

## 协议依据

本机只读保存的官方游戏客户端 `html5/squidgameonemoregame/js/app.js`：

文件 SHA-256：`92e444ec397e4bf6fb1794934b119e9d23f46257cb6f88059d54077e99f61330`。

- 100653–100675：Jackpot 的 feature ID 为 1；FTV 的首项为赢额、第二项为选择次数。
- 101220–101393、112035–112078：FEATURE_START → FEATURE_PICK → FEATURE_END；CFG=1，FP 的 round 恒为 1，pick 从 1 递增，position 为界面位置。
- 102720–102775：FEATURE_START 的响应不返回 FS 标签，客户端明确手动标记已开始。因此不能从缺少 NFG/CFG 推断这局结束。
- 103012–103084：成功 FEATURE_END 后清除选奖状态，再根据后续 Hold & Spin 状态进入 FREE_GAME。
- 109212–109250、110876–110880：选奖面板为 3×5，位置从 0 起。采集器顺序选择未用过的位置，不根据预载奖项值挑选。

第 424 局保存的真实 BET 已触发 CFG=1、FS_1=0、NFR_1=1，FTV 指定 10 次选择。该响应已经落盘，没有未知请求结果。历史流量也有相同模板的 FEATURE_START 成功响应。旧采集脚本的错误选项请求不作为依据。

## 存储与分类

新状态机重放整条已保存请求链，严格验证选择序号、固定会话、请求模板、XML 成功响应及最终余额。终局仍要求最终 TW、B、AB 一致结算，并反算实际下注恰为 108。未结束不能计入完整局数。

旧普通/原生重旋记录保持原始内容、bonus 和映射摘要不变。仅包含已验证选奖流程的新完整局使用追加的映射：仅选奖 bonus=2；选奖加重旋 bonus=3。原生重旋沿用 bonus=1。此编号按当前已验证协议分支区分，不声称已经细分该游戏所有美术/奖励子类型。未来分类细化仍以完整原始协议为依据。

## 恢复约束

恢复工具不通过 RPC 暴露。必须先核对控制器已暂停、全部租约过期、原计划与会话及批次绑定不变、233 条已完成记录原文摘要一致，189 条 Mongo 全文读回一致；3 个未完成局均有已知持久响应、没有 awaiting 请求，且下一步为已验证续局。

先持久记录原失败状态及证据摘要，再将已审查的协议停止转为可恢复状态。原数据与失败历史保留，不修改局号、额度或会话，不重发 BET。普通 claim 流程先补齐 44 条已完成日志的文件/Mongo，再恢复原未完成局。该流程没有任何源站请求；真实续局需在原 workflow 的短采验证通过后才放开连续采集。

## 2026-09-27 19:55 UTC 验收状态

协议修复已提交并部署为 `733dde4248c9789306c9ab312c9f8d76e584786b`。Windows 和 Linux 服务端各 117 项 Python 测试、25 项采集器测试、19 项 Node 测试、TypeScript 检查和 3000 个离线模拟局验证通过。服务器再次逐条核对 233 条原始/标准化记录及其摘要、189 条 Mongo 全文，3 个原始续局状态均可解释。旧配置、计划及原有类型映射保持一致。

尚未启用恢复：GitHub 离线检查 [36345791808](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36345791808) 在分配 Runner 前失败，检查注释指出账户付款或消费上限问题，实际运行步骤为 0。因此没有真实选奖续局或短采成功证据，不能称采集已经恢复。当前认证没有读取账户账单详情的权限，不能据此断言已经耗尽免费分钟。

GitHub Free 的私有仓库有账户共用的免费分钟额度，20 个并行节点仍累计消耗运行时间，详情见 [GitHub 官方计费说明](https://docs.github.com/en/billing/concepts/product-billing/github-actions)。没有调整付费设置、扩大授权范围或改换采集网络。原采集 workflow 继续禁用，源池及 campaign 保持暂停，恢复工具只执行了只读审查，原 failure 标记仍保留。详细结果见 [验收结果](squid-jackpot-recovery-result.json)。

账户限制解除后：先通过原离线 preflight，再重新核对当前状态与私有恢复证明，调用 `service/protocol_recovery.py` 的 operator-only 恢复入口；使用原 `trial-300k.yml` 的 `allocation=round-one, round_one_limit=10` 验证原 3 局续完及新增完整内容落库；通过后才启用连续采集。此工具不允许未知请求结果，不自动重发 BET。
