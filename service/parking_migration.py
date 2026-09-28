"""Operator-only enablement: preserve both current protocol stops atomically.

Not exposed by RPC. The caller must check both GitHub repositories are idle
with timed collection disabled before preparing and applying this proof.
"""
from contextlib import ExitStack
from pathlib import Path
import time
from campaign import for_group
from protocol_parking import POLICY, enabled, inspect, backup, install_tables, commit_park, write, sha
from store import canonical, digest, file_lock, require

REVIEW='protocol-parking-32714-32717-v1'
BOUNDARIES={'primary':(32714,103,97,2),'secondary':(32717,244,228,1)}


def activate(root,backup_dir,proof=None,apply=False,clock=time.time):
    root=Path(root).resolve();dest=Path(backup_dir).resolve()
    require(dest.is_relative_to(root/'reviews') and dest!=root/'reviews','PARKING_BACKUP_PATH')
    with ExitStack() as locks:
        groups={}
        for group in BOUNDARIES:
            c=for_group(root,group,clock=clock);locks.callback(c.close);groups[group]=c
        c=groups['primary'];locks.enter_context(file_lock(c.directory/'selection.lock'))
        require(not enabled(c),'PARKING_ALREADY_INSTALLED')
        queue={name:[dict(r) for r in c.db.execute('SELECT * FROM '+name+' ORDER BY rowid')]
               for name in ('control','group_control','dispatch_control','games','game_owners')}
        require(queue['dispatch_control']==[{'id':1,'enabled':1,'reason':None}],'PARKING_GLOBAL_STOP')
        reviews={}
        for group,(gid,n,w,p) in BOUNDARIES.items():
            require(groups[group]._state()['active_game']==gid,'PARKING_ACTIVE_GAME_CHANGED')
            review=inspect(groups[group],locks);require(review is not None,'PARKING_ACTIVE_LEASE')
            s=review[0]
            require((s['complete'],s['committed'],len(s['pending']))==(n,w,p),'PARKING_BOUNDARY_CHANGED')
            reviews[group]=review
        code=digest({p.name:sha(p) for p in Path(__file__).parent.glob('*.py')})
        snapshot={'queue':queue,'games':{g:r[0] for g,r in reviews.items()},'codeHash':code,'policy':POLICY}
        prepared={'review':REVIEW,'createdAt':clock(),'stateHash':digest(snapshot),'codeHash':code}
        if not apply:return {**prepared,'applied':False}
        require(proof and proof.get('review')==REVIEW and 0<=clock()-proof.get('createdAt',0)<=300,'PARKING_PROOF_EXPIRED')
        require(proof.get('stateHash')==prepared['stateHash'] and proof.get('codeHash')==code,'PARKING_PROOF_CHANGED')
        dest.mkdir(parents=True,mode=0o700)
        results={g:backup(groups[g],r,dest/g) for g,r in reviews.items()}
        write(dest/'proof.json',canonical(proof))
        # Policy and both parked-game assignments share one durable transaction.
        # Before commit, both groups are still stopped. No trial DB is changed.
        c.db.execute('BEGIN IMMEDIATE')
        try:
            install_tables(c)
            for group,result in results.items():
                original=c.runner_group;c.runner_group=group
                try:commit_park(c,result)
                finally:c.runner_group=original
            c.db.execute('INSERT INTO parking_policy VALUES(1,?,?)',(canonical(POLICY).decode(),canonical(proof).decode()))
            c.db.execute('COMMIT')
        except BaseException:c.db.execute('ROLLBACK');raise
        result={**prepared,'applied':True,'proofHash':digest(proof),'games':results,
                'sourceRequests':0,'newSessions':0,'deletedRecords':0,'replayedBets':0}
        write(dest/'result.json',canonical(result));return result
