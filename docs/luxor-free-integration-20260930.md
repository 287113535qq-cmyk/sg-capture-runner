# Luxor 独立免费适配与下一款准入

2026-09-30：按 AG 式“单款隔离、修复与采集分开”推进下一候选 32835 Pyramids of Luxor。Python、Runner 和 TypeScript 正式路由已增加首 BET 独立 FID2 免费识别。此次是源码与离线验证；没有派 SG 请求、清理或切换，游戏没有标 ready。

## 真实现场与客户端依据

先确认 campaign 当前仍为 Beaver，再只读 Luxor 自己的 trial：9 个 batch、82 条完整 journal、当前 trial Mongo 0、1 条中断 BET。82 是原有完整待补写，不能当成丢失，也不能称已入库；中断局将按通用清理留样作废，不续接。

82 条完整记录由真实 Python analyzer 的 verify 入口核验原全部字段与 hash，并由独立 Runner/TypeScript 复核，结果原样。其中 80 个普通 BET，2 个旧 FID0 各含一次 FREE_GAME。新留样为 FID2/NFG3/TFG3/CFGG0 的单 BET，离线应继续 FREE_GAME，不能计完整。

官方 `205.bundle.js` 的平台映射是 FID2 免费、FID0 wild respin、FID1 pyramid respin、10/11 cascade。`getGameContents` 取 FID 首槽；实际 freespins 构造器读取 NFG/TFG/CFGG。主 `winDisplayOver` 先路由 cascade、wild、pyramid，才进入免费开始/重触发/结束；`readyForNextSpin` 在 NFG0 但 respin 状态仍打开时继续 SPIN。`gameEnded` 也会在中间帧触发，不能单独作终局信号。纯演出的 `respinReels` 重用已有盘面，不增加源请求。

私有 VM 回放实际 free-counter 构造器与 readyForNextSpin，在这 85 帧得到 82 个出口及 3 个继续。UI 和 respin controller 状态是桩，未执行完整浏览器或完整主 winDisplayOver，不能称全客户端验证。

## 新增范围与保护

- 只支持首 BET 独立 FID2，此链每帧保持单 FID2；拒绝中途进入、混合、切 0/1/10/11 及未知 GSD 内层功能。
- NFG、TFG、CFGG 必须显式存在且满足 TFG=NFG+CFGG；免费进度每帧加一，总数可因重触发增加。
- 终局要求上一帧 NFG1 到 NFG0、总数不变；提前清零/未知计数返回保守拒绝。完整 XML、同会话、金额与 buy0 校验保留。
- 新类型 `luxor-free-v1` 为 bonus2，映射 `67130de00cbba1d7241a4c6f1c69e61687d88c9d6a43ebb4ed539f085c68b4ad`；旧 base `6c451dc606f8818315a31908dec4c6868ddfb74f6115f05b92e1e5b6efcae313` 原样。

合成测试覆盖完整免费、重触发、错误计数/会话/金额/XML、终态误判，以及实际 captureBatch 的 BET→3 FREE、每请求前 intent 和一次完整提交。合成终局不是官方自然终局样本。

本机 256 Python、62 协议、525 Runner、25 collector 与 TypeScript 通过。统一 Linux 36642563664 在固定 runtime b04199db3d7c5bf595c63365b31d950940f2f976 成功，完整 suite 包括上述测试、3000 局离线入口与178档案。Job 64秒。没有线上 maintenance/source 派发，不能把预检称新采开始。

## 当时的剩余链路（已由后续试点执行）

2026-09-30后续独立准入、维护和实采已成功，新增100完整，见[实际结果](luxor-next-result-20260930.md)。以下保留适配提交当时的范围。

复用通用 retireDemoPool 将原 82 完整校验补写、读回后更新 checkpoint，把单条中断 BET 私有留样作废。再通过独立受控的新游戏代际许可暂挂 Beaver，保全其 137 及已耗尽 100 BET 证据，给 Luxor 一次有界新会话试点。禁止复用 Beaver 许可、清旧 runKey 或续旧 Luxor 会话。

尚需接通新游戏 profile/计划许可及唯一维护→短采入口，此次已修复 retirement 保留已完成/空 batch 原样后与 rollover 的兼容：只凭 completed retirement 所绑定的 before 全文 hash 接纳不改写的 batch，历史审计再核该证据。真实 Luxor 9 batch/82 record 在内存调用正式 retirement/rollover 与真实 Python，补写82、作废1、保全空 batch7/9 及82历史会话审计全部通过；未来权限与 Mongo 为测试替身，没有线上写入。现有 complete-count 核心与正式 activation 仍分开；100 试点不能冒充 300000 正式已就绪。没有真实特殊终局时如实记未覆盖；缺少 ready 候选时推进下一适配，不能无限追加某款抽样。
