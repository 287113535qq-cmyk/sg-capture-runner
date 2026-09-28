# 32739 The Demon Code：Reaction / FID1 专用适配

该候选实现 `service/demon_fields.py` 与独立 Runner 镜像 `scripts/trial/demon-protocol.mjs`，接入 GitHub Mongo v2 分析器。它不改变计划、配额或会话，不自行恢复暂挂现场。真实 FID1 完整结算仍须在新的证据绑定恢复和短采中验证。

## 客户端依据

官方缓存 `html5/thedemoncodecap250c/js/game.js` SHA256 为 `c3327610020e409155c59cd19ff22d3aec5251f4a1f57d478d2ac80baf14295c`。`readFID` 保存完整当前/前一 FID；`isReactionSpin` 检查首槽0，`isInFreeGames` 检查是否含1。游戏专用逻辑明确使用 `0|` 和 `1|0|` 字符串。

`FreeGameSpinningStartState` 发送 `FREE_GAME` 和原 BPR/RB 参数。`FreeGameIdleState`、`FreeGameWinState` 在 `numberFreeGames<=0` 时进入结束分支；该值由 NFG 解析。游戏专用免费总结只调整演出，不额外发请求。SNFG 用于恢复显示计数，STFG 用于赢奖演出判断，不能把它们或 FID 首槽代替 NFG。免费重触发可以增加次数；真实现场曾从 NFG1/TFG递增转为 FID1|0|/NFG10/TFG10/CFGG0。

本候选只接受旧普通/FID0 和明确的 `1|0|`；`1|`、`0|1|0|` 等尚未确认的其他栈仍拒绝并保留原现场，不推断其含义。FS/NFR、CFG、ABPM 等其他功能协议继续拒绝。100帧边界保留。

## 完整局与类型

一局一次 BET，后续仅 FREE_GAME，严格同 PID、同 BPR10/RB10/GN 参数。免费响应显式具有 NFG/TFG/CFGG，不能把缺失填0；计数允许模式切换时重置或重触发增长。NFG>0继续，最终NFG0、XML成功/PAYLOAD全文一致，并经过终帧B=AB、起始余额−最终余额+TW=100核对后才完整。FID1首次出现必须有正数免费次数，并实际获得后续FREE_GAME响应；终帧可清为FID0，不能因此丢失本局FID1类型。

普通与仅FID0的规范化和原映射hash完全保留。含FID1的新增独立 `-demon-free-v1` 映射为bonus2；它表示该局含此免费模式，不代表两个独立下注或全部演出种类。未知类型不归入bonus0。

## 留档范围

在已有全文终审中顺带统计 FID、NFG/TFG/CFGG/FGT、SNFG/STFG/EFGS/SBEFG、DST、倍率和CAPS。DFFP/DDDP/DCCS/DAAP/DAAS、EVP、RGS/RGSF/SCP/CSF/CSD/ICSD、EFG/CTW只保存字段存在次数，不公开盘面或原始payload。这些字段对应客户端的Demon、Void、HellGate、HeartStopper等演出；不能把每个演出都称为需要独立源请求的玩法。未完成局仍只在私有证据中保留，不混入完整局观察统计。

只读回放150条历史链/299帧与原适配器规范化一致；164条已持久完整记录的原始/标准化/content摘要通过，6个pending摘要未变，下一步均为FREE_GAME。历史只有FID0，FID1真实结算尚未验证。恢复时须新建适用Mongo v2的proof，核对两仓库运行、租约、暂挂快照和原摘要；不得套用Panda网络清理profile，也不得删除或重新BET这6个自然续局。当前其他游戏继续正常采集。

## 验证与恢复边界

Windows 和 GitHub Linux 各224项Python、34项协议/启动Node、56项Mongo v2 Runner测试通过，采集器25项测试、TypeScript、3000局离线集成通过。Linux运行 [36483794715](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36483794715) 固定代码 `222a0707ed737c036e949b00e7a25dce554edf3a`，没有SG请求或数据库连接。回执见 [适配结果](demon-code-adapter-result.json)。

本轮仅开发、离线回放和测试，没有解除32739暂挂、修改Mongo现场或派发官方短采。后续优先在正常采集边界准备Mongo v2专用恢复，保留原6个pending和164个完整局，以原会话接续FREE_GAME；未知栈继续安全暂挂。当前正在运行的游戏仍固定原代码，不为此中断。
