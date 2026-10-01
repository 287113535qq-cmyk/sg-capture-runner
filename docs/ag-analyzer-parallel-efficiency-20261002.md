# AG 独立通道用于完整终审

按AG独立worker处理互斥任务的模式，完整终审将一个原有有界页分为两个互斥区段，用两个独立Python私有管道验证。页仍最多100条、原6MiB信封上限不变，每条仍调用原单条XML、金额、原文及规范化hash校验。第二进程仅在完整终审首次使用时创建；普通capture仍一个Python进程，不扩大SG会话或请求并发。

两个子结果都完成后才核各自count与有序身份hash，按原记录顺序合并整页确认；一半失败不能产生部分收据，等待另一半完成后整页拒绝。跨区重复ID、非严格sequence、错误count/hash及非验证结果拒绝；audit后续的原租约、批次、会话、额度、逐条Mongo读回、规则统计及完整digest不变。关闭时释放两个进程。不缓存可变许可、不减少300000逐条终审。

26项受影响检查包括真实Python一/双管道、损坏末条后再次正确验证、两管道同时进入、失败等待另一半、错误子收据、跨区重复与顺序异常。只有1或2个终审进程，其他设置拒绝。100条合成完整base/free/retrigger/guarantee字段由独立Python生成；7组交错配对每组500条，串行中位1375.13ms、双进程700.88ms，验证阶段减少49.03%，同一有序记录digest d3e68e74b367a2375bc56aa095b69c3400652aa390b778ed05f9e8777db76008。仅是本机完整验证阶段测量，未含远程分页/落库确认，不作为整款或线上吞吐49%提速。

当前36919896773健康源固定34a10ba不改变，正常尾局按原算法排空并全量终审。新代码需独立Linux通过和后续运行绑定，不能中途换解释器或跳过全审。源请求0、Mongo写0、新BET额度0。效率全部完成仍需线上终审、后续独立准入及连续流水线验收。

Linux36925664121 fixed89c3a5379971fc4fedc70fa68449b5332f735c1b passed (21:00:19Z–21:02:34Z). Log SHA e2260e453e2a4efd4bb584004da30479692fb844486c836696549e7c76b439d6. Local/server archive readback: 11 files, 222301 bytes, SHA 0f41a88d37ccca15e8a8495198be8a72357bab4c0c99b5256f8bd7eddab3e388. Current fixed source is unchanged; online terminal validation remains pending.

Real retained-data local replay: 151 original complete records (150 base, 1 natural free), unchanged snapshot SHA de0abd7c1db936d2f5be022ae3be1374990f7f3ef0f4ef3246f2991c4e633b78. Seven alternating paired samples of453 validations: serial median279.35ms, parallel152.68ms, reduction45.34%. This excludes online readback/ownership checks and does not grant another completion proof. Four-file4197-byte incremental evidence verified locally/server, SHA e676570232547a69899125f6d4fbee736faf4ff2bd135109851e7c4cfaf2ec1a; old151 records referenced without another export.
