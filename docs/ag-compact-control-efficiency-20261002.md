# AG compact control efficiency

The actual failed run issued 18,980 control reads. Its pool snapshot was about 789KB. Each source intent needs fresh shared holds, active game/pool state and its own worker fence; returning the entire quota ledger and 178-game catalog repeats unused data.

A fixed worker projection reduces the actual snapshot response from 801668 bytes to at most 642 bytes (99.9199%). This is an offline byte comparison, not measured throughput. The server performs fixed Mongo reads only. GitHub evaluates control, leases, quota and game logic. Holds are never cached. Registration, complete quota audits and CAS lease renewal retain full pool reads. Only a separately reviewed compact-worker-v1 canary permission opts in; applied old permissions remain unchanged. Response byte telemetry enables the actual comparison.

Local verification: 1227 Runner tests and 17 gateway tests passed. Fresh peer holds and replaced worker fences reject before any source intent. Invalid worker ranges reject. Linux verification, native deployment and actual throughput comparison remain outstanding; all optimizations are not yet complete.

AG preserves previous verified history proofs and validates the current complete delta once. Unknown requests are privately retained and abandoned without replay. Close the failed source without source traffic, then use a separately admitted run for a same-run one-versus-two session comparison before expanding concurrency. Repair work stays independent from healthy capture.
