# Original Pick A Ball claim correction

The first exact recovery36505642214 succeeded on8f60217:190 valid records were fully written/read back, and original1008 remained unchanged. Its proof9484c5ba3f7e6411e91b23ee120f866101537f4f0a5b18bac6222765ca712136 is already applied and must not be run again.

Short36505910982 produced190 additional complete rounds from19 workers. Worker38 failed before any source request: the Python adapter correctly returned FEATURE_START/CFG1, but BatchController compared it with the historical incident policy's CFG2. The original one-frame1008 and its unconsumed permit remained unchanged; this was a Runner claim validation defect, not a source/session failure. All380 valid records were written. No validate/formal ran.

The controller now independently checks the exact saved Quarterback sequence with the Runner adapter, while retaining plan/session/worker/pending/proof/code/expiry checks. A regression test executes the actual controller claim, accepts CFG1, rejects a mismatched analyzer CFG2 and proves a failed claim does not consume the permit.

A separate `pick-claim-*` operator binds this observed380/380 scene,20 original batches, the untouched1008, the failed short run, and the original unconsumed permit. It first backs up all380 receipts and state, verifies complete Mongo documents, then issues a new code-bound permit. It neither modifies the old permit nor resets a session, replays BET, or clears a global hold. The new short must produce580 full records with all20 workers adding10, actual original1008 bonus3 settlement and unchanged original380 records before formal capture.

At candidate publication this new rebind has not yet run. Outcomes are recorded in `pick-bonus-recovery-20260929-result.json`; historical profiles remain immutable.
