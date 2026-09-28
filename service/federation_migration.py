"""Paused, operator-only activation of the user's second twenty-runner group."""
from contextlib import ExitStack, closing
import json
import os
from pathlib import Path
import sqlite3
import time

from campaign import Campaign
from pending_discard import backup_database
from runner_federation import TOPOLOGY, topology_path
from store import canonical, digest, file_lock, require, sync_dir


def activate(root, backup_dir, expected_hash=None, apply=False, clock=time.time):
    root = Path(root).resolve()
    destination = Path(backup_dir).resolve()
    require(destination.is_relative_to(root/'reviews') and destination != root/'reviews', 'FEDERATION_BACKUP_PATH')
    manifest = topology_path(root)
    require(not manifest.exists(), 'FEDERATION_ALREADY_CONFIGURED')
    campaign = Campaign(root, clock=clock)
    pool = None
    try:
        with ExitStack() as locks:
            locks.enter_context(file_lock(campaign.directory/'selection.lock'))
            state = dict(campaign.db.execute('SELECT * FROM control').fetchone())
            require(not state['enabled'] and state['active_game'] is not None, 'FEDERATION_CAMPAIGN_NOT_PAUSED')
            require(campaign.disk_free() >= campaign.config['diskReserveBytes'], 'DISK_RESERVE_REACHED')
            plan = campaign.plans[str(state['active_game'])]
            directory = root/'trials'/plan['trialId']
            require((directory/'work-pool.sqlite3').exists(), 'FEDERATION_POOL_MISSING')
            locks.enter_context(file_lock(directory/'pool-init.lock'))
            locks.enter_context(file_lock(directory/'protocol-review.lock'))
            pool = sqlite3.connect(directory/'work-pool.sqlite3', isolation_level=None, timeout=30)
            pool.row_factory = sqlite3.Row
            pool.execute('PRAGMA synchronous=FULL')
            def rows(table):
                return [dict(row) for row in pool.execute('SELECT * FROM '+table+' ORDER BY id')]
            control, workers, batches = rows('control')[0], rows('workers'), rows('batches')
            require(not control['enabled'], 'FEDERATION_POOL_NOT_PAUSED')
            require(all(w['id'] < 20 and w['lease_until'] <= clock() for w in workers), 'FEDERATION_ACTIVE_WORKERS')
            pending_hashes = {}
            for batch in batches:
                path = directory/'batches'/str(batch['id'])/'state.sqlite3'
                if not path.exists():
                    continue
                with closing(sqlite3.connect(path.as_uri()+'?mode=ro', uri=True)) as reader:
                    reader.row_factory = sqlite3.Row
                    item = dict(reader.execute('SELECT * FROM trial WHERE id=1').fetchone())
                    require(item['lease_until'] <= clock(), 'FEDERATION_ACTIVE_BATCH')
                    pending = [dict(row) for row in reader.execute('SELECT * FROM pending')]
                    pending_hashes[str(batch['id'])] = digest({'state':item, 'pending':pending})
            snapshot = {'topology':TOPOLOGY, 'campaign':state, 'planHash':digest(plan),
                        'control':control, 'workers':workers, 'batches':batches, 'journals':pending_hashes}
            proof_hash = digest(snapshot)
            result = {'proofHash':proof_hash, 'applied':apply, 'workerCapacity':40,
                      'preservedWorkers':len(workers), 'preservedBatches':len(batches),
                      'planHash':digest(plan), 'sourceRequests':0, 'gatesRemainPaused':True}
            if not apply:
                return result
            require(expected_hash == proof_hash, 'FEDERATION_STATE_CHANGED')
            destination.mkdir(parents=True, mode=0o700)
            backup_database(campaign.db, destination/'queue.sqlite3')
            backup_database(pool, destination/'work-pool.sqlite3')
            with (destination/'event.json').open('xb') as stream:
                stream.write(canonical(snapshot)); stream.flush(); os.fsync(stream.fileno())
            (destination/'event.json').chmod(0o600)
            sync_dir(destination)
            # Rebuild only the ID constraint. Preserve every existing column,
            # lease, session binding, range, plan hash and pending journal.
            pool.execute('BEGIN IMMEDIATE')
            try:
                pool.execute('''CREATE TABLE workers_federated(
                  id INTEGER PRIMARY KEY CHECK(id>=0 AND id<40),
                  session_hash TEXT NOT NULL UNIQUE,owner TEXT NOT NULL,epoch INTEGER NOT NULL,
                  lease_until REAL NOT NULL,active_batch INTEGER,observed_rate REAL)''')
                pool.execute('INSERT INTO workers_federated SELECT * FROM workers')
                require([dict(r) for r in pool.execute('SELECT * FROM workers_federated ORDER BY id')]==workers,
                        'FEDERATION_COPY_MISMATCH')
                pool.execute('DROP TABLE workers')
                pool.execute('ALTER TABLE workers_federated RENAME TO workers')
                pool.execute('CREATE TABLE IF NOT EXISTS federation_events(proof_hash TEXT PRIMARY KEY, event TEXT NOT NULL)')
                pool.execute('INSERT INTO federation_events VALUES(?,?)', (proof_hash,canonical(result).decode()))
                pool.execute('COMMIT')
            except BaseException:
                pool.execute('ROLLBACK'); raise
            require(rows('workers')==workers and rows('batches')==batches and rows('control')[0]==control,
                    'FEDERATION_EXISTING_STATE_CHANGED')
            temporary = manifest.with_suffix('.preparing')
            with temporary.open('xb') as stream:
                stream.write(canonical(TOPOLOGY)); stream.flush(); os.fsync(stream.fileno())
            temporary.chmod(0o600)
            os.replace(temporary, manifest); sync_dir(manifest.parent)
            return result
    finally:
        if pool is not None:
            pool.close()
        campaign.close()
