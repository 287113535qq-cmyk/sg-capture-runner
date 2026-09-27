import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pool_trial import PoolTrial
from pool_plan import validate_pool_plan
from store import Rejected, digest
from test_trial import MemoryMongo, payload, raw, step
from trial_fields import settled
from pool_audit import parallel_audit, audit_lane


def fixture_plan(target=400):
    plan = json.loads((Path(__file__).resolve().parents[2] / 'config/trial-pool.json').read_text())
    return {**plan, 'configured': True, 'trialId': 'bookofsevens_pool_fixture', 'target': target}


class ScopedMemory:
    def __init__(self, shared, plan, scope):
        self.shared, self.plan, self.scope = shared, plan, scope
    def ensure(self): pass
    def put(self, rows):
        for row in rows:
            if row['trialId'] != self.plan['trialId'] or not self.scope[0] <= row['sequence'] <= self.scope[1]:
                raise Rejected('BAD_MONGO_SCOPE')
            for existing in self.shared.rows.values():
                if existing['trialId'] == row['trialId'] and existing['sequence'] == row['sequence'] and existing != row:
                    raise Rejected('SEQUENCE_CONFLICT')
        return self.shared.put(rows)
    def summary(self):
        selected = MemoryMongo()
        selected.rows = {k: r for k, r in self.shared.rows.items()
            if r['trialId'] == self.plan['trialId'] and self.scope[0] <= r['sequence'] <= self.scope[1]}
        return selected.summary()
    def verify(self, rows):
        if any(self.shared.rows.get(row['_id']) != row for row in rows):raise Rejected('AUDIT_MONGO_CONTENT')
        return len(rows)


class PoolIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='sg-pool-integration-fixture-')
        self.plan = fixture_plan(); self.mongo = MemoryMongo(); self.now = [1000.0]; self.clients = []
        self.leases = {}; self.chunk_leases = {}
        self.first = self.client()
        self.first.pool.enable_by_operator()
        self.workers = []
        for i in range(20):
            client = self.client(); self.workers.append(client); self.register(client, i)
    def tearDown(self):
        for client in self.clients: client.close()
        self.tmp.cleanup()
    def client(self):
        client = PoolTrial(self.tmp.name, self.plan, lambda scope: ScopedMemory(self.mongo, self.plan, scope), lambda: self.now[0])
        self.clients.append(client); return client
    def call(self, client, op, shard=None, **kw):
        base = {'schema': self.plan['schema'], 'trialId': self.plan['trialId'], 'op': op}
        if shard is not None: base['shardId'] = shard
        return client.dispatch({**base, **kw})
    def register(self, client, shard, owner=None):
        owner = owner or f'worker-{shard}'
        registered = self.call(client, 'register', shard, owner=owner, sessionHash=f'{shard+1:064x}',
            commitSha='b'*40, planHash=digest(self.plan))
        self.leases[client] = {'owner': owner, 'workerEpoch': registered['workerEpoch']}
    def take(self, client, shard):
        result = self.call(client, 'next', shard, **self.leases[client])
        if not result.get('done') and not result.get('waitingForWorkers'):
            self.chunk_leases[client] = {**self.leases[client], 'batchId': result['batchId'], 'epoch': result['epoch']}
        return result
    def own(self, client): return self.chunk_leases[client]
    def begin(self, client, shard, seq):
        return self.call(client, 'begin', shard, **self.own(client), sequence=seq,
            attempt=f'00000000-0000-0000-0000-{seq:012d}', startBalanceRaw=100000, requestPayload=payload('BET'))
    def record(self, client, shard, seq, free=False):
        self.begin(client, shard, seq)
        steps = [step(remaining=2), step('FREE_GAME', remaining=1), step('FREE_GAME', balance=100025, win=50)] if free else [step()]
        collected = []
        for index, frame in enumerate(steps):
            if index:
                self.call(client, 'intent', shard, **self.own(client), sequence=seq, requestPayload=payload('FREE_GAME'))
            collected.append(frame)
            data = {'normalized': settled(raw(collected))} if index == len(steps)-1 else {}
            result = self.call(client, 'exchange_journal', shard, **self.own(client), sequence=seq, step=frame, **data)
        return result
    def finish(self, client, shard, lease):
        for seq in range(lease['durable']+1, lease['sequenceTarget']+1):
            self.record(client, shard, seq, free=seq%17==0)
        return self.call(client, 'release', shard, **self.own(client))

    def test_twenty_sessions_finish_exact_target_through_journal_files_and_content_ack(self):
        initial = [self.take(client, i) for i, client in enumerate(self.workers)]
        self.assertEqual(len({lease['batchId'] for lease in initial}), 20)
        for i, client in enumerate(self.workers): self.finish(client, i, initial[i])
        running = set(range(20))
        while running:
            for i in list(running):
                lease = self.take(self.workers[i], i)
                if lease.get('done'): running.remove(i)
                else: self.finish(self.workers[i], i, lease)
        audit = self.call(self.first, 'audit')
        self.assertEqual(audit['status'], 'complete')
        self.assertFalse(audit['globalSourceEnabled'])
        self.assertEqual(audit['verifiedFileRounds'], 400)
        self.assertEqual(audit['statistics']['freeRounds'], 400//17)
        self.assertEqual(audit['statistics']['sourceFrames'], 400+2*(400//17))
        self.assertEqual(sorted(r['sequence'] for r in self.mongo.rows.values()), list(range(1,401)))
        self.assertEqual(len({r['sourceSessionHash'] for r in self.mongo.rows.values()}), 20)
        self.assertTrue(all(r['buy']==0 and r['bet']==0.25 and r['mul']==r['normalized']['money']['totalWinRaw']/25 for r in self.mongo.rows.values()))
        self.assertFalse((Path(self.tmp.name)/'trials'/'bookofsevens_300k_20260927').exists())
        late=self.call(self.client(),'register',0,owner='late-worker',sessionHash=f'{1:064x}',
            commitSha='b'*40,planHash=digest(self.plan))
        self.assertTrue(late['done'])

    def test_source_start_waits_for_all_twenty_registered_sessions(self):
        self.first.pool.db.execute('DELETE FROM workers WHERE id=19')
        result = self.take(self.workers[0],0)
        self.assertEqual(result['readyWorkers'],19)
        self.assertEqual(self.first.pool.status()['assigned'],0)

    def test_disconnected_idle_worker_does_not_satisfy_startup_barrier(self):
        client=self.workers[19];client.close();self.clients.remove(client)
        result=self.take(self.workers[0],0)
        self.assertEqual(result['readyWorkers'],19)
        self.assertEqual(self.first.pool.status()['assigned'],0)

    def test_unknown_request_halts_every_worker_without_reassignment(self):
        client=self.workers[0];lease=self.take(client,0);seq=lease['durable']+1
        self.begin(client,0,seq);self.now[0]+=601
        recovered=self.client();self.register(recovered,0,'recovered')
        with self.assertRaisesRegex(Rejected,'SOURCE_OUTCOME_UNKNOWN'):self.take(recovered,0)
        self.assertEqual(self.call(self.first,'status')['status'],'halted')
        self.assertEqual(self.first.pool.status()['unfinishedBatches'],1)

    def test_free_round_resumes_only_its_original_batch_and_session(self):
        client=self.workers[0];lease=self.take(client,0);seq=lease['durable']+1
        self.begin(client,0,seq)
        self.call(client,'exchange_journal',0,**self.own(client),sequence=seq,step=step(remaining=2))
        self.call(client,'fail',0,**self.own(client),category='storage')
        self.now[0]+=601
        recovered=self.client();self.register(recovered,0,'recovered')
        resumed=self.take(recovered,0)
        self.assertEqual(resumed['batchId'],lease['batchId'])
        self.assertEqual(resumed['pendingRound']['raw']['steps'][0]['msgId'],'BET')
        frames=[step(remaining=2),step('FREE_GAME',remaining=1),step('FREE_GAME',balance=100025,win=50)]
        for index in (1,2):
            self.call(recovered,'intent',0,**self.own(recovered),sequence=seq,requestPayload=payload('FREE_GAME'))
            self.call(recovered,'exchange_journal',0,**self.own(recovered),sequence=seq,step=frames[index],
                **({'normalized':settled(raw(frames))} if index==2 else {}))
        for following in range(seq+1,resumed['sequenceTarget']+1):self.record(recovered,0,following)
        self.call(recovered,'release',0,**self.own(recovered))
        self.assertEqual(self.mongo.rows[next(iter(self.mongo.rows))]['bonus'],1)

    def test_lost_mongo_ack_does_not_duplicate_completed_batch(self):
        client=self.workers[0];lease=self.take(client,0)
        for seq in range(lease['durable']+1,lease['sequenceTarget']):self.record(client,0,seq)
        self.mongo.lose_ack=True
        with self.assertRaisesRegex(Rejected,'TRIAL_MONGO_FAILED'):self.record(client,0,lease['sequenceTarget'])
        original=len(self.mongo.rows)
        self.call(client,'fail',0,**self.own(client),category='storage');self.now[0]+=601
        recovered=self.client();self.register(recovered,0,'recovered')
        resumed=self.take(recovered,0)
        self.assertEqual(resumed['durable'],resumed['sequenceTarget'])
        self.call(recovered,'release',0,**self.own(recovered))
        self.assertEqual(len(self.mongo.rows),original)
        self.assertEqual(self.call(self.first,'status')['checkpoint'],original)

    def test_lost_pool_ack_recovers_finished_batch_before_assigning_more(self):
        client=self.workers[0];lease=self.take(client,0)
        with patch.object(client.pool,'complete',side_effect=Rejected('LOST_POOL_ACK')):
            with self.assertRaisesRegex(Rejected,'LOST_POOL_ACK'):self.finish(client,0,lease)
        original=len(self.mongo.rows);self.now[0]+=601
        recovered=self.client();self.register(recovered,0,'recovered')
        following=self.take(recovered,0)
        self.assertNotEqual(following['batchId'],lease['batchId'])
        self.assertEqual(following['sequenceBase'],lease['sequenceTarget'])
        self.assertEqual(len(self.mongo.rows),original)

    def test_pool_cannot_change_scope_or_reuse_completed_legacy_trial(self):
        for field,value in [('trialId','bookofsevens_300k_20260927'),('buy',11),('configured',False),('target',300001)]:
            with self.assertRaises(Rejected):validate_pool_plan({**self.plan,field:value})
        with self.assertRaisesRegex(Rejected,'RUNNER_POOL_PLAN_MISMATCH'):
            self.call(self.client(),'register',0,owner='bad',sessionHash='f'*64,commitSha='b'*40,planHash='0'*64)

    def test_audit_checks_entire_mongo_documents_not_only_counts_and_amounts(self):
        client=self.workers[0];lease=self.take(client,0);self.finish(client,0,lease)
        self.mongo.rows[next(iter(self.mongo.rows))]['sourceRoundIdentity']='tampered'
        with self.assertRaisesRegex(Rejected,'AUDIT_MONGO_CONTENT'):self.call(self.first,'audit',0)

    def test_global_failure_preserves_other_workers_received_response(self):
        first,second=self.workers[:2]
        a,b=self.take(first,0),self.take(second,1);seq=b['durable']+1
        self.begin(second,1,seq)
        self.call(first,'fail',0,**self.own(first),category='source_http')
        following={'sequence':seq+1,'attempt':'00000000-0000-0000-0000-000000000999',
            'startBalanceRaw':99975,'requestPayload':payload('BET')}
        result=self.call(second,'exchange_journal',1,**self.own(second),sequence=seq,
            step=step(),normalized=settled(raw()),following=following)
        self.assertTrue(result['stopRequested'])
        self.assertIsNone(second.store.pending())
        self.call(second,'release',1,**self.own(second))
        self.assertEqual(self.call(self.first,'status')['checkpoint'],1)
        self.assertEqual(self.call(self.first,'status')['status'],'halted')

    def test_progress_sums_real_counts_instead_of_using_highest_sequence(self):
        leases=[self.take(client,i) for i,client in enumerate(self.workers)]
        client=self.workers[19];seq=leases[19]['durable']+1
        self.record(client,19,seq)
        self.call(client,'release',19,**self.own(client))
        status=self.call(self.first,'status')
        self.assertGreater(seq,200)
        self.assertEqual(status['journaled'],1)
        self.assertEqual(status['durable'],1)
        self.assertEqual(status['checkpoint'],1)

    def parallel_fixture_audit(self):
        shared, plan = self.mongo, self.plan
        class ReadOnlyMemory:
            def __init__(self, **kwargs):
                if kwargs.get('read_only') is not True:raise AssertionError('READ_ONLY_REQUIRED')
            def scoped(self, scope):return ScopedMemory(shared, plan, scope)
            def close(self):pass
        self.first.audit_executor = parallel_audit
        # Use threads for the in-memory database; production uses spawn and
        # independent persistent Mongo connections with the same lane logic.
        with patch('pool_audit.ProcessPoolExecutor', side_effect=lambda max_workers,mp_context:
                ThreadPoolExecutor(max_workers=max_workers)), patch('pool_audit.audit_lane',
                side_effect=lambda *args:audit_lane(*args, mongo_type=ReadOnlyMemory)):
            return self.call(self.first, 'audit')

    def finish_every_worker(self):
        running=set(range(20))
        while running:
            for i in list(running):
                lease=self.take(self.workers[i],i)
                if lease.get('done'):running.remove(i)
                else:self.finish(self.workers[i],i,lease)

    def test_parallel_replay_matches_serial_full_verification(self):
        self.finish_every_worker()
        serial=self.call(self.first,'audit')
        parallel=self.parallel_fixture_audit()
        self.assertEqual(parallel['auditExecution']['processes'],4)
        for key in ('verifiedFileRounds','statistics','checkpoint','status','mongoPerBatchContentVerified'):
            self.assertEqual(serial[key],parallel[key])
        self.assertEqual(parallel['verifiedFileRounds'],self.plan['target'])

    def test_parallel_replay_rejects_mongo_and_raw_file_corruption(self):
        self.finish_every_worker()
        first=next(iter(self.mongo.rows.values()));old=first['sourceRoundIdentity']
        first['sourceRoundIdentity']='tampered'
        with self.assertRaisesRegex(Rejected,'AUDIT_MONGO_CONTENT'):self.parallel_fixture_audit()
        first['sourceRoundIdentity']=old
        path=Path(self.tmp.name)/'trials'/self.plan['trialId']/'batches'/'1'/'raw.jsonl'
        with path.open('ab') as stream:stream.write(b'{}\n')
        with self.assertRaisesRegex(Rejected,'AUDIT_EXTRA_DATA'):self.parallel_fixture_audit()

    def test_parallel_replay_requires_all_batches_settled(self):
        self.take(self.workers[0],0)
        with self.assertRaisesRegex(Rejected,'POOL_NOT_QUIESCENT'):self.parallel_fixture_audit()


if __name__=='__main__':unittest.main()
