import copy
import json
import os
import multiprocessing
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from store import Store, Rejected, InjectedCrash, SCHEMA

class MemoryMongo:
    def __init__(self):
        self.data = {}
        self.accepted = {}
        self.fail = False
        self.lose_ack = False
    def ensure(self):
        pass
    def upsert(self, record):
        if self.fail:
            raise Rejected('MONGO_OPERATION_FAILED')
        old = self.data.get(record['_id'])
        if old:
            if old['contentHash'] != record['contentHash']:
                raise Rejected('IDENTITY_CONFLICT')
            return 0
        self.data[record['_id']] = copy.deepcopy(record)
        if self.lose_ack:
            self.lose_ack = False
            raise Rejected('MONGO_OPERATION_FAILED')
        return 1
    def records(self, case, accepted=False):
        return [copy.deepcopy(v) for v in (self.accepted if accepted else self.data).values() if v['caseId'] == case]
    def promote(self, records):
        inserted = 0
        for record in records:
            if record['_id'] not in self.accepted:
                self.accepted[record['_id']] = copy.deepcopy(record)
                inserted += 1
        return inserted

def compete(root, event, queue, owner):
    store=Store(root,MemoryMongo())
    event.wait(15)
    try:
        store.dispatch({'schema':SCHEMA,'caseId':'fixture_compete','op':'claim','gameId':'fixture-race','owner':owner,'leaseSeconds':600})
        queue.put('claimed')
    except Rejected as exc:
        queue.put(str(exc))

class DurableTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='sg-link-test-')
        self.root = Path(self.temp.name).resolve()
        self.assertEqual(self.root.parent, Path(tempfile.gettempdir()).resolve())
        self.assertTrue(self.root.name.startswith('sg-link-test-'))
        self.mongo = MemoryMongo()
        self.now = [1000.0]
        self.store = Store(self.root, self.mongo, lambda: self.now[0])
        self.case = 'fixture_unittest'
        self.call('initialize', games=[{'gameId':'fixture-one','target':3}])
        self.lease = self.call('claim', gameId='fixture-one', owner='worker-a', leaseSeconds=10)
    def tearDown(self):
        self.assertEqual(self.root.parent, Path(tempfile.gettempdir()).resolve())
        self.temp.cleanup()
    def call(self, op, **values):
        return self.store.dispatch({'schema':SCHEMA,'caseId':self.case,'op':op,**values})
    def own(self):
        return {'gameId':'fixture-one','owner':self.lease['owner'],'epoch':self.lease['epoch']}
    def round(self, seq):
        return {'sequence':seq,'sourceRoundId':f'fixture-one:round:{seq}',
                'raw':{'fixtureOnly':True,'response':{'sequence':seq,'value':7}},
                'normalized':{'fixtureOnly':True,'sequence':seq,'gameKey':'fixture-one','value':7}}
    def commit(self, seq, **extra):
        return self.call('commit', **self.own(), round=self.round(seq), **extra)
    def restart(self):
        self.store = Store(self.root, self.mongo, lambda: self.now[0])
    def checkpoint(self):
        return self.call('status')['tasks'][0]['checkpoint']
    def test_raw_normalized_mongo_checkpoint_and_duplicate(self):
        self.assertEqual(self.commit(1)['mongoInserted'],1)
        before=(self.root/'cases'/self.case/'fixture-one'/'rounds.jsonl').read_bytes()
        duplicate=self.commit(1)
        self.assertTrue(duplicate['duplicate'])
        self.assertEqual(duplicate['mongoInserted'],0)
        self.assertEqual(self.checkpoint(),1)
        self.assertEqual(before,(self.root/'cases'/self.case/'fixture-one'/'rounds.jsonl').read_bytes())
        self.assertEqual(self.call('verify')['count'],1)
    def test_distinct_rounds_with_same_result_remain_distinct(self):
        self.commit(1);self.commit(2)
        self.assertEqual(len(self.mongo.data),2)
        self.assertEqual(self.call('verify')['count'],2)
    def test_crash_after_files_recovers_without_duplicate_lines(self):
        with self.assertRaises(InjectedCrash):self.commit(1,failpoint='after_files')
        self.assertEqual(self.checkpoint(),0)
        self.assertEqual(len(self.mongo.data),0)
        self.restart()
        result=self.commit(1)
        self.assertEqual(result['recovered'],1)
        self.assertEqual(self.call('verify')['count'],1)
    def test_crash_after_mongo_recovery_keeps_identity(self):
        with self.assertRaises(InjectedCrash):self.commit(1,failpoint='after_mongo')
        self.assertEqual(self.checkpoint(),0)
        self.assertEqual(len(self.mongo.data),1)
        self.restart()
        result=self.commit(1)
        self.assertEqual(result['mongoInserted'],0)
        self.assertEqual(result['recovered'],1)
        self.assertEqual(self.call('verify')['count'],1)
    def test_lost_response_after_checkpoint_is_idempotent(self):
        with self.assertRaises(InjectedCrash):self.commit(1,failpoint='after_checkpoint')
        self.restart()
        self.assertEqual(self.checkpoint(),1)
        self.assertTrue(self.commit(1)['duplicate'])
        self.assertEqual(self.call('verify')['count'],1)
    def test_mongo_failure_never_advances_checkpoint(self):
        self.mongo.fail=True
        with self.assertRaisesRegex(Rejected,'MONGO_OPERATION_FAILED'):self.commit(1)
        self.assertEqual(self.checkpoint(),0)
        self.mongo.fail=False
        self.assertEqual(self.commit(1)['recovered'],1)
    def test_lost_mongo_acknowledgement_rechecks_existing_record(self):
        self.mongo.lose_ack=True
        with self.assertRaisesRegex(Rejected,'MONGO_OPERATION_FAILED'):self.commit(1)
        self.assertEqual(self.checkpoint(),0)
        self.assertEqual(self.commit(1)['mongoInserted'],0)
        self.assertEqual(self.call('verify')['count'],1)
    def test_changed_content_for_same_identity_is_rejected(self):
        self.commit(1)
        changed=self.round(1);changed['raw']['response']['value']=99
        with self.assertRaisesRegex(Rejected,'ROUND_IDENTITY_CONFLICT'):
            self.call('commit',**self.own(),round=changed)
        self.assertEqual(self.call('verify')['count'],1)
    def test_active_lease_cannot_be_stolen_then_fences_old_owner(self):
        with self.assertRaisesRegex(Rejected,'GAME_BUSY'):self.call('claim',gameId='fixture-one',owner='worker-b')
        stale=self.own()
        self.now[0]+=11
        self.lease=self.call('claim',gameId='fixture-one',owner='worker-b')
        with self.assertRaisesRegex(Rejected,'LEASE_LOST'):self.call('commit',**stale,round=self.round(1))
        self.assertEqual(self.commit(1)['checkpoint'],1)
    def test_expired_lease_cannot_advance_after_slow_mongo(self):
        original=self.mongo.upsert
        def slow(record):
            result=original(record);self.now[0]+=11;return result
        self.mongo.upsert=slow
        with self.assertRaisesRegex(Rejected,'LEASE_LOST'):self.commit(1)
        self.assertEqual(self.checkpoint(),0)
        self.mongo.upsert=original
        self.lease=self.call('claim',gameId='fixture-one',owner='worker-b')
        self.assertEqual(self.commit(1)['checkpoint'],1)
    def test_heartbeat_keeps_owner_and_epoch(self):
        epoch=self.lease['epoch'];self.now[0]+=9
        self.call('heartbeat',**self.own());self.now[0]+=9
        self.assertEqual(self.commit(1)['checkpoint'],1)
        self.assertEqual(self.lease['epoch'],epoch)
    def test_release_then_another_worker_resumes(self):
        self.commit(1)
        self.call('release',**self.own(),status='pending',reason='fixture_stop')
        self.restart()
        self.lease=self.call('claim',gameId='fixture-one',owner='worker-b')
        self.assertEqual(self.lease['checkpoint'],1)
        self.assertEqual(self.commit(2)['checkpoint'],2)
    def test_cooldown_persists_restart_and_cannot_be_shortened(self):
        self.call('release',**self.own(),status='pending')
        deadline=self.call('cooldown',seconds=10)['cooldownUntil']
        self.restart()
        self.assertEqual(self.call('cooldown',seconds=1)['cooldownUntil'],deadline)
        with self.assertRaisesRegex(Rejected,'COOLDOWN_ACTIVE'):self.call('claim',gameId='fixture-one',owner='worker-b')
        self.now[0]+=11
        self.assertEqual(self.call('claim',gameId='fixture-one',owner='worker-b')['checkpoint'],0)
    def test_only_complete_case_promotes_and_repeat_adds_nothing(self):
        self.commit(1)
        with self.assertRaisesRegex(Rejected,'CASE_NOT_COMPLETE'):self.call('promote')
        self.commit(2);self.commit(3)
        self.call('release',**self.own(),status='complete')
        self.assertEqual(self.call('promote')['inserted'],3)
        self.assertEqual(self.call('promote')['inserted'],0)
        with self.assertRaisesRegex(Rejected,'ALREADY_COMPLETE'):self.call('claim',gameId='fixture-one',owner='worker-b')
    def test_real_game_schema_path_traversal_and_large_payload_rejected(self):
        for request in [{'schema':'official','caseId':self.case,'op':'status'},
                        {'schema':SCHEMA,'caseId':'../../outside','op':'status'},
                        {'schema':SCHEMA,'caseId':self.case,'op':'claim','gameId':'32749','owner':'worker'},
                        {'schema':SCHEMA,'caseId':self.case,'op':'commit','padding':'x'*20000}]:
            with self.assertRaises(Rejected):self.store.dispatch(request)
        bad=self.round(1);bad['raw'].pop('fixtureOnly')
        with self.assertRaisesRegex(Rejected,'FIXTURE_RAW_REQUIRED'):self.call('commit',**self.own(),round=bad)
    def test_tampered_file_blocks_verification_and_promotion(self):
        self.commit(1)
        file=self.root/'cases'/self.case/'fixture-one'/'rounds.jsonl'
        with file.open('ab') as h:h.write(b'{"partial":')
        with self.assertRaises(Rejected):self.call('verify')
    def test_partial_unconfirmed_tail_can_be_completed_exactly(self):
        with self.assertRaises(InjectedCrash):self.commit(1,failpoint='after_files')
        file=self.root/'cases'/self.case/'fixture-one'/'rounds.jsonl'
        original=file.read_bytes()
        # This deliberate damage is limited to this test's verified temporary directory.
        file.write_bytes(original[:17])
        self.assertEqual(self.commit(1)['recovered'],1)
        self.assertEqual(file.read_bytes(),original)
        self.assertEqual(self.call('verify')['count'],1)
    def test_sequence_gap_and_premature_complete_rejected(self):
        with self.assertRaisesRegex(Rejected,'SEQUENCE_GAP'):self.commit(2)
        with self.assertRaisesRegex(Rejected,'NOT_COMPLETE'):self.call('release',**self.own(),status='complete')
    def test_competing_processes_claim_once(self):
        self.store.dispatch({'schema':SCHEMA,'caseId':'fixture_compete','op':'initialize','games':[{'gameId':'fixture-race','target':1}]})
        ctx=multiprocessing.get_context('spawn')
        event=ctx.Event();queue=ctx.Queue()
        children=[ctx.Process(target=compete,args=(str(self.root),event,queue,f'worker-{i}')) for i in range(4)]
        for child in children:child.start()
        event.set()
        results=[queue.get(timeout=20) for _ in children]
        for child in children:
            child.join(20)
            self.assertEqual(child.exitcode,0)
        queue.close()
        self.assertEqual(results.count('claimed'),1)
        self.assertEqual(results.count('GAME_BUSY'),3)
    def test_single_game_parity_does_not_hide_other_games_pending_journal(self):
        self.case='fixture_scope'
        self.call('initialize',games=[{'gameId':'fixture-one','target':3},{'gameId':'fixture-other','target':3}])
        self.lease=self.call('claim',gameId='fixture-one',owner='worker-a')
        self.commit(1)
        other=self.call('claim',gameId='fixture-other',owner='worker-other')
        value=self.round(1);value['sourceRoundId']='fixture-other:round:1';value['normalized']['gameKey']='fixture-other'
        with self.assertRaises(InjectedCrash):
            self.call('commit',gameId='fixture-other',owner='worker-other',epoch=other['epoch'],round=value,failpoint='after_files')
        self.assertEqual(self.call('verify',gameId='fixture-one')['count'],1)
        with self.assertRaisesRegex(Rejected,'UNCONFIRMED_RECORDS'):self.call('verify')
    def test_plan_cannot_change_after_initialization(self):
        with self.assertRaisesRegex(Rejected,'PLAN_CHANGED'):
            self.call('initialize',games=[{'gameId':'fixture-one','target':2}])

if __name__=='__main__':unittest.main()
