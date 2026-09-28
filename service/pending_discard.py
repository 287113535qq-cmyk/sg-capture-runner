"""Operator-only removal of explicitly reviewed incomplete rounds.

Not exposed through RPC and never automatic. Preserve a private full backup and
the original attempts before removing pending rows. Replacements use fresh
attempt IDs through the normal INIT/BET path; complete receipts are untouched.
"""
from contextlib import ExitStack, contextmanager
import json
import os
from pathlib import Path
import shutil
import sqlite3
import time

from campaign import Campaign
from pool_trial import PoolTrial
from round_fields import params
from store import canonical, digest, file_lock, require, sync_dir
from trial_store import TrialStore

REVIEW = 'user-discard-incomplete-32651-20260928'
TARGETS = {5: (424, 'FEATURE_START'), 11: (1015, 'FREE_GAME'), 18: (1708, 'REJECTED_FREE_GAME')}
HTTP_REVIEW = 'user-discard-http502-32651-20260928'
HTTP_TARGETS = {85: (5374, 'FREE_GAME'), 89: (5713, 'FREE_GAME'),
                93: (5982, 'ABANDON_UNKNOWN_BET'), 97: (6209, 'FREE_GAME'), 101: (6375, 'FREE_GAME')}
HTTP_PENDING_HASH = '5ed34cd3a5d34baa66a637fe3342b6f050d077d1016c048227a65a28ef0f0cb3'
SECOND_HTTP_REVIEW = 'user-discard-http502-run36391708988-32651-20260928'
SECOND_HTTP_TARGETS = {2473:(247738,'FREE_GAME'),2479:(248400,'FREE_GAME'),
    2480:(248565,'FREE_GAME'),2481:(248645,'FREE_GAME'),2483:(248940,'FREE_GAME'),
    2491:(249697,'ABANDON_UNKNOWN_BET')}
SECOND_HTTP_PENDING_HASH = '9e1bb881e2e2d55feab810fa347bb10a7fac8627ce1e5dd93e2340536e5f54bb'
HOPPILY_HTTP_REVIEW = 'user-discard-http502-run36399061495-32711-20260928'
HOPPILY_HTTP_TARGETS = {136:(12587,'FREE_GAME'),137:(12638,'ABANDON_UNKNOWN_BET'),
    140:(12813,'FREE_GAME'),145:(13407,'FREE_GAME')}
HOPPILY_HTTP_PENDING_HASH = 'f47f2a1d5b4ed36e7ae32e87462c139a1521c960c1a99efa780f1bbb416bbcd2'


def verify_discard(store, bound, targets=None, http_evidence=None):
    targets = TARGETS if targets is None else targets
    pending = store.pending()
    require(pending is not None, 'DISCARD_PENDING_MISSING')
    sequence, following = targets[store.batch['id']]
    if following != 'ABANDON_UNKNOWN_BET':
        require(pending['awaiting'] is None, 'DISCARD_UNKNOWN_SOURCE_OUTCOME')
    require(pending['sequence'] == sequence == store.journaled() + 1, 'DISCARD_SEQUENCE_CHANGED')
    require(digest(pending) == bound['pendingHash'], 'DISCARD_PENDING_CHANGED')
    require(not store.db.execute('SELECT 1 FROM receipts WHERE sequence=?', (sequence,)).fetchone(),
            'DISCARD_COMPLETE_FORBIDDEN')
    raw = pending['raw']
    if following == 'ABANDON_UNKNOWN_BET':
        # One explicit, evidence-bound abandonment under the user's instruction
        # to remove anomalous rounds and start the flow again. A gateway error
        # does NOT establish that BET failed. Preserve that uncertainty forever;
        # never turn this into a replay/retry rule for unknown requests.
        require(targets in (HTTP_TARGETS, SECOND_HTTP_TARGETS, HOPPILY_HTTP_TARGETS), 'DISCARD_UNKNOWN_NOT_REVIEWED')
        bid, known_hash, run, worker = (93,HTTP_PENDING_HASH,36390301074,3) if targets == HTTP_TARGETS else (
            (2491,SECOND_HTTP_PENDING_HASH,36391708988,1) if targets == SECOND_HTTP_TARGETS else
            (137,HOPPILY_HTTP_PENDING_HASH,36399061495,15))
        require(store.batch['id'] == bid and digest(pending) == known_hash
                and pending['awaiting'] is not None and not raw['steps']
                and store.state()['failure'] == 'source_http', 'DISCARD_UNKNOWN_NOT_REVIEWED')
        require(http_evidence and http_evidence.get('runId') == run
                and http_evidence.get('httpStatus') == 502 and http_evidence.get('shardId') == worker
                and http_evidence.get('error') == 'SOURCE_HTTP_REJECTED'
                and http_evidence.get('originalOutcome') == 'unknown'
                and http_evidence.get('action') == 'abandon_without_replay', 'DISCARD_HTTP_EVIDENCE_REQUIRED')
        store.field_request(pending['awaiting'], 'BET')
        return pending
    if following == 'REJECTED_FREE_GAME':
        last = raw['steps'][-1]
        require(last.get('sourceRejected') is True and last['msgId'] == 'FREE_GAME'
                and params(last['responsePayload']) == {'MSGID': 'ERROR', 'EID': 'ERROR_INVALID_SESSION'},
                'DISCARD_UNREVIEWED_ERROR')
        raw = {**raw, 'steps': raw['steps'][:-1]}
        following = 'FREE_GAME'
    next_request = store.field_next(raw)
    require(next_request and next_request['MSGID'] == following, 'DISCARD_NOT_INCOMPLETE')
    return pending


