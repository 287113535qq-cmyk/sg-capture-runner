# 32820 / 32835 自然触发留档

2026-09-29，primary 正常采集运行 `36490565354` 依次遇到两款未适配的自然分支，按既有机制保存现场后暂挂，没有人工取消正常采集、删除原局或重发 BET。

| 游戏 | 完整日志 / checkpoint | 未完成局 | 已观察字段 |
|---|---|---|---|
| 32820 Beaver Las Vegas | 38 / 0 | batch2 / worker7 / sequence120，1 个成功 BET | FID1\|、NFG6、TFG6、CFGG0、IFG0 |
| 32835 Pyramids of Luxor | 82 / 0 | batch4 / worker11 / sequence303，1 个成功 BET | FID2\|、NFG3、TFG3、CFGG0、IFG0 |

两局 awaiting=null，没有未知在途响应。全部 120 个完整日志的原始、标准化和内容摘要离线核验通过，但 checkpoint=0，不宣称已落 Mongo 完整局集合或已经完成该游戏。32820 的池加 3 批、32835 的池加 9 批，共 14 个 parked 备份与当前原值逐条一致。

32820 pendingHash `d6ed5037762b0569a3287341471d8e2d36d225a4204f8a4cdf3d320744d472de`，rawHash `5aedf1687bbf62d278d355840f60c5a33c18bd8103362c223f4f635c03bf91b3`；32835 pendingHash `3871f6136f783ff614e540847f1d8cb6f37f84867c9ffea9a2ebd610caf21a66`，rawHash `1ebfb3243dc27ee51027bac6d33491327965f7241238b0107dd7c3a50e1ce94a`。

原始独立私有快照 SHA256 `c92294a8ed5e47749b09580bc99de085bb61d6ca60ca5ba3ed2a7b5d74d28f11`，保留在本机 `.local` 及服务器私有 `protocol-runs-20260929-full.tar`。公开档案仅保存字段含义待确认的观察值和摘要，不发布原始盘面、会话或 PID。

本报告仅记录真实观察：尚未核对两款对应官方客户端的完整状态机，不能把同号 FID 套为 Demon、Hard Hat 或 Foam。下一步分别查明续局请求、结束条件、奖金与余额结算及独立 bonus 映射，原普通映射不变。不能将这些自然触发当作网络坏局删除后重下注。
