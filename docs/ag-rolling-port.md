# SG uses AG rolling capture

AG source snapshot: `scripts/ag-reference/source.json`. The twelve referenced
source files are copied byte for byte. `scripts/build-ag-rolling-core.mjs`
extracts original declarations by TypeScript AST and transpiles them without
editing their algorithms. `--check` verifies every source digest and generated
module. Git attributes preserve the original bytes on Linux and Windows.

The running algorithms come from AG:

- `RollingPayload`: `version`, `queueId`, and games with `gameId`, `dbName`,
  `campaignId`, `baseline`, `mongoUri`.
- Twenty lanes, two ten-record canaries, `canary:1..2`, `worker:1..20`.
- Task states `pending`, `running`, `success`, `failed`, `blocked`.
- `runLane` rolls directly to the next game after its own shard ends.
- `AGGameRunner` owns the original eight-session loops, choice balancing,
  quota counting, lease renewal and shutdown behavior.
- AG's original `mergeDecision` requires all twenty ended tasks, no live
  leases, and permits up to seven staging records over each worker's quota.
  It selects each quota and merges exactly the target, including the baseline
  once. Staging overshoot does not increase the formal target or change any
  existing SG capture permission.

SG differences are transport/protocol/storage adapters:

- `sg-task-store.mjs` persists the original AG task rows through group-scoped
  native Mongo I/O. Each task has its own key; the queue is not updated once per
  captured round, and there is no shared `campaign.activeGame`.
- `sg-capture-adapter.mjs` supplies SG sessions and SG storage to the original
  `AGGameRunner`. An unknown SG source outcome aborts before the AG retry branch.
  Full natural rounds, independent verification and full native readback are
  required before a successful task.
- `sg-staging-store.mjs` uses task-scoped staging and leases, coalesces inserts
  from eight sessions, checks every returned byte, and streams a fresh full
  independent audit before success. The SG protocol adapter must separately
  attest that all source intents are closed, no unknown requests or protocol
  faults remain, and no session lease is active.
- `sg-transport.mjs` serializes the SSH connection's one-ACK protocol while SG
  sessions remain concurrent. An uncertain ACK poisons queued operations;
  it never resends a source or storage write.
- The candidate native `rolling_journal_insert` is insert-only, fixed to the
  staging database, group and metadata collection. It is disabled unless the
  installed root-owned manifest grants `rollingJournalBatchEnabled`. No
  business decisions, quotas, source requests or scheduling run on the server.
- `sg-lane.mjs` connects these adapters to the unchanged AG lane loop.

Validation includes seventeen original AG tests plus SG adapter tests covering
twenty concurrent claims, 178-game rolling simulation, isolated failure,
eight sessions, unknown ACKs, staging content conflicts, independent full
readback and task-scoped leases. The simulation uses fixtures and does not
prove online admission of 178 games or a live throughput increase.

This change is the reusable execution and storage foundation. It does not
activate a new SG queue, expand an old profile, enable the native capability,
provide missing game protocols, or claim that all games are ready. The live
queue entry, registered source binding, SG session/protocol integration,
per-game canary evidence and controlled merge/reconcile must be connected
and checked before starting the rolling queue. Huff's completed 300000 records
and every existing completion/permission record are preserved.
