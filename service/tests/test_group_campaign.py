import concurrent.futures
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from campaign import Campaign, for_group
from group_migration import activate
from pool_trial import PoolTrial
from runner_federation import TOPOLOGY, topology_path
from store import Rejected, canonical, digest
from work_pool import WorkPool
from test_pool_trial import ScopedMemory
from test_trial import MemoryMongo
from test_squid_fields import sample, exchange


class GroupCampaignTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.now=[2000.0];self.clock=lambda:self.now[0]
        self.disk=patch('campaign.shutil.disk_usage',return_value=type('Disk',(),{'free':100*1024**3})())
        self.disk.start();self.addCleanup(self.disk.stop)
        c=Campaign(self.root,clock=self.clock)
        self.plans=c.plans;self.backup=self.root/'reviews'/'groups'
        c.db.execute("UPDATE control SET enabled=0,active_game=32714,reason='ACTIVE_GAME_REQUIRES_REVIEW'")
        c.db.execute("UPDATE games SET status='active' WHERE game_id=32714")
        c.db.execute("UPDATE games SET status='needs-adapter' WHERE status='ready' AND game_id<>32651")
        self.before=[tuple(r) for r in c.db.execute('SELECT * FROM games ORDER BY game_id')]
        c.close();topology_path(self.root).write_bytes(canonical(TOPOLOGY))
        plan=self.plans['32714'];directory=self.root/'trials'/plan['trialId']
        p=WorkPool(directory,plan['trialId'],plan['target'],self.clock);p.enable_by_operator()
        w=p.register(14,'a'*64,'old');b=p.take(w);p.halt('BATCH_HALTED')
        p.db.execute('UPDATE workers SET lease_until=0');p.close()
        bd=directory/'batches'/str(b['id']);bd.mkdir(parents=True)
        db=sqlite3.connect(bd/'state.sqlite3')
        db.executescript('CREATE TABLE trial(lease_until REAL);INSERT INTO trial VALUES(0);'
            'CREATE TABLE pending(awaiting TEXT,raw TEXT);INSERT INTO pending VALUES(NULL,\'preserved-natural-BET\');'
            'CREATE TABLE receipts(sequence INTEGER,payload TEXT);INSERT INTO receipts VALUES(1,\'one\'),(2,\'two\');')
        db.commit();db.close()
        (bd/'raw.ndjson').write_text('preserve these bytes\n')
        self.raw=bd/'raw.ndjson';self.handles=[]
        self.addCleanup(lambda:[h.close() for h in reversed(self.handles)])

    def migrate(self):
        review=activate(self.root,self.backup,clock=self.clock)
        return activate(self.root,self.backup,review['proofHash'],True,self.clock)

    def group(self,name):
        c=for_group(self.root,name,clock=self.clock);self.handles.append(c);return c

    def test_migration_preserves_records_and_starts_both_groups_paused(self):
        result=self.migrate();self.assertTrue(result['applied'])
        self.assertEqual((result['retainedComplete'],result['retainedPending']),(2,1))
        primary=self.group('primary');secondary=self.group('secondary')
        self.assertFalse(primary.allowed());self.assertFalse(secondary.allowed())
        self.assertEqual(primary.status()['activeGame'],32714)
        self.assertEqual(self.before,[tuple(r) for r in primary.db.execute('SELECT * FROM games ORDER BY game_id')])
        self.assertEqual(self.raw.read_bytes(),(self.backup/'trial'/self.raw.relative_to(self.root/'trials'/self.plans['32714']['trialId'])).read_bytes())
        with self.assertRaisesRegex(Rejected,'GROUP_OPERATOR_REQUIRED'):Campaign(self.root)
        with self.assertRaises(Rejected):self.migrate()

    def test_stale_proof_or_live_lease_or_unknown_result_cannot_migrate(self):
        proof=activate(self.root,self.backup,clock=self.clock)['proofHash']
        self.raw.write_text('changed')
        with self.assertRaisesRegex(Rejected,'GROUP_STATE_CHANGED'):
            activate(self.root,self.backup,proof,True,self.clock)
        db=sqlite3.connect(self.raw.parent/'state.sqlite3');db.execute('UPDATE trial SET lease_until=3000');db.commit()
        with self.assertRaisesRegex(Rejected,'GROUP_ACTIVE_BATCH'):self.migrate()
        db.execute('UPDATE trial SET lease_until=0');db.execute("UPDATE pending SET awaiting='BET'");db.commit();db.close()
        with self.assertRaisesRegex(Rejected,'GROUP_UNKNOWN_OUTCOME'):self.migrate()

    def test_secondary_selects_different_game_and_primary_pause_is_preserved(self):
        self.migrate();s=self.group('secondary');s.enable_by_operator()
        p=self.group('primary');self.assertEqual(p.select('primary')['action'],'stop')
        selected=s.select('secondary');self.assertEqual(selected['plan']['gameId'],32651)
        self.assertFalse(p.allowed());self.assertTrue(s.allowed(new_round=True))
        with self.assertRaisesRegex(Rejected,'GROUP_GAME_MISMATCH'):s.assert_plan_access(32714)
        with self.assertRaisesRegex(Rejected,'GROUP_GAME_MISMATCH'):p.assert_plan_access(32651)
        s.pause('ACTIVE_GAME_REQUIRES_REVIEW');self.assertFalse(s.allowed())
        self.assertEqual(p.status()['activeGame'],32714)

    def test_two_groups_cannot_claim_the_same_ready_game(self):
        self.migrate();s=self.group('secondary')
        # Artificially release the preserved group only inside this fixture.
        s.db.execute('UPDATE group_control SET enabled=1,active_game=NULL,reason=NULL')
        def select(group):
            c=for_group(self.root,group,clock=self.clock)
            try:return c.select(group)
            finally:c.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as workers:
            result=list(workers.map(select,['primary','secondary']))
        self.assertEqual(sum(r['action']=='capture' for r in result),1)
        self.assertEqual(s.db.execute('SELECT COUNT(*) FROM game_owners WHERE game_id=32651').fetchone()[0],1)

    def test_global_disk_stop_blocks_both_and_does_not_auto_resume(self):
        self.migrate();s=self.group('secondary');s.enable_by_operator();p=self.group('primary')
        s.disk_free=lambda:29*1024**3
        self.assertFalse(s.allowed(new_round=True));self.assertTrue(s.allowed())
        s.disk_free=lambda:100*1024**3
        self.assertFalse(s.allowed(new_round=True));self.assertFalse(p.allowed(new_round=True))
        with self.assertRaisesRegex(Rejected,'GLOBAL_REVIEW_REQUIRED'):s.enable_by_operator()
        s.disk_free=lambda:24*1024**3;self.assertFalse(s.allowed())
        s.disk_free=lambda:100*1024**3;self.assertFalse(s.allowed())

    def test_one_worker_can_capture_then_late_worker_gets_disjoint_batch(self):
        self.migrate();s=self.group('secondary');s.enable_by_operator();plan=s.select('second')['plan']
        mongo=MemoryMongo();clients=[]
        def register(shard):
            c=PoolTrial(self.root,plan,lambda scope:ScopedMemory(mongo,plan,scope),self.clock,runner_group='secondary')
            self.handles.append(c)
            common={'schema':plan['schema'],'trialId':plan['trialId']}
            own={'shardId':shard,'owner':f'w{shard}'}
            registered=c.dispatch({**common,**own,'op':'register','sessionHash':f'{shard+1:064x}',
                                   'commitSha':'b'*40,'planHash':digest(plan)})
            own['workerEpoch']=registered['workerEpoch']
            lease=c.dispatch({**common,**own,'op':'next'})
            self.assertNotIn('waitingForWorkers',lease)
            own.update(batchId=lease['batchId'],epoch=lease['epoch'])
            return c,common,own,lease
        c,common,own,lease=register(20);seq=lease['durable']+1
        raw={**sample(),'steps':[exchange('BET',{'B':97783,'AB':97783,'TW':0,'FID':'0|'})]}
        c.dispatch({**common,**own,'op':'begin','sequence':seq,'attempt':'00000000-0000-0000-0000-000000000001',
                    'startBalanceRaw':raw['startBalanceRaw'],'requestPayload':raw['steps'][0]['requestPayload']})
        c.dispatch({**common,**own,'op':'exchange_journal','sequence':seq,'step':raw['steps'][0],
                    'normalized':c.store.field_settled(raw)})
        c.dispatch({**common,**own,'op':'release'})
        late,_,_,second=register(39)
        self.assertNotEqual(second['batchId'],lease['batchId'])
        self.assertGreater(second['durable']+1,lease['sequenceTarget'])
        self.assertEqual(c.store._audit({})['verifiedFileRounds'],1)
        self.assertEqual(len(mongo.rows),1)
        with self.assertRaisesRegex(Rejected,'GROUP_GAME_MISMATCH'):
            PoolTrial(self.root,self.plans['32714'],lambda scope:None,self.clock,runner_group='secondary')
        s.pause_global('SOURCE_OR_STORAGE_REQUIRES_REVIEW')
        self.assertFalse(late.allowed())


if __name__=='__main__':unittest.main()
