# 四线运行与真实 Init 校验

四个本机进程已核对实际 PID 和启动脚本：新款准入、流程修复、协议分析、采集交接。统一启动入口 `scripts/start-work-lines.ps1` 复用已有进程，拒绝锁所有者不匹配；仅移除已退出所有者的固定锁，未完成工作领取仍保持 fencing。交接进程没有源请求或 GitHub 调度权限，实际采集未恢复，完整线上库存消费链路仍未完成。

Very Fruity 第二次源运行 37045282759 在持久化一个 Init 后失败，下注和完整局均为 0。此前 Stakes 校验错误地要求档位含每线金额 1；官方 Init.parseStakes 列出的是总额，实际最小档位 20 与 Logic 的 perLine=1、total=20 一致。实际 AccountData 为空，官方 Init.parseCurrency 默认 multiplier=1。Python 和 Runner 已修正，核对二十线可选择，并保持广告金额、身份、原文、币值和恢复状态保护。

真实留存 Init 原文同时通过 Python 和 Runner；没有删除或改写原始字段，没有发送新的 Init 或 BET。3 项 Python、5 项 worker 测试通过。新增只读 bootstrap 故障审查通过真实现场，2 项测试覆盖原文、活租约、已下注或未知网络故障仍拒绝；审查本身不退休旧会话、不解除 hold、不产生额度。

鲜读证实 primary hold=false、secondary hold=true，后者原因为该 Init 校验错误，池中唯一启动来自 worker28。旧会话仍需由 GitHub 独立维护结清并绑定新 runtime，不能重跑之前的零源修正：本次已发出真实 Init。当前 applied profile、generation、原100上限及所有旧许可保持不变。本机准备证明已撤销，新的 6 项库存测试通过，迟到旧故障不能撤销新证明；没有可采库存时不虚报源正在工作。

修复线同步完成 Inca collector 与 Python/Runner 的23例对照：2个合成完整金额结果、6个未完成前缀、15个拒绝样例。自然终局尚无，尚未 production import 或重新准入，不能称修复已上线。结果已交给独立协议分析进程，语义分析不阻碍流程修复继续。

新款准备对6个固定客户端比较36个 Init helper，全部方法字节相同，可复用单位和缺省值证据；尚未验证其他客户端选择的 engine、覆盖方法、退出及金额，未批量授予 ready。累计完成仍17/178，本次新增完整局0，源请求0，Mongo写0，开关变更0。

先前自动审批拒绝了能够访问 GitHub 自动派发的本机后台进程，返回 blocked by policy，未给详细原因。该动作没有执行，也没有换壳重试；本机只启动无源交接，既有 GitHub 独立控制器的有界动作与后台自动派发分别对待。
