"""One whitelisted 300k demo trial. Durable intent -> frame -> files -> Mongo -> checkpoint."""
import json
import re
import sqlite3
import time
from pathlib import Path
from store import Store, require, canonical, digest, file_lock, Rejected, OWNER
from trial_fields import settled, frame, request_params, SOURCE
from round_fields import FieldError, VERSION

PLAN = json.loads((Path(__file__).resolve().parents[1] / 'config/trial-300k.json').read_text(encoding='utf-8'))
SCHEMA = PLAN['schema']
TRIAL = PLAN['trialId']

class TrialStore:
    def __init__(self, root, mongo, clock=time.time, shard=None, source_allowed=None, plan=None, batch=None):
        if plan is not None:
            from pool_plan import validate_pool_plan
            plan = validate_pool_plan(plan)
        self.plan = PLAN if plan is None else plan
        self.trial, self.schema = self.plan['trialId'], self.plan['schema']
        self.root = Path(root).resolve() / 'trials' / self.trial
        self.batch = batch
        if batch is not None:
            require(plan is not None and shard is None and type(batch['id']) is int and batch['id'] > 0, 'BAD_BATCH')
            shard = {'id': batch['worker'], 'start': batch['start'], 'end': batch['end']}
        self.shard = shard
        self.base = shard['start']-1 if shard else 0
        self.target = shard['end'] if shard else self.plan['target']
        self.source_allowed = source_allowed or (lambda: True)
        if shard:
            require(type(shard['id']) is int and 0 <= shard['id'] < 20
                    and 0 <= self.base < self.target <= self.plan['target'], 'BAD_SHARD')
            self.root = self.root / ('batches' if batch else 'shards') / str(batch['id'] if batch else shard['id'])
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.mongo = mongo
        self.clock = clock
        self.writer = Store(self.root, mongo, clock)
        self.db = sqlite3.connect(self.root / 'state.sqlite3', isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS trial(id INTEGER PRIMARY KEY CHECK(id=1), plan_hash TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending', owner TEXT, epoch INTEGER NOT NULL DEFAULT 0,
          lease_until REAL NOT NULL DEFAULT 0, heartbeat REAL NOT NULL DEFAULT 0, session_hash TEXT,
          durable INTEGER NOT NULL DEFAULT 0, checkpoint INTEGER NOT NULL DEFAULT 0,
          raw_offset INTEGER NOT NULL DEFAULT 0, norm_offset INTEGER NOT NULL DEFAULT 0,
          cooldown_until REAL NOT NULL DEFAULT 0, failure TEXT, created REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS pending(id INTEGER PRIMARY KEY CHECK(id=1), sequence INTEGER NOT NULL,
          attempt TEXT NOT NULL, raw TEXT NOT NULL, awaiting TEXT);
        CREATE TABLE IF NOT EXISTS receipts(sequence INTEGER PRIMARY KEY, id TEXT UNIQUE NOT NULL,
          payload TEXT NOT NULL, hash TEXT NOT NULL, raw_offset INTEGER NOT NULL, norm_offset INTEGER NOT NULL,
          filed INTEGER NOT NULL DEFAULT 0, committed INTEGER NOT NULL DEFAULT 0,
          stake INTEGER NOT NULL, win INTEGER NOT NULL, bonus INTEGER NOT NULL, frames INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS timings(sequence INTEGER NOT NULL, step INTEGER NOT NULL, ms INTEGER NOT NULL,
          PRIMARY KEY(sequence,step));
        CREATE TABLE IF NOT EXISTS runs(owner TEXT PRIMARY KEY, started REAL NOT NULL, ended REAL,
          start_checkpoint INTEGER NOT NULL, end_checkpoint INTEGER, commit_sha TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS trial_unfiled ON receipts(sequence) WHERE filed=0;
        CREATE INDEX IF NOT EXISTS trial_uncommitted ON receipts(sequence) WHERE filed=1 AND committed=0;
        CREATE TABLE IF NOT EXISTS runner_elections(run_id TEXT PRIMARY KEY,closes REAL NOT NULL,winner INTEGER);
        CREATE TABLE IF NOT EXISTS runner_candidates(run_id TEXT NOT NULL,candidate INTEGER NOT NULL,network_ms REAL NOT NULL,
          PRIMARY KEY(run_id,candidate));
        ''')
        plan_hash = digest({'plan':self.plan,'batch':batch}) if batch else digest({'plan':self.plan,'shard':shard}) if shard else digest(self.plan)
        row = self.db.execute('SELECT * FROM trial WHERE id=1').fetchone()
        if row:
            require(row['plan_hash'] == plan_hash, 'TRIAL_PLAN_CHANGED')
        else:
            self.db.execute('INSERT OR IGNORE INTO trial(id,plan_hash,created,durable,checkpoint) VALUES(1,?,?,?,?)',
                            (plan_hash,clock(),self.base,self.base))

    def close(self):
        self.db.close()
        if hasattr(self.mongo,'close'):
            self.mongo.close()

    def state(self):
        return self.db.execute('SELECT * FROM trial WHERE id=1').fetchone()

    def pending(self):
        row = self.db.execute('SELECT * FROM pending WHERE id=1').fetchone()
        return None if row is None else {**dict(row), 'raw': json.loads(row['raw'])}

    def owned(self, req):
        s = self.state()
        require(s['status'] == 'claimed' and s['owner'] == req.get('owner') and s['epoch'] == req.get('epoch')
                and s['lease_until'] > self.clock(), 'LEASE_LOST')
        if self.clock() - s['heartbeat'] > 30:
            self.db.execute('UPDATE trial SET heartbeat=?,lease_until=? WHERE id=1', (self.clock(), self.clock()+600))
        return self.state()

    def dispatch(self, req):
        require(isinstance(req, dict) and req.get('schema') == self.schema and req.get('trialId') == self.trial, 'TRIAL_NOT_ALLOWED')
        require(len(canonical(req)) <= 1048576, 'REQUEST_TOO_LARGE')
        op = req.get('op')
        require(op in {'status','claim','begin','intent','frame','exchange','exchange_journal','flush','release','fail','audit','ping','runner_register','runner_select'}, 'OP_NOT_ALLOWED')
        started = time.perf_counter()
        with file_lock(self.root / 'trial.lock'):
            result = getattr(self, '_' + op)(req)
        return {'ok': True, 'schema': self.schema, 'fixtureOnly': False,
                'serverWorkMs': round((time.perf_counter()-started)*1000,3), **result}

    def _ping(self, req):
        return {'pong': True}

    def _candidate(self, req):
        run, candidate = req.get('runId'), req.get('candidate')
        require(isinstance(run,str) and re.fullmatch('[0-9]{1,20}',run), 'BAD_RUN_ID')
        require(type(candidate) is int and 0 <= candidate < 20, 'BAD_CANDIDATE')
        return run, candidate

    def _probe_available(self):
        s = self.state()
        return s['cooldown_until'] <= self.clock() and (s['status']=='pending' or s['status']=='claimed' and s['lease_until'] <= self.clock())

    def _runner_register(self, req):
        run, candidate = self._candidate(req)
        ms = req.get('networkMs')
        require(type(ms) in (int,float) and 0 <= ms <= 10000, 'BAD_PROBE_TIMING')
        if not self._probe_available():
            return {'eligible':False,'trialStatus':self.state()['status']}
        now = self.clock()
        self.db.execute('INSERT OR IGNORE INTO runner_elections(run_id,closes) VALUES(?,?)',(run,now+45))
        election = self.db.execute('SELECT * FROM runner_elections WHERE run_id=?',(run,)).fetchone()
        if election['winner'] is not None or now >= election['closes']:
            return {'eligible':False,'reason':'ELECTION_CLOSED'}
        self.db.execute('INSERT OR IGNORE INTO runner_candidates(run_id,candidate,network_ms) VALUES(?,?,?)',(run,candidate,ms))
        return {'eligible':True,'waitMs':max(0,round((election['closes']-self.clock())*1000))}

    def _runner_select(self, req):
        run, candidate = self._candidate(req)
        election = self.db.execute('SELECT * FROM runner_elections WHERE run_id=?',(run,)).fetchone()
        require(election is not None and self.db.execute('SELECT 1 FROM runner_candidates WHERE run_id=? AND candidate=?',(run,candidate)).fetchone(), 'UNREGISTERED_CANDIDATE')
        if self.clock() < election['closes']:
            return {'ready':False,'waitMs':max(0,round((election['closes']-self.clock())*1000))}
        if not self._probe_available():
            return {'ready':True,'selected':False,'trialStatus':self.state()['status']}
        if election['winner'] is None:
            winner = self.db.execute('SELECT candidate FROM runner_candidates WHERE run_id=? ORDER BY network_ms,candidate LIMIT 1',(run,)).fetchone()[0]
            self.db.execute('UPDATE runner_elections SET winner=? WHERE run_id=? AND winner IS NULL',(winner,run))
        winner = self.db.execute('''SELECT c.candidate,c.network_ms FROM runner_elections e JOIN runner_candidates c
          ON c.run_id=e.run_id AND c.candidate=e.winner WHERE e.run_id=?''',(run,)).fetchone()
        return {'ready':True,'selected':candidate==winner['candidate'],'winner':winner['candidate'],
                'winnerNetworkMs':winner['network_ms'],
                'candidates':self.db.execute('SELECT COUNT(*) FROM runner_candidates WHERE run_id=?',(run,)).fetchone()[0]}

    def _exchange(self, req):
        # Confirm the current response and prepare the following intent in one
        # network round trip. The source request still waits for durable ack.
        result = self._frame(req)
        following = req.get('following')
        if following is not None:
            require(isinstance(following,dict), 'BAD_FOLLOWING_INTENT')
            own = {'owner':req.get('owner'),'epoch':req.get('epoch')}
            if result['complete']:
                require(following.get('sequence') == req['sequence']+1
                        and following.get('startBalanceRaw') == result['endBalanceRaw'], 'FOLLOWING_ROUND_MISMATCH')
                self._begin({**following, **own})
            else:
                require(following.get('sequence') == req['sequence'], 'FOLLOWING_ROUND_MISMATCH')
                self._intent({**following, **own})
            result['followingIntentDurable'] = True
        return result

    def journaled(self):
        return self.db.execute('SELECT COALESCE(MAX(sequence),?) FROM receipts',(self.base,)).fetchone()[0]

    def _following(self, req, result):
        following = req.get('following')
        if following is None:
            return
        if not self.source_allowed():
            result['stopRequested'] = True
            return
        require(isinstance(following,dict), 'BAD_FOLLOWING_INTENT')
        own = {'owner':req.get('owner'),'epoch':req.get('epoch')}
        if result['complete']:
            require(following.get('sequence') == req['sequence']+1
                    and following.get('startBalanceRaw') == result['endBalanceRaw'], 'FOLLOWING_ROUND_MISMATCH')
            if self.db.execute("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='trial_maintenance_before_bet'").fetchone():
                result['stopRequested'] = True
                return
            self._begin({**following, **own})
        else:
            require(following.get('sequence') == req['sequence'], 'FOLLOWING_ROUND_MISMATCH')
            self._intent({**following, **own})
        result['followingIntentDurable'] = True

    def _exchange_journal(self, req):
        # The received response is FULL-synchronous before analysis or any next
        # intent. JSONL export may lag the durable journal by at most one batch;
        # checkpoint still requires fsynced files and full Mongo readback.
        pending, remaining, fields = self._receive(req)
        if remaining:
            result = {'complete':False, 'remaining':remaining}
            self._following(req,result)
            return result
        result = {'complete':True, 'journaled':req['sequence'],
                  'endBalanceRaw':fields['money']['endBalanceRaw']}
        flush = req['sequence']-self.state()['durable'] >= self.plan['mongoBatchSize'] or req['sequence'] == self.target
        self.db.execute('BEGIN IMMEDIATE')
        try:
            self._stage(req,pending,fields)
            self.db.execute('DELETE FROM pending WHERE sequence=?',(req['sequence'],))
            if not flush:
                self._following(req,result)
            self.db.execute('COMMIT')
        except BaseException:
            self.db.execute('ROLLBACK')
            raise
        if flush:
            # Do not arm a next request before a potentially failing Mongo ack.
            self._flush(req)
            self._following(req,result)
        result.update(durable=self.state()['durable'],checkpoint=self.state()['checkpoint'])
        return result

    def _status(self, req):
        s = self.state()
        stats = dict(self.db.execute('''SELECT COUNT(*) AS count, COALESCE(SUM(stake),0) AS stakeRaw,
          COALESCE(SUM(win),0) AS winRaw, COALESCE(SUM(frames),0) AS sourceFrames,
          COALESCE(SUM(bonus>0),0) AS freeRounds, COALESCE(SUM(win=0),0) AS zeroWinRounds,
          COALESCE(MAX(1.0*win/stake),0) AS maxMul FROM receipts WHERE committed=1''').fetchone())
        pending = self.pending()
        return {'trialId': self.trial, 'gameId': 32471, 'runtimeGameId': 33026, 'target': self.target,
                'sequenceBase':self.base, **({'shardId':self.shard['id']} if self.shard else {}),
                'status': s['status'], 'journaled': self.journaled(), 'durable': s['durable'], 'checkpoint': s['checkpoint'],
                'epoch': s['epoch'], 'leaseUntil': s['lease_until'], 'cooldownUntil': s['cooldown_until'],
                'failure': s['failure'], 'pending': None if pending is None else {
                    'sequence': pending['sequence'], 'frames': len(pending['raw']['steps']),
                    'awaitingResponse': pending['awaiting'] is not None}, 'statistics': stats}

    def _claim(self, req):
        require(self.source_allowed(), 'GLOBAL_SOURCE_STOPPED')
        s = self.state()
        require(s['status'] not in {'complete','halted'}, 'TRIAL_' + s['status'].upper())
        require(s['status'] != 'claimed' or s['lease_until'] <= self.clock(), 'GAME_BUSY')
        require(s['cooldown_until'] <= self.clock(), 'COOLDOWN_ACTIVE')
        owner, fingerprint, sha = req.get('owner',''), req.get('sessionHash',''), req.get('commitSha','')
        require(isinstance(owner,str) and OWNER.fullmatch(owner), 'BAD_OWNER')
        require(isinstance(fingerprint,str) and re.fullmatch('[a-f0-9]{64}', fingerprint), 'BAD_SESSION_HASH')
        require(isinstance(sha,str) and re.fullmatch('[a-f0-9]{40}', sha), 'BAD_COMMIT_SHA')
        require(not self.db.execute('SELECT 1 FROM runs WHERE owner=?',(owner,)).fetchone(), 'OWNER_ALREADY_USED')
        require(s['session_hash'] is None or s['session_hash'] == fingerprint, 'TRIAL_SESSION_CHANGED')
        pending = self.pending()
        # An official request with no durably recorded response must not be retried.
        if pending and pending['awaiting'] is not None:
            self.db.execute("UPDATE trial SET status='halted',failure='SOURCE_OUTCOME_UNKNOWN' WHERE id=1")
            raise Rejected('SOURCE_OUTCOME_UNKNOWN')
        now, epoch = self.clock(), s['epoch'] + 1
        self.db.execute('UPDATE runs SET ended=? WHERE ended IS NULL', (min(now, s['lease_until']),))
        self.db.execute("UPDATE trial SET status='claimed',owner=?,epoch=?,lease_until=?,heartbeat=?,session_hash=?,failure=NULL WHERE id=1",
                        (owner,epoch,now+600,now,fingerprint))
        self.db.execute('INSERT INTO runs(owner,started,start_checkpoint,commit_sha) VALUES(?,?,?,?)', (owner,now,s['checkpoint'],sha))
        owned = {**req, 'epoch': epoch}
        self.mongo.ensure()
        self._recover_response(owned)
        self._flush(owned)
        # This is private RPC data, never emitted in workflow logs.
        return {'epoch': epoch, 'checkpoint': self.state()['checkpoint'], 'durable': self.state()['durable'],
                'sequenceBase':self.base,'sequenceTarget':self.target,'pendingRound': self.pending()}

    def _begin(self, req):
        require(self.source_allowed(), 'GLOBAL_SOURCE_STOPPED')
        s = self.owned(req)
        journaled = self.journaled()
        require(journaled < self.target and not self.pending(), 'ROUND_ALREADY_PENDING')
        require(req.get('sequence') == journaled + 1, 'SEQUENCE_GAP')
        require(type(req.get('startBalanceRaw')) is int and req['startBalanceRaw'] >= 25, 'BAD_START_BALANCE')
        attempt = req.get('attempt','')
        require(isinstance(attempt,str) and re.fullmatch('[a-f0-9-]{36}',attempt), 'BAD_ATTEMPT')
        request_params(req.get('requestPayload'), 'BET')
        raw = {'fixtureOnly':False, 'protocol':'nextgen','sourceKey':SOURCE,'roundFieldsVersion':VERSION,
               'startBalanceRaw':req['startBalanceRaw'], 'steps':[]}
        self.db.execute('INSERT INTO pending(id,sequence,attempt,raw,awaiting) VALUES(1,?,?,?,?)',
                        (req['sequence'],attempt,canonical(raw).decode(),req['requestPayload']))
        return {'sequence':req['sequence'], 'intentDurable':True}

    def _intent(self, req):
        require(self.source_allowed(), 'GLOBAL_SOURCE_STOPPED')
        self.owned(req)
        p = self.pending()
        require(p and req.get('sequence') == p['sequence'] and p['awaiting'] is None, 'PENDING_STATE_MISMATCH')
        require(len(p['raw']['steps']) < self.plan['maxSteps'], 'ROUND_STEP_LIMIT')
        require(frame(p['raw']['steps'][-1]) > 0, 'ROUND_ALREADY_SETTLED')
        request_params(req.get('requestPayload'), 'FREE_GAME')
        self.db.execute('UPDATE pending SET awaiting=? WHERE id=1', (req['requestPayload'],))
        return {'intentDurable':True}

    def _receive(self, req):
        self.owned(req)
        p, step = self.pending(), req.get('step')
        require(p and req.get('sequence') == p['sequence'] and isinstance(step,dict), 'PENDING_STATE_MISMATCH')
        require(step.get('requestPayload') == p['awaiting'] and p['awaiting'] is not None, 'FRAME_INTENT_MISMATCH')
        require(step.get('msgId') == ('BET' if not p['raw']['steps'] else 'FREE_GAME'), 'TRIAL_MESSAGE_NOT_ALLOWED')
        raw = p['raw']
        raw['steps'].append(step)
        # Preserve official response even if subsequent protocol analysis rejects it.
        self.db.execute('UPDATE pending SET raw=?,awaiting=NULL WHERE id=1', (canonical(raw).decode(),))
        try:
            remaining = frame(step)
            if remaining:
                return p, remaining, None
            fields = settled(raw)
            require(req.get('normalized') == fields, 'RUNNER_SERVER_FIELDS_MISMATCH')
        except (FieldError, Rejected, ValueError, TypeError, KeyError):
            self.db.execute("UPDATE trial SET status='halted',failure='PROTOCOL_VALIDATION_FAILED' WHERE id=1")
            raise Rejected('PROTOCOL_VALIDATION_FAILED') from None
        return p, remaining, fields

    def _frame(self, req):
        p, remaining, fields = self._receive(req)
        if remaining:
            return {'complete':False, 'remaining':remaining}
        self._stage(req, p, fields)
        self._recover_files(req)
        if self.state()['durable'] - self.state()['checkpoint'] >= self.plan['mongoBatchSize']:
            self._flush(req)
        return {'complete':True,'durable':self.state()['durable'],'checkpoint':self.state()['checkpoint'],
                'endBalanceRaw':fields['money']['endBalanceRaw']}

    def _stage(self, req, p, fields):
        raw, seq = p['raw'], p['sequence']
        identity = {'trialId':self.trial,'gameId':32471,'runtimeGameId':33026,'sequence':seq,'attempt':p['attempt']}
        record = {'_id':digest(identity), **identity, 'fixtureOnly':False, 'sourceRoundIdentity':'collector-operation',
                  'sourceSessionHash':self.state()['session_hash'], 'raw':raw, 'normalized':fields,
                  **{k:fields[k] for k in ('bet','mul','buy','bonus','roundFieldsVersion')}}
        if self.shard:
            record['shardId'] = self.shard['id']
        if self.batch:
            record['batchId'] = self.batch['id']
        record['rawHash'], record['normalizedHash'] = digest(raw), digest(fields)
        record['contentHash'] = digest(record)
        s = self.state()
        raw_offset, norm_offset = s['raw_offset'], s['norm_offset']
        tail = self.db.execute('SELECT payload,raw_offset,norm_offset FROM receipts WHERE filed=0 ORDER BY sequence DESC LIMIT 1').fetchone()
        if tail:
            rawline, normline = self._file_lines(json.loads(tail['payload']))
            raw_offset, norm_offset = tail['raw_offset']+len(rawline), tail['norm_offset']+len(normline)
        self.db.execute('INSERT INTO receipts(sequence,id,payload,hash,raw_offset,norm_offset,stake,win,bonus,frames) VALUES(?,?,?,?,?,?,?,?,?,?)',
            (seq,record['_id'],canonical(record).decode(),record['contentHash'],raw_offset,norm_offset,
             fields['money']['betRaw'],fields['money']['totalWinRaw'],fields['bonus'],len(raw['steps'])))
    def _recover_response(self, req):
        p = self.pending()
        if not p or not p['raw']['steps'] or self.db.execute('SELECT 1 FROM receipts WHERE sequence=?',(p['sequence'],)).fetchone():
            return
        try:
            if frame(p['raw']['steps'][-1]) == 0:
                self._stage(req,p,settled(p['raw']))
        except (FieldError,ValueError,TypeError,KeyError):
            self.db.execute("UPDATE trial SET status='halted',failure='PROTOCOL_VALIDATION_FAILED' WHERE id=1")
            raise Rejected('PROTOCOL_VALIDATION_FAILED') from None

    @staticmethod
    def _file_lines(record):
        raw = canonical({'_id':record['_id'],'contentHash':record['contentHash'],'rawHash':record['rawHash'],'raw':record['raw']}) + b'\n'
        norm = canonical({k:v for k,v in record.items() if k != 'raw'}) + b'\n'
        return raw, norm

    def _recover_files(self, req):
        while True:
            rows = self.db.execute('SELECT * FROM receipts WHERE filed=0 ORDER BY sequence LIMIT 100').fetchall()
            if not rows:
                break
            self.owned(req)
            s = self.state()
            raw_offset, norm_offset = s['raw_offset'], s['norm_offset']
            rawlines, normlines, timings = [], [], []
            for i,row in enumerate(rows):
                require(row['sequence'] == s['durable']+i+1, 'DURABLE_SEQUENCE_GAP')
                require(row['raw_offset']==raw_offset and row['norm_offset']==norm_offset, 'DURABLE_OFFSET_CONFLICT')
                record = json.loads(row['payload'])
                raw, norm = self._file_lines(record)
                rawlines.append(raw);normlines.append(norm)
                raw_offset += len(raw);norm_offset += len(norm)
                timings.extend((row['sequence'],i,step['elapsedMs']) for i,step in enumerate(record['raw']['steps']))
            self.writer._append_exact(self.root/'raw.jsonl', s['raw_offset'], b''.join(rawlines))
            self.writer._append_exact(self.root/'rounds.jsonl', s['norm_offset'], b''.join(normlines))
            self.db.execute('BEGIN IMMEDIATE')
            try:
                self.db.executemany('UPDATE receipts SET filed=1 WHERE sequence=?',[(row['sequence'],) for row in rows])
                self.db.execute('UPDATE trial SET durable=?,raw_offset=?,norm_offset=? WHERE id=1',
                    (rows[-1]['sequence'],raw_offset,norm_offset))
                self.db.executemany('INSERT OR IGNORE INTO timings(sequence,step,ms) VALUES(?,?,?)',timings)
                self.db.executemany('DELETE FROM pending WHERE sequence=?',[(row['sequence'],) for row in rows])
                self.db.execute('COMMIT')
            except BaseException:
                self.db.execute('ROLLBACK')
                raise

    def _flush(self, req):
        self.owned(req)
        self._recover_files(req)
        inserted = 0
        while True:
            rows = self.db.execute('SELECT * FROM receipts WHERE filed=1 AND committed=0 ORDER BY sequence LIMIT 100').fetchall()
            if not rows:
                break
            self.owned(req)
            require(rows[0]['sequence'] == self.state()['checkpoint']+1, 'CHECKPOINT_ORDER_CONFLICT')
            inserted += self.mongo.put([json.loads(r['payload']) for r in rows])
            self.owned(req)  # Fence again after Mongo's durable acknowledgement.
            self.db.execute('BEGIN IMMEDIATE')
            try:
                self.db.executemany('UPDATE receipts SET committed=1 WHERE sequence=?',[(r['sequence'],) for r in rows])
                self.db.execute('UPDATE trial SET checkpoint=? WHERE id=1',(rows[-1]['sequence'],))
                self.db.execute('COMMIT')
            except BaseException:
                self.db.execute('ROLLBACK')
                raise
        return {'checkpoint':self.state()['checkpoint'],'mongoInserted':inserted}

    def _release(self, req):
        self.owned(req)
        require(not self.pending(), 'ROUND_PENDING')
        self._flush(req)
        s = self.state()
        status = 'complete' if s['checkpoint'] == self.target else 'pending'
        self.db.execute('UPDATE runs SET ended=?,end_checkpoint=? WHERE owner=?',(self.clock(),s['checkpoint'],req['owner']))
        self.db.execute('UPDATE trial SET status=?,owner=NULL,lease_until=0 WHERE id=1',(status,))
        return self._status(req)

    def _fail(self, req):
        self.owned(req)
        category = req.get('category')
        require(category in {'source_http','source_network','source_protocol','storage','runner_stop'}, 'BAD_FAILURE_CATEGORY')
        until = req.get('cooldownUntil',0)
        require(type(until) in (int,float) and 0 <= until < 1e12, 'BAD_COOLDOWN')
        pending = self.pending()
        status = 'pending' if category == 'storage' and (not pending or pending['awaiting'] is None) else 'halted'
        self.db.execute('UPDATE trial SET status=?,owner=NULL,lease_until=0,failure=?,cooldown_until=MAX(cooldown_until,?) WHERE id=1',(status,category,until))
        self.db.execute('UPDATE runs SET ended=?,end_checkpoint=? WHERE owner=?',(self.clock(),self.state()['checkpoint'],req['owner']))
        return self._status(req)

    def _audit(self, req):
        s = self.state()
        require(s['status'] != 'claimed' and self.journaled() == s['durable'] == s['checkpoint'] and not self.pending(), 'TRIAL_NOT_QUIESCENT')
        count = 0
        verify_batch = []
        if self.batch:
            require(callable(getattr(self.mongo,'verify',None)), 'FULL_MONGO_VERIFICATION_REQUIRED')
        if s['checkpoint'] > self.base:
            with (self.root/'raw.jsonl').open('rb') as rf, (self.root/'rounds.jsonl').open('rb') as nf:
                for row in self.db.execute('SELECT * FROM receipts ORDER BY sequence'):
                    record = json.loads(row['payload'])
                    require(row['committed'] == 1 and row['sequence'] == self.base+count+1, 'AUDIT_SEQUENCE_MISMATCH')
                    rawline, normline = rf.readline(), nf.readline()
                    require(rawline.endswith(b'\n') and normline.endswith(b'\n'), 'PARTIAL_JSONL')
                    require(json.loads(rawline) == {'_id':record['_id'],'contentHash':record['contentHash'],'rawHash':record['rawHash'],'raw':record['raw']}, 'AUDIT_RAW_MISMATCH')
                    require(json.loads(normline) == {k:v for k,v in record.items() if k!='raw'}, 'AUDIT_NORMALIZED_MISMATCH')
                    require(settled(record['raw']) == record['normalized'] and digest(record['raw']) == record['rawHash'], 'AUDIT_FIELDS_MISMATCH')
                    if self.batch:
                        require(record['contentHash'] == digest({k:v for k,v in record.items() if k!='contentHash'})
                            and record['normalizedHash'] == digest(record['normalized'])
                            and all(record[k] == record['normalized'][k] for k in ('bet','mul','buy','bonus')), 'AUDIT_CONTENT_HASH')
                        verify_batch.append(record)
                        if len(verify_batch) == 100:
                            require(self.mongo.verify(verify_batch) == len(verify_batch), 'AUDIT_MONGO_CONTENT')
                            verify_batch = []
                    count += 1
                require(not rf.read(1) and not nf.read(1), 'AUDIT_EXTRA_DATA')
        require(count == s['checkpoint']-self.base, 'AUDIT_COUNT_MISMATCH')
        if verify_batch:
            require(self.mongo.verify(verify_batch) == len(verify_batch), 'AUDIT_MONGO_CONTENT')
        mongo = self.mongo.summary()
        stats = self._status(req)['statistics']
        require(all(mongo[k] == stats[k] for k in ['count','stakeRaw','winRaw','sourceFrames','freeRounds','zeroWinRounds']), 'AUDIT_MONGO_PARITY')
        request_count = self.db.execute('SELECT COUNT(*) FROM timings').fetchone()[0]
        latency = {}
        for label,fraction in [('p50',0.5),('p95',0.95),('p99',0.99)]:
            latency[label] = self.db.execute('SELECT ms FROM timings ORDER BY ms LIMIT 1 OFFSET ?',
                (min(max(0,request_count-1),int(request_count*fraction)),)).fetchone()[0] if request_count else None
        seconds = self.db.execute('SELECT COALESCE(SUM(ended-started),0) FROM runs WHERE ended IS NOT NULL').fetchone()[0]
        return {**self._status(req),'verifiedFileRounds':count,'mongo':mongo,'requestLatencyMs':latency,
                'activeSeconds':round(seconds,3),'roundsPerSecond':count/seconds if seconds else 0,
                'recoveredRunCount':self.db.execute('SELECT COUNT(*) FROM runs').fetchone()[0],
                'mongoPerBatchContentVerified':True,'productionGamePoolWrites':False}
