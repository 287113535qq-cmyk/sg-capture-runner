"""Operator-only transition from the preserved primary pause to independent groups."""
from contextlib import ExitStack, closing
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import time
from campaign import Campaign
from group_campaign import POLICY
from pending_discard import backup_database
from runner_federation import TOPOLOGY, topology_path
from store import canonical, digest, file_lock, require, sync_dir


def activate(root, backup_dir, expected_hash=None, apply=False, clock=time.time):
    root=Path(root).resolve();destination=Path(backup_dir).resolve()
    require(destination.is_relative_to(root/'reviews') and destination!=root/'reviews','GROUP_BACKUP_PATH')
    require(json.loads(topology_path(root).read_text())==TOPOLOGY,'GROUP_FEDERATION_REQUIRED')
    campaign=Campaign(root,clock=clock)
    try:
        with ExitStack() as locks:
            locks.enter_context(file_lock(campaign.directory/'selection.lock'))
            require(not campaign.db.execute("SELECT 1 FROM sqlite_master WHERE name='group_control'").fetchone(),
                    'GROUP_MIGRATION_ALREADY_PREPARED')
            state=dict(campaign._state())
            require(not state['enabled'] and state['active_game']==32714 and
                    state['reason']=='ACTIVE_GAME_REQUIRES_REVIEW','GROUP_PAUSE_PROFILE_REQUIRED')
            require(campaign.disk_free()>=campaign.config['diskReserveBytes'],'DISK_RESERVE_REACHED')
            tables={r[0]:[tuple(v) for v in campaign.db.execute('SELECT * FROM "'+r[0]+'" ORDER BY rowid')]
                    for r in campaign.db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()}
            plan=campaign.plans['32714'];directory=root/'trials'/plan['trialId']
            locks.enter_context(file_lock(directory/'pool-init.lock'))
            locks.enter_context(file_lock(directory/'protocol-review.lock'))
            pool=locks.enter_context(closing(sqlite3.connect(directory/'work-pool.sqlite3',isolation_level=None)))
            pool.row_factory=sqlite3.Row
            pool_state=dict(pool.execute('SELECT * FROM control').fetchone())
            require(not pool_state['enabled'] and pool_state['failure']=='BATCH_HALTED','GROUP_POOL_PAUSE_REQUIRED')
            workers=[dict(r) for r in pool.execute('SELECT * FROM workers ORDER BY id')]
            require(all(w['lease_until']<=clock() and w['id']<20 for w in workers),'GROUP_ACTIVE_WORKERS')
            databases={'queue.sqlite3':campaign.db,'trial/work-pool.sqlite3':pool}
            raw_files={};journals={};pending_count=0;complete_count=0
            for batch in pool.execute('SELECT * FROM batches ORDER BY id'):
                batch_dir=directory/'batches'/str(batch['id'])
                path=batch_dir/'state.sqlite3'
                if not path.exists():continue
                locks.enter_context(file_lock(batch_dir/'trial.lock'))
                db=locks.enter_context(closing(sqlite3.connect(path.as_uri()+'?mode=ro',uri=True)))
                db.row_factory=sqlite3.Row
                row=dict(db.execute('SELECT * FROM trial').fetchone())
                require(row['lease_until']<=clock(),'GROUP_ACTIVE_BATCH')
                pending=[dict(r) for r in db.execute('SELECT * FROM pending')]
                require(all(r['awaiting'] is None for r in pending),'GROUP_UNKNOWN_OUTCOME')
                pending_count+=len(pending);complete_count+=db.execute('SELECT COUNT(*) FROM receipts').fetchone()[0]
                journals[str(batch['id'])]={t:[dict(r) for r in db.execute('SELECT * FROM '+t+' ORDER BY rowid')]
                                          for t in ('trial','pending','receipts')}
                databases['trial/batches/'+str(batch['id'])+'/state.sqlite3']=db
            require(pending_count==1 and complete_count==2,'GROUP_REVIEW_BOUNDARY_CHANGED')
            for path in directory.rglob('*'):
                if path.is_file() and not path.name.endswith(('.lock','.sqlite3','.sqlite3-wal','.sqlite3-shm')):
                    raw_files[str(path.relative_to(directory))]=hashlib.sha256(path.read_bytes()).hexdigest()
            snapshot={'policy':POLICY,'queue':tables,'planHash':digest(plan),'pool':pool_state,'workers':workers,
                      'batches':[dict(r) for r in pool.execute('SELECT * FROM batches ORDER BY id')],
                      'journals':journals,'files':raw_files}
            proof=digest(snapshot)
            result={'proofHash':proof,'applied':apply,'primaryGame':32714,'primaryPaused':True,
                    'secondaryEnabled':False,'sourceRequests':0,'retainedComplete':complete_count,'retainedPending':pending_count}
            if not apply:return result
            require(expected_hash==proof,'GROUP_STATE_CHANGED')
            destination.mkdir(parents=True,mode=0o700)
            for name,db in databases.items():
                path=destination/name;path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
                backup_database(db,path)
            for name in raw_files:
                path=destination/'trial'/name;path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
                with path.open('xb') as out:out.write((directory/name).read_bytes());out.flush();os.fsync(out.fileno())
                path.chmod(0o600)
            with (destination/'event.json').open('xb') as out:
                out.write(canonical(snapshot));out.flush();os.fsync(out.fileno())
            (destination/'event.json').chmod(0o600);sync_dir(destination)
            campaign.db.execute('BEGIN IMMEDIATE')
            try:
                campaign.db.execute('''CREATE TABLE group_control(name TEXT PRIMARY KEY,
                    enabled INTEGER NOT NULL DEFAULT 0,active_game INTEGER UNIQUE,reason TEXT,
                    audit_owner TEXT,audit_until REAL NOT NULL DEFAULT 0,config_hash TEXT NOT NULL)''')
                campaign.db.execute('INSERT INTO group_control VALUES(?,?,?,?,?,?,?)',
                    ('primary',0,state['active_game'],state['reason'],state['audit_owner'],state['audit_until'],state['config_hash']))
                campaign.db.execute('INSERT INTO group_control VALUES(?,?,?,?,?,?,?)',
                    ('secondary',0,None,None,None,0,state['config_hash']))
                campaign.db.execute('CREATE TABLE dispatch_control(id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL,reason TEXT)')
                campaign.db.execute('INSERT INTO dispatch_control VALUES(1,1,NULL)')
                campaign.db.execute('CREATE TABLE game_owners(game_id INTEGER PRIMARY KEY,group_name TEXT NOT NULL)')
                campaign.db.execute("INSERT INTO game_owners SELECT game_id,'primary' FROM games WHERE status IN ('complete','active')")
                campaign.db.execute('CREATE TABLE group_migrations(proof_hash TEXT PRIMARY KEY,result TEXT NOT NULL)')
                campaign.db.execute('INSERT INTO group_migrations VALUES(?,?)',(proof,canonical(result).decode()))
                campaign.db.execute('COMMIT')
            except BaseException:
                campaign.db.execute('ROLLBACK');raise
            path=campaign.directory/'independent-groups.json'
            temporary=path.with_suffix('.preparing')
            with temporary.open('xb') as out:out.write(canonical(POLICY));out.flush();os.fsync(out.fileno())
            temporary.chmod(0o600);os.replace(temporary,path);sync_dir(path.parent)
            with (destination/'result.json').open('xb') as out:out.write(canonical(result));out.flush();os.fsync(out.fileno())
            return result
    finally:campaign.close()