def backup_database(db, target):
    copied = sqlite3.connect(target)
    try:
        db.backup(copied)
    finally:
        copied.close()
    target.chmod(0o600)
    with target.open('r+b') as stream:
        os.fsync(stream.fileno())


@contextmanager
def open_review_store(root, plan, batch, mongo_factory, clock):
    spec = {key: batch[key] for key in ('id','worker','start','end')}
    store = TrialStore(root,mongo_factory((batch['start'],batch['end'])),clock,plan=plan,batch=spec)
    try:
        with file_lock(store.root/'trial.lock'):
            yield store
    finally:
        store.close()


def assert_batch_binding(store, bound):
    require(digest(dict(store.state())) == bound['stateHash'], 'DISCARD_STATE_CHANGED')
    require(digest(store.pending()) == bound['pendingHash'], 'DISCARD_PENDING_CHANGED')
    require(digest([dict(r) for r in store.db.execute('SELECT * FROM receipts ORDER BY sequence')])
            == bound['receiptsHash'], 'DISCARD_RECEIPTS_CHANGED')


def discard(root, proof, mongo_factory, backup_dir, apply=False, clock=time.time):
    review = proof.get('authorization')
    game_id = 32711 if review == HOPPILY_HTTP_REVIEW else 32651
    require(review in {REVIEW, HTTP_REVIEW, SECOND_HTTP_REVIEW, HOPPILY_HTTP_REVIEW}
            and proof.get('trialId') == f'sg_r1_20260928_{game_id}',
            'DISCARD_AUTHORIZATION_REQUIRED')
    targets = {REVIEW:TARGETS,HTTP_REVIEW:HTTP_TARGETS,SECOND_HTTP_REVIEW:SECOND_HTTP_TARGETS,
               HOPPILY_HTTP_REVIEW:HOPPILY_HTTP_TARGETS}[review]
    halted_batch, halted_failure = (18, 'PROTOCOL_VALIDATION_FAILED') if review == REVIEW else (
        93 if review == HTTP_REVIEW else 137 if review == HOPPILY_HTTP_REVIEW else 2491, 'source_http')
    pool_failure = 'BATCH_HALTED' if review == REVIEW else 'SOURCE_OR_SESSION_FAILURE'
    root = Path(root).resolve()
    destination = Path(backup_dir).resolve()
    require(destination.is_relative_to(root / 'reviews') and destination != root / 'reviews', 'DISCARD_BACKUP_PATH')
    campaign = Campaign(root)
    plan = campaign.plans[str(game_id)]
    pool = PoolTrial(root, plan, mongo_factory, clock)
    try:
        with ExitStack() as locks:
            locks.enter_context(file_lock(campaign.directory / 'selection.lock'))
            locks.enter_context(file_lock(pool.root / 'protocol-review.lock'))
            state = dict(campaign.db.execute('SELECT * FROM control').fetchone())
            control = dict(pool.pool.db.execute('SELECT * FROM control').fetchone())
            require(state['active_game'] == game_id and not state['enabled']
                    and state['reason'] == 'ACTIVE_GAME_REQUIRES_REVIEW', 'DISCARD_CAMPAIGN_NOT_PAUSED')
            require(not control['enabled'] and control['failure'] == pool_failure, 'DISCARD_POOL_NOT_PAUSED')
            require(campaign.disk_free() >= campaign.config['diskReserveBytes'], 'DISK_RESERVE_REACHED')
            workers = [dict(row) for row in pool.pool.db.execute('SELECT * FROM workers ORDER BY id')]
            batches = [dict(row) for row in pool.pool.db.execute('SELECT * FROM batches ORDER BY id')]
            require(all(w['lease_until'] <= clock() for w in workers), 'DISCARD_ACTIVE_WORKERS')
            require(digest(plan) == proof['planHash'] and digest(state) == proof['campaignHash']
                    and digest(control) == proof['controlHash'] and digest(workers) == proof['workersHash']
                    and digest(batches) == proof['allocationHash'], 'DISCARD_BINDING_CHANGED')
            require({str(b['id']) for b in batches} == set(proof['batches']), 'DISCARD_BATCHES_CHANGED')
            checked = []; removed = []; count = committed_count = 0
            # The paused global gate and expired leases prevent Runner writes.
            # Open only one batch at a time: a full trial has thousands of DBs.
            for batch in batches:
                with open_review_store(root, plan, batch, mongo_factory, clock) as store:
                    spec = store.batch
                    before = dict(store.state()); bound = proof['batches'][str(batch['id'])]
                    require(digest(before) == bound['stateHash'], 'DISCARD_STATE_CHANGED')
                    require(before['lease_until'] <= clock() and before['cooldown_until'] <= clock(), 'DISCARD_ACTIVE_LEASE')
                    expected_status = 'halted' if batch['id'] == halted_batch else 'complete' if batch['completed'] is not None else 'pending'
                    require(before['status'] == expected_status
                            and before['failure'] in ({halted_failure} if batch['id'] == halted_batch else {None, 'storage'}),
                            'DISCARD_UNREVIEWED_FAILURE')
                    rows = [dict(r) for r in store.db.execute('SELECT * FROM receipts ORDER BY sequence')]
                    require(digest(rows) == bound['receiptsHash'], 'DISCARD_RECEIPTS_CHANGED')
                    require([r['sequence'] for r in rows] == list(range(batch['start'], batch['start'] + len(rows))),
                            'DISCARD_RECEIPT_GAP')
                    records = [json.loads(r['payload']) for r in rows]
                    for record in records:
                        require(store.field_settled(record['raw']) == record['normalized']
                                and digest(record['raw']) == record['rawHash']
                                and digest(record['normalized']) == record['normalizedHash']
                                and digest({k: v for k, v in record.items() if k != 'contentHash'}) == record['contentHash'],
                                'DISCARD_RECORD_MISMATCH')
                    require(all(r['filed'] == r['committed'] for r in rows), 'DISCARD_STORAGE_INCOMPLETE')
                    durable = [json.loads(r['payload']) for r in rows if r['committed']]
                    require(before['durable'] == before['checkpoint'] == store.base + len(durable), 'DISCARD_COUNT_MISMATCH')
                    for index in range(0, len(durable), 100):
                        require(store.mongo.verify(durable[index:index+100]) == len(durable[index:index+100]), 'DISCARD_MONGO_MISMATCH')
                    require(store.mongo.summary()['count'] == len(durable), 'DISCARD_MONGO_COUNT')
                    for index, name in enumerate(('raw.jsonl', 'rounds.jsonl')):
                        expected = b''.join(store._file_lines(record)[index] for record in durable)
                        file = store.root / name
                        require((file.read_bytes() if file.exists() else b'') == expected, 'DISCARD_FILE_MISMATCH')
                    count += len(rows); committed_count += len(durable)
                    pending = store.pending()
                    if batch['id'] in targets:
                        pending = verify_discard(store, bound, targets, proof.get('httpEvidence'))
                        removed.append({'batch': batch['id'], 'sequence': pending['sequence']})
                    else:
                        require(pending is None, 'DISCARD_UNREVIEWED_PENDING')
                    checked.append({'batch': spec, 'state': before, 'pending': pending,
                                    'timings': [dict(r) for r in store.db.execute('SELECT * FROM timings ORDER BY sequence,step')]})
            require(count == proof['expectedComplete'] and committed_count == proof['expectedCommitted']
                    and len(removed) == len(targets), 'DISCARD_COUNT_MISMATCH')
            result = {'review': review, 'proofHash': digest(proof), 'applied': apply,
                      'preservedComplete': count, 'mongoVerified': committed_count, 'discarded': removed,
                      'completeRoundsDeleted': 0, 'sourceRequests': 0, 'sessionBindingsChanged': 0,
                      'quotaChanges': 0, 'gatesRemainPaused': True,
                      'unknownBetAbandonedWithoutReplay': 0 if review == REVIEW else 1}
            if not apply:
                return result
            # Exclusive backup creation and audit insertion prevent blind reapplication.
            destination.mkdir(parents=True, mode=0o700)
            event = {'result': result, 'proof': proof, 'campaign': state, 'control': control,
                     'workers': workers, 'allocation': batches, 'batches': checked, 'at': clock()}
            backup_database(campaign.db, destination / 'queue.sqlite3')
            backup_database(pool.pool.db, destination / 'work-pool.sqlite3')
            for batch in batches:
                with open_review_store(root, plan, batch, mongo_factory, clock) as store:
                    assert_batch_binding(store,proof['batches'][str(batch['id'])])
                    directory = destination / 'batches' / str(store.batch['id'])
                    directory.mkdir(parents=True, mode=0o700)
                    backup_database(store.db, directory / 'state.sqlite3')
                    for name in ('raw.jsonl', 'rounds.jsonl'):
                        if (store.root / name).exists():
                            shutil.copyfile(store.root / name, directory / name)
                            (directory / name).chmod(0o600)
                            with (directory / name).open('r+b') as stream: os.fsync(stream.fileno())
                    sync_dir(directory)
            with (destination / 'event.json').open('xb') as stream:
                stream.write(canonical(event)); stream.flush(); os.fsync(stream.fileno())
            (destination / 'event.json').chmod(0o600)
            sync_dir(destination / 'batches'); sync_dir(destination); sync_dir(destination.parent)
            db = pool.pool.db
            db.execute('CREATE TABLE IF NOT EXISTS pending_discards(id TEXT PRIMARY KEY,payload TEXT NOT NULL,applied INTEGER NOT NULL DEFAULT 0)')
            db.execute('INSERT INTO pending_discards(id,payload) VALUES(?,?)', (review, canonical(event).decode()))
            for item in checked:
                if item['batch']['id'] not in targets: continue
                with open_review_store(root, plan, item['batch'], mongo_factory, clock) as store:
                    assert_batch_binding(store,proof['batches'][str(store.batch['id'])])
                    store.db.execute('BEGIN IMMEDIATE')
                    try:
                        store.db.execute('CREATE TABLE IF NOT EXISTS pending_discards(id TEXT PRIMARY KEY,payload TEXT NOT NULL)')
                        store.db.execute('INSERT INTO pending_discards VALUES(?,?)', (review, canonical(item).decode()))
                        store.db.execute('DELETE FROM timings WHERE sequence=?', (item['pending']['sequence'],))
                        store.db.execute('DELETE FROM pending WHERE sequence=?', (item['pending']['sequence'],))
                        store.db.execute("UPDATE trial SET status='pending',owner=NULL,lease_until=0,failure=NULL WHERE id=1")
                        store.db.execute('COMMIT')
                    except BaseException:
                        store.db.execute('ROLLBACK'); raise
                    require(store.pending() is None, 'DISCARD_PENDING_REMAINS')
            db.execute('UPDATE pending_discards SET applied=1 WHERE id=?', (review,))
            # Gate activation is a separate operator step after a fresh job check.
            return result
    finally:
        pool.close(); campaign.close()
