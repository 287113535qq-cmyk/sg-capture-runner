import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from campaign import Campaign
from pending_discard import discard, verify_discard, REVIEW, TARGETS, HTTP_TARGETS
from pool_trial import PoolTrial
from store import Rejected, digest
from trial_store import TrialStore
from test_trial import MemoryMongo
from test_squid_fields import PLAN, sample, exchange


class VerifiedMongo(MemoryMongo):
    def verify(self, records):
        if any(self.rows.get(r['_id']) != r for r in records): raise Rejected('MONGO_CONTENT_CHANGED')
        return len(records)


class DiscardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name); self.clock = lambda: 2000
        self.disk = patch('campaign.shutil.disk_usage', return_value=type('Disk', (), {'free': 100*1024**3})())
        self.disk.start(); self.addCleanup(self.disk.stop)
        self.mongo = {}; self.stores = []
        self.factory = lambda scope: self.mongo.setdefault(scope, VerifiedMongo())
        self.campaign = Campaign(self.root)
        self.campaign.db.execute("UPDATE control SET active_game=32651,enabled=0,reason='ACTIVE_GAME_REQUIRES_REVIEW'")
        self.pool = PoolTrial(self.root, PLAN, self.factory, self.clock)
        for bid, worker, start in [(5,14,401),(11,16,1001),(18,0,1701)]:
            spec = {'id':bid,'worker':worker,'start':start,'end':start+99}
            self.pool.pool.db.execute('INSERT INTO batches(id,worker,start,end,created) VALUES(?,?,?,?,0)', (bid,worker,start,start+99))
            self.pool.pool.db.execute('INSERT INTO workers(id,session_hash,owner,epoch,lease_until,active_batch) VALUES(?,?,?,1,0,?)',
                                      (worker,str(worker%10)*64,'old',bid))
            store = TrialStore(self.root, self.factory((start,start+99)), lambda:1000, plan=PLAN, batch=spec)
            self.stores.append(store)
            owned = {'owner':'old','epoch':store._claim({'owner':'old','sessionHash':str(worker%10)*64,'commitSha':'a'*40})['epoch']}
            ordinary = {**sample(), 'steps':[exchange('BET', {'B':97783,'AB':97783,'TW':0,'FID':'0|'})]}
            for seq in range(start, TARGETS[bid][0]):
                store._begin({**owned,'sequence':seq,'attempt':f'00000000-0000-0000-0000-{seq:012d}',
                              'startBalanceRaw':ordinary['startBalanceRaw'],'requestPayload':ordinary['steps'][0]['requestPayload']})
                store._exchange_journal({**owned,'sequence':seq,'step':ordinary['steps'][0],'normalized':store.field_settled(ordinary)})
            if bid == 18: store._flush(owned)
            pending_raw = {**sample(), 'steps':sample()['steps'][:1]} if bid == 5 else {
                **ordinary, 'steps':[exchange('BET', {'B':97783,'AB':97783,'TW':0,'FID':'0|','NFG':1})]}
            seq = TARGETS[bid][0]
            store._begin({**owned,'sequence':seq,'attempt':f'00000000-0000-0000-0000-{seq:012d}',
                          'startBalanceRaw':pending_raw['startBalanceRaw'],'requestPayload':pending_raw['steps'][0]['requestPayload']})
            store._exchange_journal({**owned,'sequence':seq,'step':pending_raw['steps'][0]})
            if bid == 18:
                rejected = exchange('FREE_GAME', {})
                rejected.update(sourceRejected=True,responsePayload='MSGID=ERROR&EID=ERROR_INVALID_SESSION',
                                responseXml='<GDMRESPONSE><SUCCESS>false</SUCCESS><PAYLOAD>MSGID=ERROR&amp;EID=ERROR_INVALID_SESSION</PAYLOAD></GDMRESPONSE>')
                store._intent({**owned,'sequence':seq,'requestPayload':rejected['requestPayload']})
                with self.assertRaises(Rejected): store._exchange_journal({**owned,'sequence':seq,'step':rejected})
            else: store.db.execute("UPDATE trial SET status='pending',failure=NULL,lease_until=0")
        self.pool.pool.halt('BATCH_HALTED')
        self.proof = self.make_proof()
        self.before = [s.pending() for s in self.stores]
        self.addCleanup(self.close)

    def close(self):
        for store in self.stores: store.close()
        self.pool.close(); self.campaign.close()

    def make_proof(self):
        rows = lambda db, table: [dict(r) for r in db.execute('SELECT * FROM '+table+' ORDER BY id')]
        proof = {'authorization':REVIEW,'trialId':PLAN['trialId'],'planHash':digest(PLAN),
                 'campaignHash':digest(rows(self.campaign.db,'control')[0]),
                 'controlHash':digest(rows(self.pool.pool.db,'control')[0]),
                 'workersHash':digest(rows(self.pool.pool.db,'workers')),
                 'allocationHash':digest(rows(self.pool.pool.db,'batches')),
                 'expectedComplete':44,'expectedCommitted':7,'batches':{}}
        for s in self.stores:
            proof['batches'][str(s.batch['id'])] = {'stateHash':digest(dict(s.state())),
                'receiptsHash':digest([dict(r) for r in s.db.execute('SELECT * FROM receipts ORDER BY sequence')]),
                'pendingHash':digest(s.pending())}
        return proof

    def run_discard(self, apply=False):
        return discard(self.root,self.proof,self.factory,self.root/'reviews'/'discard',apply,self.clock)

    def test_review_then_apply_keeps_receipts_and_archives_pending_and_requires_fresh_attempt(self):
        self.assertFalse(self.run_discard()['applied'])
        self.assertEqual(self.before,[s.pending() for s in self.stores])
        result = self.run_discard(True)
        self.assertEqual(result['preservedComplete'],44)
        self.assertEqual(result['mongoVerified'],7)
        self.assertEqual(result['completeRoundsDeleted'],0)
        self.assertTrue(result['gatesRemainPaused'])
        archive=json.loads((self.root/'reviews/discard/event.json').read_text())
        self.assertEqual([b['pending'] for b in archive['batches']],self.before)
        for s in self.stores:
            self.assertIsNone(s.pending())
            self.assertEqual(s.state()['status'],'pending')
            self.assertEqual(digest([dict(r) for r in s.db.execute('SELECT * FROM receipts ORDER BY sequence')]),
                             self.proof['batches'][str(s.batch['id'])]['receiptsHash'])
        self.assertFalse(self.pool.pool.status()['enabled'])
        self.assertFalse(self.campaign.status()['enabled'])
        # Ordinary next claim flushes the 37 journal-only records, then a fresh
        # attempt fills exactly the first uncompleted sequence after INIT.
        s=self.stores[0];s.clock=self.clock
        lease=s._claim({'owner':'replacement','sessionHash':s.state()['session_hash'],'commitSha':'b'*40})
        self.assertIsNone(lease['pendingRound']);self.assertEqual(lease['checkpoint'],423)
        s._begin({'owner':'replacement','epoch':lease['epoch'],'sequence':424,
                  'attempt':'11111111-1111-1111-1111-111111111111','startBalanceRaw':100000,
                  'requestPayload':sample()['steps'][0]['requestPayload']})
        self.assertNotEqual(s.pending()['attempt'],self.before[0]['attempt'])
        self.assertEqual(s.pending()['raw']['steps'],[])

    def test_unknown_outcome_cannot_be_discarded_even_with_new_hash(self):
        self.stores[0].db.execute("UPDATE pending SET awaiting='unknown-request'")
        self.proof=self.make_proof()
        with self.assertRaisesRegex(Rejected,'DISCARD_UNKNOWN_SOURCE_OUTCOME'):self.run_discard(True)
        self.assertFalse((self.root/'reviews/discard').exists())

    def test_changed_evidence_blocks_all_changes(self):
        self.proof['batches']['18']['pendingHash']='a'*64
        with self.assertRaisesRegex(Rejected,'DISCARD_PENDING_CHANGED'):self.run_discard(True)
        self.assertEqual(self.before,[s.pending() for s in self.stores])

    def test_active_lease_and_missing_authorization_are_rejected(self):
        self.stores[0].db.execute('UPDATE trial SET lease_until=9999')
        self.proof=self.make_proof()
        with self.assertRaisesRegex(Rejected,'DISCARD_ACTIVE_LEASE'):self.run_discard(True)
        self.proof['authorization']='not-authorized'
        with self.assertRaisesRegex(Rejected,'DISCARD_AUTHORIZATION_REQUIRED'):self.run_discard(True)

    def test_file_tampering_blocks_discard(self):
        (self.stores[2].root/'raw.jsonl').write_bytes(b'altered')
        with self.assertRaisesRegex(Rejected,'DISCARD_FILE_MISMATCH'):self.run_discard(True)
        self.assertEqual(self.before,[s.pending() for s in self.stores])

    def test_repeat_apply_and_rpc_enable_are_forbidden(self):
        self.run_discard(True)
        with self.assertRaises(Rejected):self.run_discard(True)
        with self.assertRaises(Rejected):self.stores[0].dispatch({'schema':PLAN['schema'],'trialId':PLAN['trialId'],'op':'discard'})

    def test_only_the_reviewed_gateway_attempt_can_be_abandoned_without_replay(self):
        from types import SimpleNamespace
        pending = {'sequence':5982,'attempt':'00000000-0000-0000-0000-000000005982',
                   'raw':{**sample(),'steps':[]},'awaiting':sample()['steps'][0]['requestPayload']}
        store = SimpleNamespace(batch={'id':93}, pending=lambda:pending, journaled=lambda:5981,
            db=self.stores[0].db, state=lambda:{'failure':'source_http'}, field_request=self.stores[0].field_request)
        evidence = {'runId':36390301074,'httpStatus':502,'shardId':3,'error':'SOURCE_HTTP_REJECTED',
                    'originalOutcome':'unknown','action':'abandon_without_replay'}
        bound={'pendingHash':digest(pending)}
        # The live code binds one actual private pending hash. Only this fixture
        # substitutes a synthetic hash; no broad HTTP retry policy is installed.
        with patch('pending_discard.HTTP_PENDING_HASH',digest(pending)):
            self.assertEqual(verify_discard(store,bound,HTTP_TARGETS,evidence),pending)
            for change in ({'httpStatus':403},{'httpStatus':429},{'runId':0},{'action':'retry'},{'originalOutcome':'failed'}):
                with self.assertRaises(Rejected):verify_discard(store,bound,HTTP_TARGETS,{**evidence,**change})
            with self.assertRaises(Rejected):verify_discard(store,bound,HTTP_TARGETS,None)
        with self.assertRaisesRegex(Rejected,'DISCARD_UNKNOWN_NOT_REVIEWED'):
            verify_discard(store,bound,HTTP_TARGETS,evidence)


if __name__ == '__main__': unittest.main()
