import concurrent.futures
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from campaign import Campaign
from federation_migration import activate
from pool_trial import PoolTrial
from runner_federation import TOPOLOGY, topology_path
from store import Rejected, canonical, digest
from trial_store import TrialStore
from work_pool import WorkPool
from test_pool_trial import ScopedMemory
from test_trial import MemoryMongo
from test_squid_fields import PLAN, sample, exchange
from test_work_pool import proof


class FederationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name); self.now = [2000.0]
        self.clock = lambda:self.now[0]
        self.disk = patch('campaign.shutil.disk_usage', return_value=type('Disk',(),{'free':100*1024**3})())
        self.disk.start(); self.addCleanup(self.disk.stop)
        self.campaign = Campaign(self.root, clock=self.clock); self.addCleanup(self.campaign.close)
        self.campaign.db.execute("UPDATE control SET active_game=32651,enabled=0,reason='ACTIVE_GAME_REQUIRES_REVIEW'")
        self.directory = self.root/'trials'/PLAN['trialId']
        self.pool = WorkPool(self.directory, PLAN['trialId'], PLAN['target'], self.clock)
        self.addCleanup(self.pool.close)
        self.mongo = MemoryMongo(); self.clients = []
        self.addCleanup(lambda:[c.close() for c in self.clients])

    def enable(self):
        result = activate(self.root,self.root/'reviews'/'federation',clock=self.clock)
        return activate(self.root,self.root/'reviews'/'federation',result['proofHash'],True,self.clock)

    def client(self, group):
        item=PoolTrial(self.root,PLAN,lambda scope:ScopedMemory(self.mongo,PLAN,scope),
                       self.clock,runner_group=group)
        self.clients.append(item); return item

    def call(self, client, op, **data):
        return client.dispatch({'schema':PLAN['schema'],'trialId':PLAN['trialId'],'op':op,**data})

    def test_disabled_default_and_trusted_group_fencing(self):
        with self.assertRaisesRegex(Rejected,'BAD_WORKER'):
            self.pool.register(20,'a'*64,'second')
        with self.assertRaisesRegex(Rejected,'RUNNER_GROUP_DISABLED'):
            self.client('secondary')
        self.enable()
        self.campaign.db.execute('UPDATE control SET enabled=1,reason=NULL')
        self.pool.enable_by_operator()
        for group, wrong in [('primary',20),('secondary',0)]:
            c=self.client(group)
            with self.assertRaisesRegex(Rejected,'RUNNER_GROUP_MISMATCH'):
                self.call(c,'register',shardId=wrong,owner='wrong',sessionHash='a'*64,
                          commitSha='a'*40,planHash=digest(PLAN),runnerGroup='secondary')
        self.assertEqual(self.pool.db.execute('SELECT COUNT(*) FROM workers').fetchone()[0],0)

    def test_migration_preserves_old_constraint_rows_and_pending_bytes_and_rejects_changed_proof(self):
        # Reproduce the deployed pre-federation SQLite schema, not the new schema.
        sql=self.pool.db.execute("SELECT sql FROM sqlite_master WHERE name='workers'").fetchone()[0]
        self.pool.db.execute('DROP TABLE workers'); self.pool.db.execute(sql.replace('id<40','id<20'))
        lease=self.pool.register(0,'a'*64,'original'); self.pool.enable_by_operator()
        batch=self.pool.take(lease); self.pool.halt('SOURCE_OR_SESSION_FAILURE')
        spec={k:batch[k] for k in ('id','worker','start','end')}
        store=TrialStore(self.root,MemoryMongo(),self.clock,plan=PLAN,batch=spec)
        try:
            store.db.execute("INSERT INTO pending VALUES(1,1,'original-attempt',?,?)",
                             (json.dumps({'steps':[]}), 'MSGID=BET'))
            before=[tuple(r) for r in store.db.execute('SELECT * FROM pending')]
            with self.assertRaisesRegex(Rejected,'FEDERATION_ACTIVE_WORKERS'):self.enable()
            self.now[0]+=601
            review=activate(self.root,self.root/'reviews'/'federation',clock=self.clock)
            self.pool.db.execute('UPDATE workers SET observed_rate=1')
            with self.assertRaisesRegex(Rejected,'FEDERATION_STATE_CHANGED'):
                activate(self.root,self.root/'reviews'/'federation',review['proofHash'],True,self.clock)
            workers=[tuple(r) for r in self.pool.db.execute('SELECT * FROM workers')]
            control=tuple(self.pool.db.execute('SELECT * FROM control').fetchone())
            self.assertTrue(self.enable()['applied'])
            self.assertEqual(workers,[tuple(r) for r in self.pool.db.execute('SELECT * FROM workers')])
            self.assertEqual(control,tuple(self.pool.db.execute('SELECT * FROM control').fetchone()))
            self.assertEqual(before,[tuple(r) for r in store.db.execute('SELECT * FROM pending')])
            self.assertEqual(store.state()['plan_hash'],digest({'plan':PLAN,'batch':spec}))
            self.assertFalse(self.campaign.status()['enabled'])
            with self.assertRaisesRegex(Rejected,'FEDERATION_ALREADY_CONFIGURED'):self.enable()
        finally:store.close()

    def test_forty_workers_concurrently_allocate_disjoint_ranges_and_complete_exact_target(self):
        self.enable()
        def take(i):
            pool=WorkPool(self.directory,PLAN['trialId'],PLAN['target'],self.clock)
            try:
                lease=pool.register(i,f'{i+1:064x}',f'worker-{i}')
                return lease,pool.take(lease)
            finally:pool.close()
        self.pool.enable_by_operator()
        with concurrent.futures.ThreadPoolExecutor(max_workers=40) as threads:
            assignments=list(threads.map(take,range(40)))
        pool=WorkPool(self.directory,PLAN['trialId'],PLAN['target'],self.clock)
        try:
            running=list(assignments)
            while running:
                following=[]
                for lease,batch in running:
                    pool.complete(lease,batch['id'],proof)
                    new=pool.take(lease)
                    if new:following.append((lease,new))
                running=following
            batches=list(pool.db.execute('SELECT * FROM batches ORDER BY start'))
            self.assertEqual(batches[0]['start'],1);self.assertEqual(batches[-1]['end'],PLAN['target'])
            self.assertTrue(all(a['end']+1==b['start'] for a,b in zip(batches,batches[1:])))
            self.assertEqual({r['worker'] for r in batches},set(range(40)))
            self.assertEqual(pool.status()['completedBatchRounds'],PLAN['target'])
            self.assertTrue(pool.status()['complete'])
        finally:pool.close()

    def test_two_group_barriers_and_actual_journal_file_mongo_content(self):
        self.enable(); self.campaign.db.execute('UPDATE control SET enabled=1,reason=NULL');self.pool.enable_by_operator()
        clients=[]
        for i in range(40):
            c=self.client('primary' if i<20 else 'secondary')
            lease=self.call(c,'register',shardId=i,owner=f'w-{i}',sessionHash=f'{i+1:064x}',
                            commitSha='a'*40,planHash=digest(PLAN))
            clients.append((c,{'shardId':i,'owner':f'w-{i}','workerEpoch':lease['workerEpoch']}))
            if i==20:
                wait=self.call(c,'next',**clients[-1][1])
                self.assertEqual(wait['readyWorkers'],1)
                self.assertEqual(self.pool.status()['assigned'],0)
        for c,own in clients:
            batch=self.call(c,'next',**own)
            own={**own,'batchId':batch['batchId'],'epoch':batch['epoch']}
            seq=batch['durable']+1
            raw={**sample(),'steps':[exchange('BET',{'B':97783,'AB':97783,'TW':0,'FID':'0|'})]}
            self.call(c,'begin',**own,sequence=seq,attempt=f'00000000-0000-0000-0000-{seq:012d}',
                      startBalanceRaw=raw['startBalanceRaw'],requestPayload=raw['steps'][0]['requestPayload'])
            self.call(c,'exchange_journal',**own,sequence=seq,step=raw['steps'][0],normalized=c.store.field_settled(raw))
            self.call(c,'release',**own)
            audit=c.store._audit({})
            self.assertEqual(audit['verifiedFileRounds'],1)
        status=clients[0][0].status()
        self.assertEqual((status['journaled'],status['durable'],status['checkpoint']),(40,40,40))
        self.assertEqual(len(self.mongo.rows),40)
        self.assertEqual(len({r['sourceSessionHash'] for r in self.mongo.rows.values()}),40)
        self.assertEqual(status['workerCapacity'],40)

    def test_tampered_topology_fails_closed(self):
        path=topology_path(self.root);path.write_bytes(canonical({**TOPOLOGY,'extra':True}))
        with self.assertRaisesRegex(Rejected,'FEDERATION_TOPOLOGY_CHANGED'):
            self.client('primary')


if __name__=='__main__':unittest.main()
