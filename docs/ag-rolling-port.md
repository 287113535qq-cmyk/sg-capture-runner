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

The live adapter now uses the existing `trial-300k.yml` workflow's explicit
`ag-rolling` role. Admission seeds the same 22 AG tasks, then twenty lanes use
the original AG loop. A separate zero-source controller merges settled games
while the lanes continue; an ended-run finalizer seals the window. Registered
queue profiles bind the complete checked code manifest, exact successful Linux
run, historical adapter proofs and installed native gateway/manifest hashes.
Nothing starts merely because a candidate has an offline historical proof:
its two original AG live canaries must succeed before formal tasks run.

`sg-protocol-session.mjs` journals each SG request before sending it and each
response before natural continuation. `sg-nextgen-codec.mjs` compares the
existing JavaScript normalizer and independent Python verifier. Metadata
inserts coalesce across the original eight sessions. Full staged record bytes
and source intent/response pairs are checked before counting an ended prefix
for resume. The old prefix stays in place and new anonymous sessions continue
only its missing quota; unfinished or unknown requests remain uncounted and
are never replayed. Unknown Mongo copy ACKs require an ended merge actor and
fresh readback; settlement issues only definitely missing rows.

The native candidate supplies fixed insert-only staging/task batches, native
copy of selected staged bytes, exact trial counts and narrowly scoped cleanup.
It performs no source request, gameplay normalization, scheduling or quota
decision. All operations require the installed root-owned capabilities and
fixed trial scopes. Canonical records receive full independent validation and
native readback before completed staged/source bytes can be cleaned up.

The candidate plan registry currently contains 81 historical NextGen adapter
proofs and excludes 18 completed games. These are offline candidates, not 81
online admission results. Historical partial data needs independent baseline
verification before that game is placed in the initial queue; unsupported
protocol families still need SG adapters. Neither these checks nor the fixture
simulation prove that all 178 games are ready or a live throughput increase.
Huff's completed 300000 records and all existing permissions are preserved.
