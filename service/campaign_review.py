"""Operator-only quarantine of unstarted games contradicted by saved evidence.

Keeps each game in phase one with its baseline and target unchanged. It does
not enable source requests, migrate plans, or make incomplete games complete.
"""
import json
import time
from store import require, digest, canonical, file_lock


def hold_unstarted(campaign, evidence, apply=False, clock=time.time):
    require(isinstance(evidence, dict) and evidence.get('schema')=='sg-feature-review-holds-v1',
            'HOLD_EVIDENCE_REQUIRED')
    require(evidence.get('campaignId')==campaign.config['campaignId'], 'HOLD_CAMPAIGN_MISMATCH')
    ids=evidence.get('gameIds')
    require(isinstance(ids,list) and ids and all(type(g) is int for g in ids)
            and ids==sorted(set(ids)), 'HOLD_GAME_IDS_REQUIRED')
    require(evidence.get('reason')=='UNSUPPORTED_NATURAL_FEATURE'
            and evidence.get('officialSourceRequests')==0 and evidence.get('databaseWrites')==0,
            'HOLD_EVIDENCE_REQUIRED')
    report_hash=evidence.get('coverageReportSHA256','')
    require(len(report_hash)==64 and all(c in '0123456789abcdef' for c in report_hash),
            'HOLD_EVIDENCE_REQUIRED')
    known={g['gameId']:g for g in campaign.config['games']}
    signature=digest(evidence)
    with file_lock(campaign.directory/'selection.lock'):
        control=campaign.db.execute('SELECT * FROM control WHERE id=1').fetchone()
        require(not control['enabled'], 'HOLD_CAMPAIGN_NOT_PAUSED')
        before=[]
        for gid in ids:
            require(gid in known and str(gid) in campaign.plans,'HOLD_GAME_NOT_PLANNED')
            require(control['active_game']!=gid, 'HOLD_ACTIVE_GAME_FORBIDDEN')
            plan=campaign.plans[str(gid)]
            # Even an empty previous trial directory needs separate review;
            # a allocated range must never be abandoned by a readiness change.
            require(not (campaign.root/'trials'/plan['trialId']).exists(), 'HOLD_STARTED_GAME_FORBIDDEN')
            state=campaign.db.execute('SELECT * FROM games WHERE game_id=?',(gid,)).fetchone()
            require(state and state['status'] in {'ready','needs-adapter'}, 'HOLD_GAME_NOT_READY')
            require(state['completed'] is None and state['confirmed']==state['baseline']
                    and state['baseline']==known[gid]['creditedHistoricalRounds'], 'HOLD_PROGRESS_CHANGED')
            before.append(dict(state))
        exists=campaign.db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='protocol_holds'").fetchone()
        recorded=campaign.db.execute('SELECT payload FROM protocol_holds WHERE id=?',(signature,)).fetchone() if exists else None
        if recorded:
            require(all(r['status']=='needs-adapter' for r in before), 'HOLD_STATE_CHANGED')
            return {**json.loads(recorded['payload'])['result'],'alreadyApplied':True}
        require(all(r['status']=='ready' for r in before), 'HOLD_UNREVIEWED_PRIOR_STATE')
        result={'evidenceHash':signature,'gameIds':ids,'applied':apply,'alreadyApplied':False,
                'targetChanges':0,'baselineChanges':0,'sessionChanges':0,'sourceRequests':0,
                'gamesRemainInPhaseOne':True}
        if apply:
            event={'evidence':evidence,'before':before,'at':clock(),'configHash':control['config_hash'],
                   'planHashes':{str(gid):digest(campaign.plans[str(gid)]) for gid in ids},'result':result}
            campaign.db.execute('BEGIN IMMEDIATE')
            try:
                campaign.db.execute('CREATE TABLE IF NOT EXISTS protocol_holds(id TEXT PRIMARY KEY,payload TEXT NOT NULL)')
                campaign.db.execute('INSERT INTO protocol_holds VALUES(?,?)',(signature,canonical(event).decode()))
                campaign.db.executemany("UPDATE games SET status='needs-adapter' WHERE game_id=? AND status='ready'",[(gid,) for gid in ids])
                campaign.db.execute('COMMIT')
            except BaseException:
                campaign.db.execute('ROLLBACK');raise
        return result
