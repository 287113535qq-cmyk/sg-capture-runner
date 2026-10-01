# AG 终审阶段诊断

参考 AG 的阶段进度和明确故障分类，将完整终审耗时分为 Mongo 分页读回、独立 Python 验证、记录归属及规则检查、最终证明提交。日志只输出固定阶段、调用数、耗时、页数和已经核验的完整数，不包含记录身份、原文或会话值。每10000条发一次进度，提交完整证明并成功更新 campaign 后才输出完成；失败仍保留原错误并明确未证明完成。

诊断不新增 RPC 或数据库写入，不改变100条分页、逐条 XML/金额/身份验证、租约、资源保护或最终 digest。旧单条 Python 路径的验证时间包含在 recordChecks，不能误当为纯 CPU 或新批量路径的 Python 阶段。阶段时间均为互斥包装，不能与外层 audit 墙钟重复相加。资源等待等未包裹时间如实留在总耗时差额。

38项受影响检查包含实际 campaign→完整审查→证明和失败不完成；另14项终审及 campaign 检查确认诊断回调故障不会中断保护链。当前36919896773固定34a10ba不改变，这些日志用于下一次独立绑定的运行；当前终审不具备该细分记录，不能补造耗时或宣称线上加速。

新增证据工具已纳入 Linux 工作流：36926493277在8ab45e3159ff711e308f849503201dcbf41143ae通过，完整日志SHA f2226a343dea7c1190b7b6fef5e4272fe809ed2ad907506b818b975b9949d98f。原36924983750仅验证其已有工作流与 Runner，不表示新脚本检查当时已在Linux执行。本次将方法复用和文档耗时汇总的6项检查正式加入工作流，避免后续遗漏。

准备通道继续独立推进32812：固定官方客户端额外执行3个响应字段方法和5组FSInfo计数。缺失计数为undefined、异常计数为NaN，官方显示解析器并非严格结算校验；独立适配必须拒绝。BGInfo、BonusWin和FSInfo金额域保持分开。仅合成解析节点，无真实XML或自然终局，不授ready或新额度。

Linux36927030129 fixed9e054b71f25f6920e0cda9065294fc700cc5beb9 passed. Full log SHA ebe7c345ca2509bd1be5af06738fdff9c44961379b56dde973484dabfac27a2c. Fourteen-file442504-byte incremental evidence read back on both sides, SHA c02927eb7e8b32beeec04a9a6a2df39d7bc1d3e61cbc8e5faa2fff1ee53ab6b9. Source36919896773 remained fixed; no source dispatch, SG request, new BET allowance or Mongo business write from this change.
