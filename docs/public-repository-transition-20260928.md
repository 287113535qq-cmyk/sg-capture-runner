# Public repository and controlled recovery, 2026-09-28

The user explicitly authorized using a public repository. The existing
`zyzuoyang/sg-capture-runner` was changed from private to public; no alternate
repository, account or runner infrastructure was created. This authorization
supersedes the previous prohibition on making this repository public. Private
source data and authentication material remain in the existing private storage.

Before the change, 43 commits and 258 reachable Git blobs (2,340,784 bytes) were
reviewed for private keys, credential URLs, tokens, session literals and secret
assignments. The 13 pattern matches were test-fixture values. All 31 existing
Actions log archives were downloaded privately and scanned (6,962,319 bytes of
log content); no credential-pattern matches were found. There were no Actions
artifacts or release assets. These are bounded scan results, not a guarantee
that automated scans detect every possible sensitive value. Raw downloaded logs
are ignored local files and were not committed.

GitHub documents free standard hosted runners for public repositories and the
publication of Actions history and logs when visibility changes:
[billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions),
[visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility).
No budget, payment or authentication scope was changed.

The original [offline preflight 36388249292](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36388249292)
completed successfully at commit `4c44b24d889ab0044de5da1ae1bf8c48a3f5e798`:
129 Python tests, 25 collector tests, 19 Node tests, TypeScript and a 3,000-round
offline fixture. No SG requests were made by that preflight. This verifies that
runner allocation worked after publication; it does not establish the precise
prior billing condition.

With no active/queued jobs, the paused campaign and original recovery proof were
checked again. Operator recovery verified all 233 complete receipts, 189 Mongo
documents and the three pending rounds against proof
`0cc94e67c416ff2c94747b462f2c7a383a70350e622eae7122b8befecb12501b`.
`protocol_recovery.recover(..., apply=True)` persisted the original failure audit
and enabled the service gates. No quota, binding, session or runtime release was
changed. `current` remains `733dde4248c9789306c9ab312c9f8d76e584786b`; changes since
that release were reviewed as offline checks/reports and operator review tools.

The original workflow was enabled for one
[short run 36388437658](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36388437658)
with `allocation=round-one`, `round_one_limit=10` and 20 runners. The scheduled
gate `SG_TRIAL_ENABLED` stayed false. The first source continuation was the
original `FREE_GAME` for batch 18 / shard 0 / sequence 1708. Its response was
`MSGID=ERROR&EID=ERROR_INVALID_SESSION`. The full response was journaled before
the global halt. No BET was sent and no new complete round was produced.
This establishes rejection of that original session at this attempt; the other
two pending sessions were not tested after the global stop.

Post-stop review confirmed:

- All 233 original complete receipt hashes are unchanged.
- 196 complete records match the raw/normalized files and Mongo full contents.
  Seven previously journaled records were flushed; 37 remain journal-only.
- Sequences 424 and 1015 have unchanged raw histories.
- Sequence 1708 retains its original six-frame prefix and one new rejected
  FREE_GAME response. All three pending records have no unknown response.
- Campaign/source gates are paused, the workflow was automatically disabled,
  and `SG_TRIAL_ENABLED=false`. Counts remain 3 complete, 1 active, 19 ready,
  155 needs-adapter. Phase two is still disabled.

The applied recovery result is stored privately beside the original proof as
`recovery-applied-20260928.json`. The verified new snapshot is
`/var/lib/sg-capture-runner/reviews/sg_r1_20260928_32651-20260928T0650-invalid-session-verified`,
including SQLite backups, available raw/normalized files, their hashes and
`result.json`. The old proof is historical and cannot authorize another recovery
after this changed response and failure state. Do not rerun the original
recovery, replay a BET, substitute sessions, clear the new failure, or mark any
pending round complete. Further action needs evidence that the original round
can be resumed, or an explicitly authorized change to the recovery boundary.
