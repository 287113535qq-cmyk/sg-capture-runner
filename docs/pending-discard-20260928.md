# Explicitly authorized replacement of incomplete rounds

The user authorized deleting anomalous incomplete big rounds and starting the
capture flow again on 2026-09-28. This supersedes the previous requirement to
resume the three pending attempts in trial `sg_r1_20260928_32651`.

The initial bounded operator procedure in `service/pending_discard.py` covers
batch 5 / sequence 424, batch 11 / sequence 1015, and batch 18 / sequence 1708.
The last attempt has a durably recorded `ERROR_INVALID_SESSION` response; the
other two remain incomplete after the protocol stop. None is credited as a
completed round. This procedure is not an automatic error-skipping policy.

Before removal it checks the paused gates, expired leases, unchanged plans,
session bindings, full receipt contents, files and committed Mongo contents.
The initial profile refuses unknown responses. It preserves private SQLite backups,
files and all original pending attempts and failure evidence. Each pending
removal and its audit event share one FULL-synchronous SQLite transaction.
Complete receipts, quotas, allocation ranges and session bindings are unchanged.
An interruption leaves source gates closed and requires a new review.

The normal next claim flushes previously journaled complete receipts, then
starts INIT/REELSTRIP with no pending continuation. A new attempt UUID fills
each uncompleted sequence through the ordinary BET flow. The old attempt is
never resumed or counted. Source requests remain confined to the original
GitHub-hosted workflow; operator review makes no source request.

Activation requires a separate fresh check that no capture jobs are active or
queued. Keep the scheduled gate false for the original workflow's 10-round
per-worker validation. Verify replacement attempts, complete storage and
settlement before enabling the normal first-round run. All 178 games retain
their 300,000-round first-round targets; phase two remains disabled.

## Execution result

Operator review commit `71e3c17427e8c95da8d3fb24e2f5418254390135` passed all
135 Python tests on Windows and all six new discard tests on Linux. It ran from
an independent review directory; runtime `current` remains `733dde4`.
Proof `203e492c34f671d49ee1ff608a67c147e91e9a0c50e738ebde2187b545341c45`
was applied once after verifying no active/queued capture jobs and expired
leases. The three old pending attempts were removed. All 233 complete receipts
were preserved exactly. No source traffic or Mongo deletion occurred.

[Short validation 36390142715](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36390142715)
succeeded in all 20 capture jobs and the aggregate verification job. Each
worker completed ten new big rounds: 200 in total, including three natural
free-game rounds. The three discarded sequence positions were filled by
different attempt UUIDs, each starting with a new BET and settling completely.
The 37 previously journaled records were flushed. A separate operator audit
verified all 433 records against raw/normalized files, SQLite and full Mongo
contents, including the unchanged 233 original records. No pending or unknown
responses remained after validation. Together with 100 verified historical
rounds, this game had 533 credited rounds at that boundary.

The private backup and audit event are stored under
`/var/lib/sg-capture-runner/reviews/sg_r1_20260928_32651-20260928-user-authorized-discard`;
`short-validation-result.json` records the full verification. These private
records are not part of this public repository. Do not rerun the old recovery
proof or this already-applied discard.

After another no-active-job check, the original
[formal capture 36390301074](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36390301074)
was dispatched with `allocation=round-one`, `round_one_limit=0` and 20 workers.
The scheduled gate is now true; campaign/source gates are enabled with no
failure. This is a recovery snapshot, not a claim that the game or all 178
first-round targets are complete. The three natural free rounds do not by
themselves establish live jackpot-pick coverage.

## Subsequent HTTP 502 stop

Formal run 36390301074 completed 5,536 additional big rounds before shard 3
received HTTP 502 for the new BET at batch 93 / sequence 5982. There was no
official game response for that attempt: its outcome remains unknown. The
runner preserved the intent and stopped. Four other incomplete free-game
rounds were interrupted by the global gate. At this stop, 5,969 complete rounds
were journaled and 5,825 were in files/Mongo; 144 needed normal flushing.
The workflow and scheduled gate were disabled again.

The user's instruction to remove anomalous big rounds and start the flow again
also authorizes abandoning these five incomplete attempts. The additional
operator profile binds this one incident, run ID, HTTP status, exact private
pending hash and sequences 5374, 5713, 5982, 6209, 6375. It retains the unknown
status of the old BET in the private audit, never replays that intent, and does
not count it. Replacement capture starts the normal initialization flow and
uses a new attempt. This narrow abandonment exception is not a general retry
or discard policy for unknown requests. HTTP 403/429 and other unmatched
incidents cannot use this profile. All backups, lease, full-content and pause
checks still apply. The original HTTP response body was not retained by the
existing runner; evidence is its logged HTTP status and the persisted intent.

Operator commit `8c5c69fc9f4dc3726ff992e91c41294cb5ba757e` passed 136 Python
tests on Windows and seven discard tests on Linux. After all capture jobs had
ended and the final worker lease expired, proof
`07481604f803207c93f596c49b667234e65304b6e74601bf1f1b16f593e65c4a`
was reviewed and applied once. All 5,969 complete receipts and the 5,825
committed file/Mongo records were fully verified before the five removals.
Backup and original unknown intent are preserved privately in
`/var/lib/sg-capture-runner/reviews/sg_r1_20260928_32651-20260928-http502-authorized-discard`.
Runtime release, plans, bindings, ranges and quotas remain unchanged.

[Second short validation 36391451147](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36391451147)
succeeded with another 200 complete rounds (197 ordinary-only and three natural
free rounds). All five replacement attempts settled and had new UUIDs. The
144 journal-only records were flushed. A full operator audit verified **6,169**
complete records in files, SQLite and Mongo, preserving all prior 5,969 payloads
exactly. No active pending or unknown response remained; the abandoned old
gateway attempt's outcome remains unknown in the audit archive. With 100
verified historical rounds, the game's credited total at this boundary was
6,269. These records include five pure jackpot-pick rounds and one combined
jackpot/free round: six FEATURE_START, 58 FEATURE_PICK and six FEATURE_END
responses were observed in complete chains and passed full settlement checks.

With no other active/queued jobs, the original
[formal continuation 36391708988](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36391708988)
was dispatched with `round_one_limit=0`, 20 runners and `allocation=round-one`.
Scheduled continuation is enabled again. The operator archive contains
`short-validation-result.json`; the public summary is
`http502-discard-20260928-result.json`. Neither old discard proof may be reused.
