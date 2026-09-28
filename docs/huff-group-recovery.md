# Evidence-bound primary Hard Hat recovery

`service/huff_group_recovery.py` is an operator-only procedure for the preserved
32714 stop. It uses the current independent-group controller; the legacy
32651 recovery code remains unchanged and cannot be used for this incident.

The procedure pins both known protocol stops, including game, worker, batch,
sequence, raw digest and complete/committed counts. It rejects active leases,
unknown responses, changed sessions/plans, new failures, a different global
pause, expired proofs, altered receipts or any file/Mongo mismatch. It validates
both games' existing complete records and checks that primary's pending BET
continues with FREE_GAME. Secondary's unadapted Wheel stays paused.

A dry review creates a five-minute proof bound to the complete current control
snapshot and implementation. Apply rereads and verifies the snapshot under
selection, pool and batch locks. Before modifying state it backs up both games'
databases and files plus the campaign database, persists a hash manifest and
records the original failures. It does not delete a pending or complete record,
change a session, move a batch, reset a quota or resend a BET.

Primary batch/pool changes are persisted while the global source gate remains
closed. A final campaign transaction records completion, clears only the exact
reviewed historical protocol-exit global pause and enables primary. Secondary
remains disabled. A crash between databases leaves the source gate closed and
a recorded event that prevents automatic repeated application.

GitHub activity must be checked immediately before applying: both repositories
must have no running or queued capture jobs. Scheduled capture remains disabled
during the controlled primary run (`round_one_limit=10`). The preserved natural
round and the old unfiled receipt must pass full storage audit before enabling
formal continuation. A protocol validation test is not evidence of a successful
official Hard Hat settlement.

Six dedicated recovery tests cover retained backups and both original BETs,
single application, group isolation, stale proofs, changed sessions/state,
active leases, unknown outcomes, unreviewed failures, Mongo corruption and an
interruption between database writes.
