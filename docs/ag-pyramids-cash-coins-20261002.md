# 按 AG 特征分组修复金币与账户余额阶段

复用固定官方客户端、已审请求出口、+10重触发和严格XML控制，仅补金币类型及账户时点的差异。固定客户端SHA `fd11152a04daf94fa730bcdd4a4309085fb5a7d1aac93c7a1a8c055369942cfc`；增量执行官方Init投影和金币helper，负符号-4/-3/-2分别为Mini/Minor/Major。JPV反转到Pb.Dqa，显示因子分别取[3]/20、[2]/20、[1]/20；显示因子不作为本地TW计算。既有major-v1处理-3的标识保持冻结，不能按名称误读为官方Major。

真实源36955443358已结束并结清，7503完整保留、预留0、共享hold=false，原15帧已留样作废。本轮不续原会话、不重发BET/FREE。原15帧的B包含累计TW，AB和responseBalance仍是扣注后的账户余额；各前缀满足B=start-20+TW、未结算AB=start-20、responseBalance=AB及TW不回退。这是新增金额证据，不是仅凭符号白名单或NFG0认定结束。

新增 `pyramids-cash-coins-v1`，映射bonus9/hash `c1a7ad375d9a9f82bf9710a2d61c618923ba06af9dc7febe92bf86e8dd852f1c`。Python、Runner与collector独立检查原始XML、同会话、三元金币坐标、重复位置、CLBN别名、计数、余额阶段及完整现金出口；原文不替换。仅首FID1/TFG10，逐帧CFGG+1、TFG不变或+10，最多100，终局priorNFG1→0且总数不变。FREE的CL可保留Mini/Minor/Major；首BET负金币、BGCL负金币、Grand-1、未知-5、混合、SFGT、外部JPV、GCT和错金额均拒绝。旧minor(-3)无重触发仍走原bonus3；不改旧映射。

17项Python及11项Runner/collector相关检查通过。三组合成金币终局的完整规范化三方一致；真实15帧全部前缀Python/JS一致且未完成。1716条最近已保存完整局逐条核对原规范化不变（本机492ms，非采集收益），老5787保全沿用已完成结清证据，不重复扫描已完成Rhino或重新上传旧记录。

自然金币终局尚未观察，三组合成终局不能代称真实玩法覆盖、整款ready或效率验收。当前完成16/178。本轮源请求0、数据库读写0、旧配置变更0；必要Linux和独立新会话准入仍待完成。使用新版本、新许可与原目标剩余额度，不重置总目标或借已注销额度。按AG独立修复通道推进，下一款Very Fruity离线准备继续保持独立。

独立v9重新准入入口已准备，绑定上一版冻结profile及36955443358的已完成无源结清，Python/Runner均限制7503保留+292347剩余+150历史=300000；禁止退休旧款、改源run/原hash或扩大目标。新增入口范围检查4项Python/19项Node通过，尚未生成或应用新profile。首Linux36960170508因旧负金币fixture错误码预期过时失败，新XML缺失及bonus映射不符仍拒绝；相关11项修正检查通过，随后合并新版入口再预检。

完整7503真实记录在正式activateFormalRepair内存回放中逐条Python/完整收据/金额验证通过，100条有界页，旧journal/batch不可变，reserved0，剩余292347。修正v9选择与旧结清一致的逐条流式recordsHash格式；没有放宽旧scope。新独立profile已准备但未应用，首次未应用版本私有保留，最新files绑定已补完整。当前未进行任何线上重新入队或源派发。
