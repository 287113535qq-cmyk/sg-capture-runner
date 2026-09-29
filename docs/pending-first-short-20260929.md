# Demon continuation-first short capture

Historical candidate report below. The806 recovery and staged failure barrier were subsequently executed; see [actual results](demon-pending-session-recovery-20260929.md). The latest434 rejection has no new recovery proof.

This is an implemented, offline-tested runtime candidate. It has not recovered sequence806, created a runtime proof, resumed any pending round, or sent an SG request. The existing source hold and both scheduling variables remain unchanged.

## Why separate hosted jobs

Waiting inside all20 capture jobs can consume the available GitHub slots while an original pending owner remains queued. The new `pending-first-short` role instead has a four-owner `pending-resume` matrix for workers0/1/2/7, followed by a20-worker `pending-capture` matrix with an explicit successful-job dependency. It is limited to round-one validation with limit10. Ordinary capture and runner-check retain their existing scheduling.

The four workers correspond to the current un-rejected sequences434/117/902/1706. Their identities are independently checked against a new private proof, not authorized by the public matrix. Sequence806 is excluded because it has an explicit source rejection and needs a new, separately reviewed archive/replacement operation first. No recovery for that new incident has been applied.

## Runtime enforcement

`pending-first.mjs` requires a private immutable `pending-first:<proofHash>` document, a matching hash in `campaign.protocolValidation.pendingFirst`, the original plan, exact commit, unique run/attempt, and an unexpired two-hour window. The current incident has no such document, so the new role cannot authorize source work with existing permits.

The resume stage accepts only each listed original worker/session/batch/pending digest. It forbids both bootstrap requests and new BET intents, even if the caller ignores the one-round limit. Original continuations still use the existing fenced, single-use permit and durable response pipeline. A completed original round is flushed and fully read back immediately. Source rejections, unknown outcomes, resource and global holds retain their existing behavior.

Before any capture-stage worker registers, all four original records must match their original attempt, session, BET prefix and start balance, have a checkpoint, pass Python verification and independent Demon terminal/bonus interpretation, and equal the entire Mongo record. A successful job status alone is insufficient. Missing or changed evidence fails closed.

The original completed-record baseline is stored in the new private specification. Capture-stage quotas subtract actual persisted increments. Each resumed original therefore leaves9 rounds for its owner; other workers receive10. Total short-capture increment remains200, so the current246 would become446 only after actual successful completion and full verification. No counts are advanced by this candidate.

## Remaining activation work

Implement and test a new precise sequence806 recovery operator. It must bind fresh idle/lease/hold/resource evidence and the previous applied proof, back up all246 valid records and all5 pending scenes, flush21 valid records, and archive only the explicitly rejected806 attempt. It must preserve434/117/902/1706 and issue fresh permits plus the private pending-first specification from that reviewed snapshot. All previously applied profiles remain immutable.

Recovery, staged short capture, full validation and formal promotion must use one fixed new commit. Full validation must preserve all246 old records, prove an independent806 replacement and the four original continuations, verify each worker's total increment10 and all446 records with no pending. A new genuine natural DemonFID1/bonus2 terminal chain, verified independently and in Mongo, remains an additional required gate. The rejected old432 and bonus0/1 replacements cannot satisfy it. Lack of that evidence does not authorize an unbounded probe or formal capture.

This change does not alter source protocol mappings or the Mongo-only server entry. The server continues to execute only native database reads/writes and system metrics.

## Validation and preservation

Candidate commit `6f283f8e652e6b630b1da1f73baced99dae00dea` passed Windows241 Python tests,206 Node tests and TypeScript checks. GitHub Linux preflight [36520645452](https://github.com/zyzuoyang/sg-capture-runner/actions/runs/36520645452) passed241 Python,44 protocol Node,162 Runner Node,25 collector tests, TypeScript,178 rule-card checks and the3000-round offline fixture. This workflow uses no SG requests or database connection.

The actual private incident snapshot was also checked without mutation:246 journaled/225 Mongo records and all5 pending scenes match the prior archived snapshot exactly. The four preserved owners match the workflow matrix and their independent Runner continuation is FREE_GAME. The readonly lease snapshot covered3100 batches and showed no active worker or batch lease. Both repositories were idle after preflight; both source scheduling variables remained false. No recovery or short-capture workflow was dispatched.

Preflight metadata, all jobs and log ZIP were checked with CRC/SHA256 and saved together with the readonly scene, lease snapshot, test logs and frozen previous incident profile in two private copies. Archive:814385 bytes,10 files, SHA256 `a58505ffa77ae03a9dd36976f4be41ed5c3bed14bd7fc291d1ffec67ba7c14b4`. Neither the old proof nor its frozen profile was changed. The next operator must include the new staged runtime/workflow files in its own code binding.
