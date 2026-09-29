# Expired queued recovery supersession

Recovery run36525403196 has produced no jobs or recovery writes. Its candidate at commit7296147 expired before execution; ordinary and force cancellation returned409. A source-free check in the same workflow and concurrency group completed successfully with20 runners. The original scheduling cause remains unproven. Our previous all-queued-runs idle rule had no continuation path for this reviewed expired record.

The new candidate preserves the old configuration unchanged and uses a separate configuration, journal prefix and immutable supersession receipt. Only that precise original run/attempt/commit may remain queued; any job, status change, other active run, old recovery write, profile mismatch or changed incident evidence blocks the candidate. The original code's expiry check precedes incident writes. No generic queued-run exception is introduced.

The GitHub operator verifies complete246 records and original117 refusal plus902/1706 continuations, reads leases, and persists/readbacks the supersession receipt before new incident backup. Partial work cannot be rerun automatically. Later validation requires the same receipt/profile/commit and completed recovery proof, without requiring the pre-recovery snapshot to remain unchanged after authorized writes.

The existing exact117 algorithm is reused under a distinct prefix. Its full backups, hold checks, independent806/434/117 replacement requirements, same-identity902/1706 continuations,200 finite new rounds across20 workers,446 full Mongo records and real natural DemonFID1/bonus2 gate remain mandatory. No source calls occur during recovery. Missing feature evidence prevents formal promotion.

Implementation and local tests are complete; Linux and actual execution results are recorded separately. This preparation document is not a successful recovery receipt. The frozen old profile is not extended or regenerated. Beaver offline integration remains separate.
