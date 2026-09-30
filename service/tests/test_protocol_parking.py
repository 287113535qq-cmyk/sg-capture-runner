from contextlib import ExitStack,closing
import concurrent.futures
import json
import sqlite3
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET
import test_huff_group_recovery as fixture
from campaign import for_group
from parking_migration import activate
from protocol_parking import POLICY,enabled,install_tables,inspect
from pool_trial import PoolTrial
from store import canonical,digest,Rejected


class ParkingTests(unittest.TestCase):
    step=fixture.HuffRecoveryTests.step
    factory=fixture.HuffRecoveryTests.factory
    change=fixture.HuffRecoveryTests.change
    rows=fixture.HuffRecoveryTests.rows

    def setUp(self):
        fixture.HuffRecoveryTests.setUp(self)
        self.queue=self.root/'campaigns/sg_round_one_20260928/queue.sqlite3'
        self.change(self.queue,'UPDATE dispatch_control SET enabled=1,reason=NULL')
        # FID1 and the restricted FID2 cash chain are supported. FID3 is not.
        path=self.batch_paths['primary']
        with closing(sqlite3.connect(path)) as db:
            raw=json.loads(db.execute('SELECT raw FROM pending').fetchone()[0]);s=raw['steps'][0]
            s['responsePayload']=s['responsePayload'].replace('FID=1|','FID=3|')
            xml=ET.fromstring(s['responseXml']);xml.find('PAYLOAD').text=s['responsePayload']
            s['responseXml']=ET.tostring(xml,encoding='unicode')
            db.execute('UPDATE pending SET raw=?',(canonical(raw).decode(),));db.commit()
        pins=patch('parking_migration.BOUNDARIES',{'primary':(32714,1,1,1),'secondary':(32717,1,1,1)})
        pins.start();self.addCleanup(pins.stop)
        self.backup=self.root/'reviews/parking'

    def group(self,name='primary'):
        c=for_group(self.root,name,clock=self.clock);self.addCleanup(c.close);return c

    def migrate(self):
        proof=activate(self.root,self.backup,clock=self.clock)
        return activate(self.root,self.backup,proof,True,self.clock)

    def install_policy(self):
        c=self.group();install_tables(c)
        c.db.execute('INSERT INTO parking_policy VALUES(1,?,?)',(canonical(POLICY).decode(),'{}'))
        return c

    def test_migration_retains_every_trial_byte_and_target_and_assigns_distinct_games(self):
        before={g:{t:self.rows(p,t) for t in ('trial','pending','receipts')} for g,p in self.batch_paths.items()}
        plans={k:digest(v) for k,v in self.plans.items()}
        result=self.migrate();self.assertTrue(result['applied'])
        for group,tables in before.items():
            for table,rows in tables.items():
                self.assertEqual(rows,self.rows(self.batch_paths[group],table))
                self.assertEqual(rows,self.rows(self.backup/group/'batches/1/state.sqlite3',table))
        c=self.group();status=c.status();self.assertEqual(status['counts']['parked-protocol'],2)
        self.assertEqual(status['parkedGames'],[32714,32717]);self.assertTrue(c.allowed())
        self.assertEqual(plans,{k:digest(v) for k,v in c.plans.items()})
        self.assertEqual(c.db.execute('SELECT COUNT(*) FROM games').fetchone()[0],178)
        def select(name):
            cc=for_group(self.root,name,clock=self.clock)
            try:return cc.select(name)
            finally:cc.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            assignments=list(executor.map(select,['primary','secondary']))
        ids=[r['plan']['gameId'] for r in assignments]
        self.assertEqual(len(set(ids)),2);self.assertFalse(set(ids)&{32714,32717})
        self.assertFalse(c.game_allowed(32714))
        c.pause_game(32714,'ACTIVE_GAME_REQUIRES_REVIEW')
        self.assertTrue(c.allowed())
        with self.assertRaisesRegex(Rejected,'ALREADY_INSTALLED'):self.migrate()

    def test_automatic_parking_waits_for_live_worker_then_preserves_and_advances(self):
        c=self.install_policy();self.change(self.pool_paths['primary'],'UPDATE workers SET lease_until=2000')
        self.assertEqual(c.select('runner')['action'],'wait')
        self.assertFalse((self.root/'reviews').exists())
        self.change(self.pool_paths['primary'],'UPDATE workers SET lease_until=0')
        result=c.select('runner');self.assertEqual(result['action'],'capture')
        self.assertNotEqual(result['plan']['gameId'],32714)
        self.assertEqual(c.status()['parkedGames'],[32714])
        s=self.group('secondary');self.assertFalse(s.allowed());self.assertEqual(s.status()['activeGame'],32717)
        saved=next((self.root/'reviews').glob('parked-*'))
        for table in ('trial','pending','receipts'):
            self.assertEqual(self.rows(self.batch_paths['primary'],table),self.rows(saved/'batches/1/state.sqlite3',table))

    def test_unknown_source_and_non_protocol_failures_stop_both_groups(self):
        c=self.install_policy()
        self.change(self.batch_paths['primary'],"UPDATE pending SET awaiting='BET'")
        self.assertEqual(c.select('runner')['action'],'stop')
        self.assertTrue(c.status()['globalPaused']);self.assertFalse(self.group('secondary').allowed())
        self.assertEqual(c.status()['activeGame'],32714);self.assertEqual(c.status()['parkedGames'],[])

    def test_source_error_cannot_be_relabelled_unsupported(self):
        self.change(self.batch_paths['secondary'],"UPDATE trial SET failure='source_http'")
        with self.assertRaisesRegex(Rejected,'NON_PROTOCOL_FAILURE'):
            activate(self.root,self.backup,clock=self.clock)
        self.assertFalse(self.backup.exists())

    def test_invalid_xml_is_not_an_unsupported_feature(self):
        with closing(sqlite3.connect(self.batch_paths['primary'])) as db:
            raw=json.loads(db.execute('SELECT raw FROM pending').fetchone()[0])
            raw['steps'][0]['responseXml']=raw['steps'][0]['responseXml'].replace('true','false')
            db.execute('UPDATE pending SET raw=?',(canonical(raw).decode(),));db.commit()
        with self.assertRaisesRegex(Rejected,'SOURCE_NOT_SUCCESSFUL'):
            activate(self.root,self.backup,clock=self.clock)

    def test_stale_changed_proof_or_active_batch_rejects_migration(self):
        proof=activate(self.root,self.backup,clock=self.clock);self.now+=301
        with self.assertRaisesRegex(Rejected,'PROOF_EXPIRED'):activate(self.root,self.backup,proof,True,self.clock)
        self.now-=301;self.change(self.pool_paths['primary'],'UPDATE workers SET observed_rate=99')
        with self.assertRaisesRegex(Rejected,'PROOF_CHANGED'):activate(self.root,self.backup,proof,True,self.clock)
        self.change(self.batch_paths['secondary'],'UPDATE trial SET lease_until=2000')
        with self.assertRaisesRegex(Rejected,'ACTIVE_LEASE'):activate(self.root,self.backup,clock=self.clock)

    def test_atomic_install_failure_leaves_both_paused_without_policy(self):
        proof=activate(self.root,self.backup,clock=self.clock)
        from protocol_parking import commit_park
        def fail_second(c,result):
            if c.runner_group=='secondary':raise RuntimeError('interrupted')
            return commit_park(c,result)
        with patch('parking_migration.commit_park',side_effect=fail_second):
            with self.assertRaisesRegex(RuntimeError,'interrupted'):activate(self.root,self.backup,proof,True,self.clock)
        c=self.group();self.assertFalse(enabled(c));self.assertFalse(c.allowed());self.assertFalse(self.group('secondary').allowed())
        self.assertEqual(c.status()['activeGame'],32714)

    def test_no_policy_preserves_old_pause_and_failed_backup_does_not_enable(self):
        c=self.group();self.assertEqual(c.select('runner')['action'],'stop')
        self.install_policy()
        with patch('protocol_parking.backup',side_effect=OSError('disk failure')):
            self.assertEqual(c.select('runner')['action'],'stop')
        self.assertEqual(c.status()['parkedGames'],[]);self.assertFalse(c.allowed())

    def test_yield_fences_old_worker_preserves_attempt_and_rejects_unknown(self):
        self.install_policy();plan=self.plans['32714']
        p=PoolTrial(self.root,plan,lambda scope:self.factory(plan,scope),self.clock)
        self.addCleanup(p.close)
        # Recreate the already-owned connection at its safe stop boundary.
        row=p.pool.db.execute('SELECT * FROM workers').fetchone();worker=row['id'];owner=row['owner'];epoch=row['epoch']
        p.pool.db.execute('UPDATE workers SET lease_until=2000')
        p.worker_lease={'worker':worker,'owner':owner,'epoch':epoch}
        p.identity={'worker':worker,'owner':owner}
        state=self.rows(self.batch_paths['primary'],'trial')
        with closing(sqlite3.connect(self.batch_paths['primary'])) as db:
            db.execute('UPDATE trial SET owner=?,lease_until=2000',(owner,));db.commit()
            trial_epoch=db.execute('SELECT epoch FROM trial').fetchone()[0]
        req={'shardId':worker,'owner':owner,'workerEpoch':epoch,'batchId':row['active_batch'],'epoch':trial_epoch}
        before=self.rows(self.batch_paths['primary'],'pending')
        with self.assertRaisesRegex(Rejected,'WORKER_MISMATCH'):p.yield_protocol_stop({**req,'workerEpoch':epoch+1})
        self.change(self.batch_paths['primary'],"UPDATE pending SET awaiting='FREE_GAME'")
        with self.assertRaisesRegex(Rejected,'UNKNOWN_SOURCE_OUTCOME'):p.yield_protocol_stop(req)
        self.change(self.batch_paths['primary'],'UPDATE pending SET awaiting=NULL')
        self.assertTrue(p.yield_protocol_stop(req)['yielded'])
        self.assertEqual(before,self.rows(self.batch_paths['primary'],'pending'))
        self.assertEqual(p.pool.db.execute('SELECT lease_until FROM workers').fetchone()[0],0)
        with self.assertRaises(Rejected):p.yield_protocol_stop(req)
