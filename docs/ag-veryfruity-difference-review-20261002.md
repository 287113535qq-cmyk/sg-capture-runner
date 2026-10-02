# Very Fruity 差异准备与当前准入边界

按AG固定任务和结果复用方式，32812主线准备独立于32721金币修复。复用固定官方客户端SHA73d7979bc75f7d7c15748ce85bb02866592d61051bbf2b42a569be91fda02ab2与已执行的请求、继承关系、计数、金额字段方法，不重跑整个客户端。

本次新增service/veryfruity_review.py独立离线FSInfo校验。七个合成前缀核对freeSpinNumber/freeSpinsTotal；缺字段、显示解析器可吞掉的小数/尾缀/NaN、不安全整数、跳帧、金额回退、未审核重触发、max-win、错用旧会话及终态之后继续响应均拒绝。五项专项通过。此模块未接生产imports，没有独立mapping、native范围或源许可。

增量执行实际选择的VC Spin.handleSpinSuccess和其BL父方法，确认响应Header.sessionID直接成为下一请求会话；两个合成轮换均通过，缺sessionID抛错。其余响应解析器是明确的桩，不能代称自然XML或身份验证。独立候选现验证相邻请求使用前一响应会话，不错误拒绝正常轮换，也不允许复用更早会话。

计数达到总数只给出下一请求EndGame的假设，不标记完整大局。完整结算仍需原始XML、独立身份与下注金额、wallet移动及EndGame读回证据；不能复制Pearl的readyForEndGame或Rhino的WagerInfo。现有旧Mongo记录0，尚无自然XML。该款仍为准备中，不能称ready或启动。

修复线用32721新留样15帧增量执行此前固定函数：包含-4金币的重触发帧仍为FREE_GAME/Spin，未观察自然结算。官方符号映射本身不提供金额证明，不放宽白名单、不重放旧请求。真实无源结案36956679875已保留7503完整、预留0、共享hold=false；修复没有阻断下一款的离线准备。

效率验收继续区分离线、Linux、已采用和真实吞吐。阶段衔接实测6分39秒、独立预检同机减少20.12%/15.93%，但缺独立ready库存与完整资源窗口，全部优化尚未验收完成。

新增普通局原始XML候选 `service/veryfruity_cash_review.py` 与独立JS `scripts/trial/veryfruity-cash-review.mjs`，复用的仅是XML结构解析工具，不复用Pearl玩法、身份、金额或终态。三组合成0/20/125赢额、Logic前缀与EndGame完整确认逐项跨语言一致；Python八项、JS四项及复用索引七项检查通过。字段、XML全文、相邻响应会话、下注编码、payline求和及wallet逐帧检查独立执行；缺EndGame仍是待完成，有免费/未知奖励不能走普通出口。

客户端增量执行无奖励→EndGame、有奖励→功能流程、错误→界面结束三个分支；错误界面结束不是结算成功。`start - stake + win` 在Logic和EndGame均相同、单ReelSpin以及支付线形状目前是严格合成候选假设，尚无自然XML证明；不能因为显示解析函数读出金额就称已验证wallet时点。候选未生产import，没有新mapping、native范围、profile或源许可。

32812已进入离线特征复用索引：只按实证的WMS、响应会话轮换和Logic/EndGame匹配，保留计数、终态、下注和身份差异。后续相似游戏可直接获得这些差异项，不再重做整套客户端分析；建议始终不授准入。

32721修复增量执行官方Init投影和金币helper，确认JPV被反转为Pb.Dqa，Mini/Minor/Major显示因子分别用Dqa[3]/20、[2]/20、[1]/20。官方负符号-4/-3/-2分别是Mini/Minor/Major；既有`major-v1`代码标识处理-3的名称不代表官方Major，标识和已应用配置原样保留。两个原始函数以合成JPV执行通过；因子不证明TW或wallet结算，不因该结论放宽生产白名单。源请求和数据库写入均0。
