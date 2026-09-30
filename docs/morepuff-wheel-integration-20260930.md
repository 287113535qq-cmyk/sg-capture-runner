# More Puff 轮盘现金出口接线（2026-09-30）

32718 的有限轮盘适配已接入 Python、Runner、worker 和 collector。首 BET 独立 FID2 只请求一次 FREE_GAME；只有官方 WHSTOP 现金出口 0、2、7、8、11，明确 1→0 计数及无组合功能证据时才结算。进一步免费/组合玩法、未知字段或出口拒绝，并按已有 AG 规则隔离该游戏。旧中断局只作留样，不续接。

新增 wheel-cash-v1 映射 `bd2e8b2972065a922d3230bd8497c48cb81318f543b5ab74f02fdffdb2c078f4`，旧基础映射 `a537d5692ce49c0bb4407f0cf652608fe56e2f16da353bf5c98b8a849bad2e1c` 不变。现金终局、金额及拒绝边界目前均是合成测试；尚无真实轮盘 FREE 响应或自然完整 FID2 终局，不能据此标记整款 ready 或 formal。

53 条真实旧完整记录经 Python、Runner、TypeScript 全字段核验不变。真实旧现场在内存运行正式导入、退休、切换与会话审计：模拟补写 4 条、作废 1 条中断局，保全 Jinzita 415 条及全部旧 batch/journal，核实其 95 已用和 5 注销。存储及未来许可是测试替身，没有业务写入或源请求。实际 campaign→controller→capture 的新代际入口测试同时覆盖每 worker 5 局和第 6 局拒绝。

本机 273 Python、69 协议、565 Runner（其后新增 32718 入口专项通过）、25 collector、TypeScript、3000 局离线整链和 178 档案检查通过。独立 profile 绑定 Jinzita 已关闭证明，新增 32718 一次最多 100 BET、20 worker 各 5 的范围；旧许可不变。Linux、受限 native scope 安装、现场鲜读和唯一维护/实采仍须各自完成，源码测试不代表采集已开始。
