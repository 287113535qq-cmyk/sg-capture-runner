# 32636 size-2 免费分支接线

现有私有中断触发PGS2=-45、GE2=45、GT/BT/PGG均1。固定官方客户端SHA2609546bee152162110eebd96e9508d7aba418b47017b98a01c0c6003be68ff4的原始Haa/RW、Pab投影及PD解析已执行：GE2进入size2状态，PGS2不按金额解释；复用先前独立核验的BET→FREE_GAME及退出逻辑。UI/动画/transport是桩，无自然size2终局，十帧终局仍为合成。

新增独立映射 richlittlepiggiesworldclass96-round-one-base-v1-size2-free-v1，hash6c17c2d472217069fffe7f29694f5152a292859a62ae692a9eb72852ada92154，bonus1/buy0。仅明确size2组合接受PGS2/GE2；整链GT/BT/PGG须为1，不接受PGS4/GE4/EP4混合、未知字段、GCT强制结束、错计数、错金额或跨session。完整XML及终局金额仍由既有校验覆盖。Python/Runner/collector和实际capture入口已接线；原33完整逐条重算全文与旧normalized相同，旧映射不变。

本机4 Python、7入口/冻结测试及2实际Controller隔离测试通过。Controller实际保存响应后，组合缺口只停该款并归档；金额错误继续共同保护。新增错误码采用现有过滤器支持的纯大写与下划线格式，避免数字被转换成通用失败。尚未Linux验证、未部署新的重入许可、未回正常队列，旧34已用66注销不变，不续旧半局；不能称整款ready/formal。
