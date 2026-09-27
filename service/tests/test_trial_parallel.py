import sys
import copy
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from trial_parallel import ParallelTrial, allocation, activate
from trial_store import TrialStore, SCHEMA, TRIAL
from trial_maintenance import gate
from trial_fields import settled
from store import Rejected
from test_trial import MemoryMongo, payload, raw, step


class ScopedMongo:
    def __init__(self,shared,scope):self.shared=shared;self.scope=scope
    def ensure(self):pass
    def put(self,rows):
        for r in rows:
            if self.scope and not self.scope[0]<=r['sequence']<=self.scope[1]:raise Rejected('BAD_RANGE')
            for old in self.shared.rows.values():
                if old['sequence']==r['sequence'] and old!=r:raise Rejected('SEQUENCE_CONFLICT')
        return self.shared.put(rows)
    def summary(self):
        m=MemoryMongo()
        m.rows={k:r for k,r in self.shared.rows.items() if self.scope is None or self.scope[0]<=r['sequence']<=self.scope[1]}
        return m.summary()


class ParallelTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='sg-parallel-test-')
        self.root=Path(self.tmp.name).resolve();self.shared=MemoryMongo();self.clock=[1000.0]
        self.factory=lambda scope:ScopedMongo(self.shared,scope)
        old=TrialStore(self.root,self.factory(None),lambda:self.clock[0])
        req={'schema':SCHEMA,'trialId':TRIAL}
        lease=old.dispatch({**req,'op':'claim','owner':'legacy','sessionHash':'f'*64,'commitSha':'b'*40})
        own={'owner':'legacy','epoch':lease['epoch']}
        old.dispatch({**req,**own,'op':'begin','sequence':1,'attempt':'00000000-0000-0000-0000-000000000001','startBalanceRaw':100000,'requestPayload':payload('BET')})
        old.dispatch({**req,**own,'op':'exchange_journal','sequence':1,'step':step(),'normalized':settled(raw())})
        old.dispatch({**req,**own,'op':'release'})
        gate(old.root,True);old.close()
        activate(self.root,self.factory,1)
        self.clients=[]
    def tearDown(self):
        for c in self.clients:c.close()
        self.assertTrue(self.root.name.startswith('sg-parallel-test-'));self.tmp.cleanup()
    def client(self):
        c=ParallelTrial(self.root,self.factory,lambda:self.clock[0]);self.clients.append(c);return c
    def call(self,c,op,shard=None,**kw):
        return c.dispatch({'schema':SCHEMA,'trialId':TRIAL,'op':op,**({} if shard is None else {'shardId':shard}),**kw})
    def claim(self,c,shard,owner=None,fingerprint=None):
        owner=owner or 'worker-'+str(shard)
        result=self.call(c,'claim',shard,owner=owner,sessionHash=fingerprint or f'{shard+1:064x}',commitSha='b'*40)
        return {'owner':owner,'epoch':result['epoch']}
    def begin(self,c,shard,own,seq):
        return self.call(c,'begin',shard,**own,sequence=seq,attempt=f'00000000-0000-0000-0000-{seq:012d}',startBalanceRaw=100000,requestPayload=payload('BET'))
    def record(self,c,shard,own):
        seq=c.store.journaled()+1;self.begin(c,shard,own,seq)
        return self.call(c,'exchange_journal',shard,**own,sequence=seq,step=step(),normalized=settled(raw()))
    def test_allocation_covers_remaining_target_exactly_once(self):
        for prefix in (0,1,73217,299980):
            shards=allocation(prefix)
            self.assertEqual(len(shards),20)
            self.assertEqual(shards[0]['start'],prefix+1);self.assertEqual(shards[-1]['end'],300000)
            self.assertTrue(all(a['end']+1==b['start'] for a,b in zip(shards,shards[1:])))
            self.assertEqual(sum(s['end']-s['start']+1 for s in shards),300000-prefix)
    def test_twenty_distinct_leases_can_run_but_each_shard_remains_exclusive(self):
        for i in range(20):self.claim(self.client(),i)
        result=self.call(self.client(),'status')
        self.assertEqual(result['distinctBoundSessions'],20)
        self.assertEqual(sum(s['status']=='claimed' for s in result['shards']),20)
        with self.assertRaisesRegex(Rejected,'GAME_BUSY'):self.claim(self.client(),0,owner='competitor')
    def test_cross_shard_shared_and_legacy_sessions_are_rejected(self):
        c=self.client();self.claim(c,0)
        with self.assertRaisesRegex(Rejected,'SHARED_SESSION_FORBIDDEN'):self.claim(self.client(),1,fingerprint=f'{1:064x}')
        with self.assertRaisesRegex(Rejected,'LEGACY_SESSION_FORBIDDEN'):self.claim(self.client(),2,fingerprint='f'*64)
        with self.assertRaisesRegex(Rejected,'TRIAL_SESSION_CHANGED'):self.claim(self.client(),0,owner='changed',fingerprint='e'*64)
    def test_out_of_order_shard_completion_counts_rounds_not_sequence_maximum(self):
        c=self.client();own=self.claim(c,19);self.record(c,19,own)
        self.call(c,'release',19,**own)
        result=self.call(self.client(),'status')
        self.assertEqual(result['checkpoint'],2)
        self.assertGreater(max(r['sequence'] for r in self.shared.rows.values()),280000)
        audit=self.call(self.client(),'audit')
        self.assertEqual(audit['verifiedFileRounds'],2)
        self.assertEqual(audit['statistics']['stakeRaw'],50)
    def test_shard_cannot_write_another_shards_range(self):
        c=self.client();own=self.claim(c,1)
        with self.assertRaisesRegex(Rejected,'SEQUENCE_GAP'):self.begin(c,1,own,2)
        self.assertIsNone(c.store.pending())
    def test_source_failure_stops_every_shard_after_preserving_known_response(self):
        a,b=self.client(),self.client();oa,ob=self.claim(a,0),self.claim(b,1)
        seq=b.store.journaled()+1;self.begin(b,1,ob,seq)
        self.call(a,'fail',0,**oa,category='source_http',cooldownUntil=2000)
        following={'sequence':seq+1,'attempt':'00000000-0000-0000-0000-000000000999','startBalanceRaw':99975,'requestPayload':payload('BET')}
        result=self.call(b,'exchange_journal',1,**ob,sequence=seq,step=step(),normalized=settled(raw()),following=following)
        self.assertTrue(result['stopRequested']);self.assertIsNone(b.store.pending())
        self.call(b,'release',1,**ob)
        with self.assertRaisesRegex(Rejected,'GLOBAL_SOURCE_STOPPED'):self.claim(self.client(),2)
        result=self.call(self.client(),'status')
        self.assertEqual(result['status'],'halted');self.assertEqual(result['checkpoint'],2)
    def test_unknown_bet_recovery_halts_pool_without_resending(self):
        c=self.client();own=self.claim(c,0);self.begin(c,0,own,2);self.clock[0]+=601
        with self.assertRaisesRegex(Rejected,'SOURCE_OUTCOME_UNKNOWN'):self.claim(self.client(),0,owner='resume')
        self.assertEqual(self.call(self.client(),'status')['status'],'halted')
        self.assertIsNotNone(c.store.pending())
    def test_global_stop_preserves_unfinished_free_game_without_next_intent(self):
        c=self.client();own=self.claim(c,0);self.begin(c,0,own,2);c.halt('source_http')
        result=self.call(c,'exchange_journal',0,**own,sequence=2,step=step(remaining=2),following={'sequence':2,'requestPayload':payload('FREE_GAME')})
        self.assertFalse(result['complete']);self.assertTrue(result['stopRequested'])
        self.assertIsNone(c.store.pending()['awaiting'])
        self.assertEqual(len(c.store.pending()['raw']['steps']),1)
        with self.assertRaisesRegex(Rejected,'GLOBAL_SOURCE_STOPPED'):self.call(c,'intent',0,**own,sequence=2,requestPayload=payload('FREE_GAME'))
    def test_lost_mongo_ack_recovers_only_same_session_and_never_duplicates(self):
        c=self.client();own=self.claim(c,19);self.record(c,19,own);self.shared.lose_ack=True
        with self.assertRaisesRegex(Rejected,'TRIAL_MONGO_FAILED'):self.call(c,'flush',19,**own)
        self.call(c,'fail',19,**own,category='storage')
        d=self.client();od=self.claim(d,19,owner='resume');self.call(d,'release',19,**od)
        self.assertEqual(len(self.shared.rows),2)
        self.assertEqual(self.call(self.client(),'audit')['verifiedFileRounds'],2)
    def test_legacy_worker_cannot_claim_after_parallel_activation(self):
        with self.assertRaisesRegex(Rejected,'PARALLEL_SHARD_REQUIRED'):self.call(self.client(),'claim',owner='old')
    def test_exact_shard_quota_flushes_and_prevents_extra_bet(self):
        spec={'id':19,'start':299999,'end':300000}
        tmp=tempfile.TemporaryDirectory(prefix='sg-parallel-quota-test-')
        store=TrialStore(tmp.name,self.factory((299999,300000)),lambda:self.clock[0],shard=spec)
        base={'schema':SCHEMA,'trialId':TRIAL}
        lease=store.dispatch({**base,'op':'claim','owner':'end','sessionHash':'a'*64,'commitSha':'b'*40})
        own={'owner':'end','epoch':lease['epoch']}
        try:
            for seq in (299999,300000):
                store.dispatch({**base,**own,'op':'begin','sequence':seq,'attempt':f'00000000-0000-0000-0000-{seq:012d}','startBalanceRaw':100000,'requestPayload':payload('BET')})
                store.dispatch({**base,**own,'op':'exchange_journal','sequence':seq,'step':step(),'normalized':settled(raw())})
            self.assertEqual(store.state()['checkpoint'],300000)
            with self.assertRaisesRegex(Rejected,'ROUND_ALREADY_PENDING'):store.dispatch({**base,**own,'op':'begin','sequence':300001})
            self.assertEqual(store.dispatch({**base,**own,'op':'release'})['status'],'complete')
            self.assertEqual(store.dispatch({**base,'op':'audit'})['verifiedFileRounds'],2)
        finally:store.close();tmp.cleanup()


if __name__=='__main__':unittest.main()
