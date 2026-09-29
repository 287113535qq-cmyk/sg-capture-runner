# Pick A Ball 会话拒绝恢复实际结果

2026-09-29 10:00:37 北京时间：32836已完成本次精确恢复、20分片短采、全文验收和转正式。正式运行[36510315315](https://github.com/287113535qq-cmyk/sg-capture-runner/actions/runs/36510315315)已实际产出，快照为5375条完整日志/4631条checkpoint、20个有效worker。此运行中数字不是最终终审；累计完成仍13/178款。

恢复36509309109把11条有效待写补齐并451条全文读回。只有原batch11/worker38/sequence1008明确ERROR_INVALID_SESSION的旧attempt被私有归档为source-invalid-session/abandon_without_replay，成功BET和拒绝全文保留。维护源请求0，旧BET重放0，有效完整删除0。proof `3500d5e9a098fbda67ccdb8e21cc7ef09656376d1620fdb832434cd395dd9d4e` 已应用，config/pick-session-20260929.json冻结，不可重跑。

同一提交e111853的短采36509638055成功：20worker各新增10，共200条官方完整局，263个源请求/200个BET。新1008是身份不同的独立替代attempt，BET晚于恢复并已全文落库；旧1008没有被说成已结算或换会话接管。原451条完整、Foam20（bonus2/stake25/TW350）和Pick A Ball1705（bonus3/stake25/TW500）逐条不变。

验收36509962304通过651条原始/规范化/全文Mongo核验、所有worker增量、原记录与备份一致和pending0。转正式36510124852成功后才开启secondary的SG_TRIAL_ENABLED并以limit0启动。短采后的verify按验收阶段暂时关闭workflow入口；随后恢复维护入口完成validate/formal，未绕过源端或存储保护。

primary32739的164条完整与4个原pending逐条未变，仍未发新短采；primary变量false。其旧许可不能直接用于新main，需要独立证据绑定恢复。两个global-hold均false，服务器Mongo-only入口未变。第一轮未完成，第二轮关闭。

本机167项Node通过；GitHub Linux241 Python、44协议Node、123 Runner（含共享测试导入）、25collector、TypeScript、3000离线夹具通过。首次preflight36508955573只因规则档案摘要过期失败，补同步后36509195406全通过，期间没有源请求或数据库维护。离线夹具不是官方新增。

六个已结束运行的metadata、全部jobs、日志ZIP完成CRC/SHA核验；完整恢复前/后和651局短采现场、冻结profile已在本机与私有服务器双份读取核验。最终归档4453271bytes/25文件，SHA256 `c4171d759210531a2e610849a5f2de7ef3603021b030e023e5ac6c78e2857f79`。原GitHub运行保留。实际回执见[JSON结果](pick-session-recovery-20260929-result.json)。
