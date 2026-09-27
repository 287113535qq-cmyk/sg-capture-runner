# 连接、恢复与完成规则

当前授权以 [第一轮说明](round-one.md) 为准：178 款各累计 300000 个普通下注完整局，已达标跳过；自然免费续局必须完整，第二轮购买/加注等待用户指令。使用现有空间，低于 30 GiB 自动停止新局。以下旧 special-limit 和准备期限制记录历史状态，不覆盖用户本次授权。

- 本机实际 API_ROOT：以只读准备报告记录的路径为准，历史交接中的其他盘符不作为写入目标。
- 数据库连接使用 SG 服务实际生效的 `.config-cache/mongo-config-*.json`；它覆盖旧 YAML 和容器初始化值。缓存文件可能只有管理员可读，普通账户看不到不能据此断言不存在。
- 所有运行时缓存应指向同一已核实连接；每款游戏的数据库名从对应运行配置读取，集合为 `simulate`。读取凭据只在受控进程内完成，不输出 URI/账号/密码。
- GitHub Runner 只通过固定主机指纹的 SSH 通道访问受控存储/Mongo；禁止开放 Mongo，禁止关闭 StrictHostKeyChecking。隔离测试链路已通过 Runner 网络及实际写入验证，凭据与正式游戏库分离；不能据此认定 SG 官方会话和正式导入已验证。
- 当前 Mongo 只读数量审计不是逐条身份校验，也不证明 sourceId 映射后的数据已经满足采集完成规则。
- 未知特殊类型默认 2000 局；已知特殊类型每种分别达到 special-limit，并覆盖要求的 free-choice 选项；是否同时要求普通局数遵从正式配置。历史 WMS 300000 大局批次是另一份范围记录，不自动替代本次目标。
- 完整 WMS 大局需完成所有实际 feature/free continuation 并到达 EndGame；失败的未完成大局不能计为完整数据。统计 JSON 行不等于已验证协议完整性。
- 先持久化原始及规范化完整局、幂等 Mongo 写入，确认成功后才能推进 checkpoint。不得清空旧 JSONL、Mongo、finish 或 skip ledger。
- 新增持久化队列必须原子 claim、绑定 run/job owner、续租并 fencing；只回收过期 lease。同游戏变体串行；429 Retry-After 跨 run 持久化。
- 当前允许已验证第一轮计划在 GitHub-hosted Linux Runner 上采集，并写入隔离暂存库；不写生产游戏池，不在本机或存储服务器执行官方采集。第二轮保持关闭。
