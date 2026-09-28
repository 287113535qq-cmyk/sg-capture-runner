# Explicitly authorized replacement of incomplete rounds

The user authorized deleting anomalous incomplete big rounds and starting the
capture flow again on 2026-09-28. This supersedes the previous requirement to
resume the three pending attempts in trial `sg_r1_20260928_32651`.

The bounded operator procedure in `service/pending_discard.py` covers only
batch 5 / sequence 424, batch 11 / sequence 1015, and batch 18 / sequence 1708.
The last attempt has a durably recorded `ERROR_INVALID_SESSION` response; the
other two remain incomplete after the protocol stop. None is credited as a
completed round. This procedure is not an automatic error-skipping policy.

Before removal it checks the paused gates, expired leases, unchanged plans,
session bindings, full receipt contents, files and committed Mongo contents.
An unknown response cannot be discarded. It preserves private SQLite backups,
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
