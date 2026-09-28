# 32714 Hard Hat adapter

This adds a production adapter and an independent Runner implementation for
32714 Huff N Puff Money Mansion High Limit. Release `a6ff895` was deployed and
the evidence-bound primary recovery was applied on 2026-09-28 at 13:02 UTC.
The controlled short run then stopped on a different natural mode, Touch Up
(FID2), before the original Hard Hat pending round resumed. Both groups are
paused again. Live Hard Hat settlement is still unverified. See the
[actual recovery and short-run result](huff-group-recovery-20260928.md).
32717 Wheel remains a separate protocol and is not enabled by this change.

## Pinned evidence

The cached official client SHA256 is
`67bcebfd2f16477c8c3b2686b6e10b70f41bde3579d929e89e04e321ffa4e93d`.
The existing inventory and stop report retain the source line references and
the private pending evidence hashes. The preserved pending BET is sequence 402,
batch 5, primary worker 14; its next message is FREE_GAME. No BET is replayed.

The client maps FID 1 to HARD_HAT_FS, uses NFG for ordinary free continuation,
and uses FREE_GAME for Money Mansion intro when MMBG is 1 but MMW is absent.
The historical terminal Money Mansion response retains MMBG=1 and has MMW;
that flag by itself must not trigger an extra spin.

## Implemented contract

`service/huff_fields.py` validates the entire sequence, exact ordinary request
template, same session, XML/payload agreement, counters and final balance/stake.
It supports FID 0/1 and their two-slot combination, with replay labels MMANSION
and HARDHAT. A Hard Hat trigger must have a positive remaining counter and a
completed Hard Hat chain must contain an explicit HARDHAT free-game replay.
The original successful BET and every response remain in the durable journal.

PAINT, HOMEIMP, MANSION and any other unsupported IDs, replay labels or previous
feature slots still stop collection. Recognizing a name in the offline
inventory does not enable that feature. Counter growth is allowed because
natural awards can add free games; a fixed six-request loop is not used.

The independent Runner implementation is `scripts/trial/huff-protocol.mjs`.
Storage remains responsible for verifying the full response XML, exact request
parameters and final money evidence before committing a round.

The additive `-hard-hat-v1` profile assigns bonus 2 to Hard Hat and bonus 3 to
Hard Hat with Money Mansion. These are internal normalization codes, not SG
feature IDs. Existing ordinary and FID0 records keep their original profile,
bonus and mapping hash. No frozen plan, campaign configuration or quota changes.

## Adapter validation before deployment

Windows and Linux: 184 Python tests passed, including eight new adapter tests.
The final additional combination/reset checks passed all 31 Huff tests on both
systems. All 27 Node tests passed, with the four Huff tests repeated after the
final checks, including independent TypeScript/Python settlement comparison.
All 100 historical ordinary/FID0 chains produce the same old and
new normalized fields. The preserved pending raw record returns FREE_GAME.
Synthetic full Hard Hat and nested-Mansion sequences exercise incomplete-round
rejection, resumed durable pending state, missing fields, wrong stake, changed
session and unknown types. They are not new official rounds or live proof.

The final candidate is independently staged at
`/opt/sg-capture-runner/reviews/huff-hard-hat-candidate-v2-20260928`, package
SHA256 `9e5de58468ee598400e981b97ec98f754e0be893c905d34cb558f90b52a1f409`.
Read-only replay confirms both current complete records are unchanged and the
preserved pending raw hash still matches. The one durable Mongo document was
also fully read back. At that pre-deployment checkpoint, runtime remained
`c9b02dc`; no source request, live-state write, deletion, proof application or
workflow dispatch had been performed.

The new group recovery operator subsequently passed all 190 Python tests on
both Windows and Linux. It backed up both groups, retained the old failure,
cleared the precisely reviewed historical global pause and opened primary
only. That proof is applied and must never be reused. The first short run was
not a successful validation: a new Money Mansion response triggered Touch Up.
The current pending set and receipt counts therefore differ from the first
proof. A new protocol implementation and a new evidence-bound review are
required before any further source request.
