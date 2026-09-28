# 第二组删除旧运行后的重试

用户明确要求删除第二账号启动失败的运行并重新启动。已先完整保存两次旧运行的元数据、全部 jobs 和日志 ZIP，验证 ZIP CRC 和文件 SHA256，并在本机及私有服务器保留备份，再删除 GitHub 上的 `36398275924` 和 `36401689140`。这些旧运行的 GitHub 链接不再可用。

备份归档 SHA256：`80548e06ea627eacc69ca5fec524a9e8aafc31c810e329e8cca9a4e59712a010`。两次旧运行各有 20 个采集步骤 skipped；没有删除任何已完成采集记录、会话或额度。

随后手动派发 [新运行 36403634321](https://github.com/287113535qq-cmyk/sg-capture-runner/actions/runs/36403634321)，仍使用原 `trial-300k.yml`、20 分片、`allocation=round-one`、`round_one_limit=10`。该运行于 2026-09-28 09:31:45 UTC 结束为 failure。

最先失败的分片日志显示：启动等待期内只有本地分片 1、6、8、10、11、15、17 共 7 个就绪，180 秒后报 `RUNNER_CAPACITY_NOT_READY`。后续任务因集体启动失败而停止。最终 20 个 capture job 都在等待步骤失败，20 个实际采集步骤全部 skipped，官方源请求为 0。

三次启动分别观察到 5、6、7 个分片同时就绪，删除旧运行没有解决问题。这些观察不能证明账号永久并发上限，GitHub API 未给出账号侧排队原因；本机网络重启也不能作为这些云端任务未获分配的原因证据。

第二仓库的 workflow 已重新禁用，`SG_TRIAL_ENABLED=false`，新失败运行保留供查看。不持续重复派发，不减少 20 台启动要求，不更改费用或认证权限。下一次启动需要新的账号/容量证据或用户明确重试指令，并仍须通过短采和完整核验后才能投入正式采集。

查看分片：运行页面左侧 Jobs 中的 `capture-0` 至 `capture-19`；`Queued` 表示等待 Runner，`In progress` 表示任务运行，只有进入 `Capture complete rounds with independent sessions` 才表示采集步骤开始。红色失败步骤可以展开查看错误。

原账号已完成 32711 的恢复短采和全文审计，并派发正式续采 [36405044999](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36405044999)。恢复详情见 [Hoppily 回执](hoppily-recovery-20260928-result.json)。第二组尚未完成源端验证，不能宣称 40 台同时采集。
