# Pyramids 请求流程与玩法解析分离

已核对本地AG：`src/ag.round.ts:657`从响应读取nextAction，非终局时按精确请求/已支持动作继续；`src/ag.mongo.ts:178`独立验证终局与回放请求链；`src/ag.scheduler.ts:332`对确定的协议错误停款。AG仍解析必要流程、选择及金额证据，不能概括成不做解析或任何响应都继续。

SG旧Pyramids next_request会调用完整玩法校验，真实三帧已由固定官方客户端证明继续FREE_GAME，却因FGTHNS白名单和HNSID范围拒绝。新增独立Python流程检查及Runner `review_flow`诊断入口，只识别会话、原文、消息、内外层进度和钱包证据，不解释GSD展示值。未知展示键保留原文；FID混合、内层结束仍有外层免费时明确继续。终局仅返回terminalCandidate，始终complete=false、captureAuthorized=false。

本机验证：7项Python测试覆盖普通响应缺省状态、内外层计数、漏帧、会话混串、重复字段、XML及金额错误；2项实际BatchController.exchange测试验证先持久化原文再读流程，持久化失败禁止推进。真实故障3帧通过独立Python Runner管道且原始数据不变；旧严格next仍拒绝，证明诊断没有偷换现有采集权限。16,913条实际完整记录全量回放均为终局候选，错误0；不以终局候选代称重新审计或新增数据。

当前仅诊断入口已接入，生产采集未采用、新源请求0、Mongo写入0。全量首次回放因普通局无FID/计数返回FLOW_FEATURE，核实实际原文后补普通首BET缺省状态；后续FREE缺失状态仍拒绝。此流程判定还需独立capture准入及终局后的原文待审通道，不能宣布效率优化或整款适配全部完成。

私有证据：`.local/efficiency5/pyramids-flow-history-review.json`、`pyramids-flow-runner-review.json`及原始三帧引用。现有应用profile不变，不续旧中断。16913实际完整、1122已完整待写、3中断的线上无源结清仍未执行；此前5.429秒只为内存退休回放，不能称线上提速。

后续结清分离：新增`sg-count-evidence-close-profile-v1`，绑定确切已结束源run/jobs/sourceProfile、pool/campaign/hold/batches、原始故障pending及完整计数，不再要求先运行具体玩法适配器才能退休。完整记录仍独立Python验证、Mongo全文读回；未知半局原样归档、零请求、零新BET许可，故障游戏保留禁用并进入独立repair。原已应用关闭配置及旧入口语义保持。

通用结清控制器用实际16913记录/1122待写/3半局回放通过；使用未来租约到期时间，仅内存模拟，不代称线上结清。随后鲜读1790916582确认checkpoint15791、新Mongo7400、新完整receipt8522、reserved1800、pending3、futureWorkers0；真实写入0。新增维护入口`close-count-evidence`及固定Pyramids范围控制器，独立不可变证据profile尚待生成、Linux与线上维护尚未执行；不能据此开源。

维护边界只在无源workflow接受完整hash绑定的故障代码；来源类别必须source_protocol、peer hold必须无活动，源入口不接受该放行。测试覆盖改hash/改故障代码/活租约/未结束jobs/未知请求/缺原文/额度差异/Mongo冲突及部分归档，原共享结清及网络结清回归通过。
