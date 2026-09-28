# 32717 转盘与免费局的客户端证据

本次只读分析官方缓存、历史流量和已备份 pending，未改正式 adapter、类型映射、游戏计划或源端开关。新增 `service/huff_goals_review.py` 与 `scripts/review-huff-goals.py` 供离线审查，所有结果仍为 `captureAuthorized=false`、`settlementVerified=false`。不能将这些字段观察直接当成可恢复的协议证明。

## 已确认的差异

客户端 `huffnlotsofpuffgoals/js/app.js` 的 SHA256 为 `f41a7744c5d2d5f966fa3c9c2ccf0b77ac3fc0d68614f985518090d3e3fbed7f`。

| 证据行 | 行为与含义 |
| --- | --- |
| 3220 | 本游戏客户端模式枚举为 0=FreeSpin、1=BaseGame、2=Wheel。32717 的 FID2 不是 32714 的 Touch Up；编号不可跨游戏复用。 |
| 2883、2890 | FID 两个槽位单独保留；第一项写入 Jf，第二项写入 o3a。不能把双槽位折成单值。 |
| 2337、2339、2341–2342 | NFG 写入剩余次数 Nb.je，一般免费流程据此选择 FREE_GAME。 |
| 2860–2862 | WheelIntro 明确使用 FREE_GAME 请求；随后进入 WheelSpin，不是 FEATURE_START/PICK/END 请求族。 |
| 2878–2879、2883、2887 | GSD.FEAT、NEXTTRIGGER、WHSLICE、WH1、WH2 和 CFTFG 分别承载当前玩法、后续转入、转盘结果及辅助状态，不能仅依据 FID 猜奖金类型。 |
| 3105–3117 | 同一转盘可能转入第二转盘或 MANSION、MEGAHAT、BUZZSAW、FG 等分支；不同字段组合影响转移，不可将 NFG1 解释成一定只有一个后续响应。 |

当前 pending427 的成功 BET 为 FID2、NFG1、TFG1、CFGG0、NEXTTRIGGER=WHEEL1，存在 WH1；没有 FEAT 或 WHSLICE 结算结果。它与客户端转盘入口相符。下一请求方向已确认是 FREE_GAME，但还没有本局的返回结果及完整转盘/后续玩法结算链，不能重发 BET，也不能提前计为完整局。

## 历史复核

历史 `32717/traffic.jsonl` 的 SHA256 为 `fec1e1d7f1964e43be69cb0b16621e9fcc47328437723ee8649b1e2b9fbd396c`。只读复核 120 帧，其中 100 次普通 BET、16 次 FREE_GAME，另有 2 次 INIT 和 2 次 REELSTRIP。普通请求模板完全匹配的 100 条链共 116 帧，审查问题为 0；历史只见 FID0/FEAT=FG，没有 FID2 成功转盘链。

两条历史免费链各从 6 次开始，在过程中各增加两次，最终各完成 8 个 FREE_GAME。共有 4 次 TFG 增加，NFG 可保持不变而 CFGG 增加。审查器保留所有计数并记录这些增加，不强制“每个响应剩余次数一定减一”。普通响应缺失的字段保留 null，不填成观察到的 0。完整脱敏结果见 [字段清单](huff-goals-feature-inventory-20260928.json)。

从私有备份读取的 pendingHash 仍为 `c2232121b17fc58e076ad84fa29eff05c22878199e1a300f807c7014eb0bf7ed`，rawHash 仍为 `3a74bab9f1861122a38c626355a1ab293d25ae9762de3b496f5cfc9209b98e91`。未删除、修改或接续此局，官方新增请求为 0。

## 下一步

正式适配需明确转盘与后续免费分支的独立 bonus 映射，保留旧普通/FID0完整记录的映射 hash；核对请求参数、完整状态转移、最终 TW/B/AB 与实际下注，再补 Runner/服务端一致实现和受控恢复证明。离线审查用的 8 项专项测试覆盖跨游戏错误映射、再次触发计数、缺失字段、XML/请求/会话一致性和脱敏，不能代替官方完整转盘结算证据。

新增 8 项加既有 32714 的 15 项，共 23 项相关测试在 Windows/Linux 均通过。Linux 只在独立审查目录执行，代码包 SHA256=`f601cd9dbc9a85ef44e375d10d574298b2bad468b21d36c110eb7db8439b4ed7`；线上 current 仍为 `c9b02dc1e9beb44f866f5d314c9cebb9cf28b6fb`，没有部署诊断模块、官方源请求或实时数据库写入。
