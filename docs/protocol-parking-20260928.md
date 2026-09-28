# Keep collecting while a natural feature needs adaptation

The user authorized parking an unsupported game and assigning another ready game to the same runner group. Each of the 178 games retains its one first-round target. `parked-protocol` means unfinished work awaiting adaptation, never complete or excluded.

The operator installs `sg-protocol-parking-v1` through a fresh, five-minute proof covering both paused groups, fixed plans, sessions, receipts, pending attempts and code. Both existing games are backed up privately before one SQLite transaction installs the policy, parks them and frees their groups. No game journal, balance, session binding or quota is modified.

In formal capture, a successful response that the adapter rejects as an unsupported natural feature pauses that game. Each finished worker relinquishes only its fenced leases. Selection waits for all workers to drain, independently checks successful raw request/response envelopes and the specific unsupported-feature error, then makes a full private backup and assigns the next ready game. Expired or late requests cannot pause the replacement game. SQLite journals are inspected and backed up one at a time to keep file-handle usage bounded.

Unknown outcomes, unsuccessful source responses, cooldowns, storage failures and low disk still stop collection. An incomplete backup or failed verification also stops without changing assignments. Parked games preserve their original owner and are not automatically resumed. Restoring one requires its own protocol adaptation and evidence-bound review; no original BET is replayed. Final completion still requires the existing full file/SQLite/Mongo audit and the verified historical credit.

The per-worker ten-round validation remains bounded to one game. Formal mode (`round_one_limit=0`) enables automatic continuation. The two repositories retain 20 matrix jobs each with available-worker startup. The Codex heartbeat remains paused independently of the GitHub capture schedules.

Implementation validation: Windows 199 Python tests passed, including nine new migration/parking tests. Deployment and official capture results are recorded separately; offline fixtures are not official rounds.
