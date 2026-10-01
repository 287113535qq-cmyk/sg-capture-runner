# Pyramids 已观察奖金图标的独立修复

2026-10-01。修复继续使用 AG 的差异归类、独立修复队列和验收后重新准入机制。当前是生产代码接线及离线验证，不是新源已启动；自然免费奖金图标终局尚未观察。

固定官方客户端 SHA fd11152a04daf94fa730bcdd4a4309085fb5a7d1aac93c7a1a8c055369942cfc 将 -3 映射为已知奖金符号，原 rC 投影保留有符号值；实际两帧原始方法执行要求 FREE_GAME、outro 为 Spin、isFinal 为 false。该值不是下注金额，不参与 B/AB/TW 运算。

新增 pyramids-free-major-v1 类型映射，bonus 为3；原十免费映射及旧完整记录不变。Python 直接检查原 XML 与 payload，Runner 和 collector 各自验证，只接受已观察的后续 FREE CL=-3。首 BET、BGCL、其他负值、错误坐标、重复位置、别名冲突、混合 FID、重触发、强制结束及金额不符仍拒绝。完整局沿用 ten-free 的逐帧计数及终局条件；NFG0 不能独立证明结束。原始响应不作修改。

实际3,211条完整记录逐条比较规范化完全一致；2个旧中断前缀验证均要求 FREE_GAME，不能续接旧会话。12项 Python 与9项 Runner/collector 专项及 TypeScript检查通过，包括合成完整终局、每个前缀和负例。合成终局不算真实覆盖。

后续重新准入须绑定已经实际完成的 shared-close 记录、原3,211完整及150历史基线，生成独立新 profile、通过Linux和fresh后使用新会话。修复队列当前源额度0。健康Rhino主线无需等待该修复。
