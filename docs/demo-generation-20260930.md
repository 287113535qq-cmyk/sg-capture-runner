# 新 demo 会话代际与历史完整局

中断半局已按用户最新口径作废，接下来使用新会话试采，避免旧 trial/worker 的确定性标识再次连接原会话。

本次加入两个正式代码能力，但未生成或执行新采集许可：

- `gameForShard` 支持计划中明确绑定的64位十六进制 `demoGeneration`，同代际/worker标识稳定，不同代际标识不同；所有旧计划的派生结果保持原样。进程重启不能自行生成代际。
- 完成审计支持新旧会话共存：当前代际记录仍核当前worker与batch身份；旧完整记录核清理后的原batch全文哈希和不可变清理回执。旧batch不改session，不拿当前worker身份覆盖历史。一次终审按batch缓存读取，避免每条记录远程查询。

完整Runner433及协议57测试通过，专项16项覆盖两代完整局、伪造session/worker/sequence、旧batch或清理回执改变、代际绑定缺失及按batch读取上限。私有真实484条历史记录会话归属回放通过，其中Beaver38在合成未来会话身份下仍可核验，伪造旧记录session被拒绝；代际凭证为内存合成，不是线上授权，不代表新SG样本。

尚需完成：从已清理现场一次性建立新代际与最多100新局（每worker5）许可；保留旧batch、断开旧worker activeBatch并绑定新会话；独立Demon暂挂记录与campaign切换；实际准入/worker/capture完整路径测试和Linux预检。当前Beaver38、Demon446、两个source开关以及全部已应用配置均未改变。不能将本次源码能力当作采集已启动。
