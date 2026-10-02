# 按 AG 组合特征复用并隔离未知出口

AG 的固定任务领取、独立故障分类和结果复用用于本次处理：只分析新增 SFGT + 原始负金币组合，复用固定官方客户端、已审 XML、十步计数及金额证据，不重定位客户端、不重放原 8 帧。未知重触发、Hold 切换、Grand 和强制出口继续拒绝。

源36961087858新增888完整，累计8391；8帧SFGT/CL=-4已留样作废。唯一无源结清36962300874在runtime17d5ef9成功，8391完整和全文收据保留，reserved0、pending0、活租约0、repair pending-adapter、sourceAllowance0，共享hold=false。冻结结清配置canonical a8ec5be2ba5d9dcb9f270387f0a07dcbead444e82d266c321cd96e09a5e234d8，不能重新应用或授予源额度。

新增独立 `pyramids-super-cash-coins-v1` / bonus10 / hash151c2d1567d4b0102c89881cf2c1d5fe52fada3e9971bd96d0eb8fd8c1daa67a。Python、Runner、collector分别核同会话原XML、SFGT、TFG10不变、CFGG逐步加1、NFG逐步减1、金币几何与别名、B=start-20+TW及未到账AB、responseBalance=AB。组合处理优先于单一金币和Super Free处理，旧scope不放宽，旧映射及所有已应用profile不变。

本机10项Python、6项Runner相关及4项collector检查通过，TypeScript通过。原8391完整逐条复核原规范化及recordsHash不变；原8个前缀均仍是FREE_GAME、未完成。三种合成现金终局及未知符号、错误计数、混合、错钱包和XML负例通过。组合自然终局仍未观察；映射接线不等于新会话准入、整款ready或全部效率验收。

效率已实测的4路采集窗口相对1路提高99.20%，相对2路提高49.96%；两组离线预检相对单组减少20.12%和15.93%。本次本机8391回放约2.53秒仅是本机验证成本，不能称采集吞吐提升。预检、必要准入与结果归档连续衔接；下一款准备独立于该款修复。匹配采集资源窗口、新版300000自然终审和实际跨游戏自动接力仍未全部验收，allOptimizationsComplete保持false。

独立v10范围检查4项Python及16项Runner相关检查通过。原8391全量在正式activateFormalRepair入口内存验证通过，两Python/100条有界页/旧journal与batch不变，剩余291459加8391及历史150保持300000。新profile尚未应用，新会话仍需Linux、固定文件备份与fresh准入；旧源不会恢复。
