# 32836 Pick A Ball protocol

The candidate supports standalone FID1 with a fixed, outcome-independent Pick A Ball choice. It does not claim every Pick a Bonus menu option or stacked feature is implemented.

Official cached `game.bundle.js` SHA256 `789a750fbcc2e3539d1257a3926908c04f5d478cf957b5464b691f06d79fb3ec` defines Pick a Bonus as FID1. `startFeature` requests FEATURE_START/CFG1. All three visual ball buttons call `sendFeaturePick(1)`. Its request uses currentPick=1 and the platform in `412.bundle.js` SHA256 `43c79de4ffeeebec57ab1a0c7765b47a310d489f82a589bd69be4a495be233a2` serializes FP as `0|1|1`. This choice does not inspect featureData, prize or payout.

The reviewed chain is BET → FEATURE_START → FEATURE_PICK → FEATURE_END, with the same original session and exactly one paid BET. START requires CFG1/CFP_1=0; PICK requires CFG1/CFP_1=1. END may retain FID1 with a completely omitted counter group, or provide explicit completed counters. Partial omission is rejected and absent fields are never converted to zero. All frames must remain standalone FID1 (or cleared FID), with no positive free counters and no other feature counters. XML, full response, request parameters and final TW/B/AB must reconcile with actual ordinary stake25.

`isFoamFingerNext` and `checkForBonus` inspect the second element of `game.features` and start Foam when it is2. Therefore FID1|2|, any FID2 transition, free continuation or unknown stack is preserved for review rather than treated as a finished Pick A Ball round. Run the Yards (choice3), Field Goal (choice2), free-triggered and combined chains remain outside this candidate.

Mapping is additive: ordinary/FID0 and actual Foam20 keep their existing profiles/hashes; standalone Pick A Ball uses `-pick-a-ball-v1`, bonus3. The Runner chooses its hash independently of the old Foam bonus2 profile. Python and TypeScript independently validate settlement; synthetic test chains are not official samples.

The exact recovery scene is short run36502517559, original batch11/worker38/sequence1008. Its one successful BET is preserved. The new operator first backs up all190 existing full records and current scene, reconciles12 outstanding writes, then creates a one-time continuation grant bound to the original pending/session/worker/plan and new commit. It does not archive the natural pending or request another BET. Validation requires390 complete records,20 workers each adding10, the original1008 identity/prefix plus actual bonus3 settlement, all190 old records unchanged and full Mongo readback before formal capture.

At candidate publication, recovery and live Pick A Ball validation have not yet run. Operational outcomes are recorded separately in `pick-bonus-recovery-20260929-result.json`.
