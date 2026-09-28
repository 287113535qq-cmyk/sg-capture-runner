from contextlib import closing
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from campaign import Campaign, for_group
from group_campaign import POLICY
from huff_group_recovery import recover, REVIEW
from runner_federation import TOPOLOGY, topology_path
from store import canonical, digest, Rejected
from trial_store import TrialStore
from work_pool import WorkPool
from test_pool_trial import ScopedMemory
from test_trial import MemoryMongo


class Scope(ScopedMemory):
    def close(self):pass


class HuffRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.now=1000.0;self.clock=lambda:self.now
        disk=patch('campaign.shutil.disk_usage',return_value=type('Disk',(),{'free':100*1024**3})())
        disk.start();self.addCleanup(disk.stop)
        c=Campaign(self.root,clock=self.clock);self.plans=c.plans
        c.db.executescript('''CREATE TABLE group_control(name TEXT PRIMARY KEY,enabled INTEGER,active_game INTEGER UNIQUE,
            reason TEXT,audit_owner TEXT,audit_until REAL,config_hash TEXT);
            CREATE TABLE dispatch_control(id INTEGER PRIMARY KEY,enabled INTEGER,reason TEXT);
            INSERT INTO dispatch_control VALUES(1,0,'SOURCE_OR_STORAGE_REQUIRES_REVIEW');
            CREATE TABLE game_owners(game_id INTEGER PRIMARY KEY,group_name TEXT);''')
        for group,gid in [('primary',32714),('secondary',32717)]:
            c.db.execute('INSERT INTO group_control VALUES(?,0,?,?,NULL,0,?)',
                         (group,gid,'ACTIVE_GAME_REQUIRES_REVIEW',digest(c.config)))
            c.db.execute('INSERT INTO game_owners VALUES(?,?)',(gid,group))
            c.db.execute("UPDATE games SET status='active' WHERE game_id=?",(gid,))
        (c.directory/'independent-groups.json').write_bytes(canonical(POLICY));c.close()
        topology_path(self.root).write_bytes(canonical(TOPOLOGY))
        self.mongo=MemoryMongo();self.boundaries={};self.batch_paths={};self.pool_paths={}
        for group,gid,worker in [('primary',32714,14),('secondary',32717,37)]:
            plan=self.plans[str(gid)];directory=self.root/'trials'/plan['trialId']
            p=WorkPool(directory,plan['trialId'],plan['target'],self.clock);p.enable_by_operator()
            self.addCleanup(p.close)
            (directory/'pool-plan.json').write_bytes(canonical(plan))
            lease=p.register(worker,f'{worker+1:064x}','fixture');batch=p.take(lease)
            spec={k:batch[k] for k in ('id','worker','start','end')}
            store=TrialStore(self.root,self.factory(plan,(batch['start'],batch['end'])),self.clock,plan=plan,batch=spec)
            self.addCleanup(store.close)
            base={'schema':plan['schema'],'trialId':plan['trialId']}
            def call(op,**data):return store.dispatch({**base,'op':op,**data})
            owned={'owner':'fixture','epoch':call('claim',owner='fixture',sessionHash=f'{worker+1:064x}',commitSha='b'*40)['epoch']}
            first=self.step(plan,False)
            call('begin',**owned,sequence=1,attempt='00000000-0000-0000-0000-000000000001',startBalanceRaw=100000,requestPayload=first['requestPayload'])
            raw={'fixtureOnly':False,'protocol':'nextgen','sourceKey':plan['sourceKey'],'roundFieldsVersion':'sg-round-fields-v1',
                 'startBalanceRaw':100000,'steps':[first]}
            call('exchange_journal',**owned,sequence=1,step=first,normalized=store.field_settled(raw));call('release',**owned)
            owned={'owner':'resumed','epoch':call('claim',owner='resumed',sessionHash=f'{worker+1:064x}',commitSha='b'*40)['epoch']}
            trigger=self.step(plan,True)
            call('begin',**owned,sequence=2,attempt='00000000-0000-0000-0000-000000000002',startBalanceRaw=100000,requestPayload=trigger['requestPayload'])
            try:call('exchange_journal',**owned,sequence=2,step=trigger)
            except Rejected:self.assertEqual(gid,32717)
            store.db.execute("UPDATE trial SET status='halted',failure='PROTOCOL_VALIDATION_FAILED',lease_until=0")
            self.boundaries[group]={'game':gid,'complete':1,'committed':1,'batch':batch['id'],'worker':worker,'sequence':2,
                                    'rawHash':digest(store.pending()['raw'])}
            self.batch_paths[group]=store.root/'state.sqlite3';self.pool_paths[group]=directory/'work-pool.sqlite3'
            store.close();p.halt('BATCH_HALTED');p.db.execute('UPDATE workers SET lease_until=0');p.close()
        pins=patch('huff_group_recovery.BOUNDARIES',self.boundaries);pins.start();self.addCleanup(pins.stop)
        self.backup=self.root/'reviews/recovery'

    def step(self,plan,feature):
        request={**plan['requestParams'],'PID':'gdmgcmfixture','MSGID':'BET'}
        p={'MSGID':'BET','IFG':0,'B':100000-plan['betRaw'],'AB':100000-plan['betRaw'],'TW':0,'FID':''}
        if feature:p.update(FID='1|' if plan['gameId']==32714 else '2|',NFG=6 if plan['gameId']==32714 else 1,TFG=6 if plan['gameId']==32714 else 1,CFGG=0)
        payload='&'.join(f'{k}={v}' for k,v in p.items());xml=ET.Element('GDMRESPONSE')
        ET.SubElement(xml,'SUCCESS').text='true';ET.SubElement(xml,'PAYLOAD').text=payload
        return {'msgId':'BET','requestPayload':'&'.join(f'{k}={v}' for k,v in request.items()),'responsePayload':payload,
                'responseXml':ET.tostring(xml,encoding='unicode'),'elapsedMs':1}

    def factory(self,plan,scope):return Scope(self.mongo,plan,scope)
    def review(self,proof=None,apply=False):return recover(self.root,self.factory,self.backup,proof,apply,self.clock)
    def change(self,path,query):
        with closing(sqlite3.connect(path)) as db:db.execute(query);db.commit()
    def rows(self,path,table):
        with closing(sqlite3.connect(path)) as db:return db.execute('SELECT * FROM '+table+' ORDER BY rowid').fetchall()

    def test_backup_preserves_both_bets_and_only_primary_reopens(self):
        before={g:{t:self.rows(p,t) for t in ('trial','pending','receipts')} for g,p in self.batch_paths.items()}
        proof=self.review();self.assertFalse(self.backup.exists())
        result=self.review(proof,True);self.assertTrue(result['applied'])
        for group in before:
            for table in ('pending','receipts'):
                self.assertEqual(before[group][table],self.rows(self.batch_paths[group],table))
            saved=self.backup/group/'batches/1/state.sqlite3'
            for table in before[group]:self.assertEqual(before[group][table],self.rows(saved,table))
        self.assertEqual(before['secondary']['trial'],self.rows(self.batch_paths['secondary'],'trial'))
        for group,enabled in [('primary',True),('secondary',False)]:
            c=for_group(self.root,group,clock=self.clock)
            try:self.assertEqual(c.allowed(),enabled)
            finally:c.close()
        with self.assertRaisesRegex(Rejected,'ALREADY_RECORDED'):self.review(proof,True)

    def test_stale_proof_and_changed_session_are_rejected(self):
        proof=self.review();self.now+=301
        with self.assertRaisesRegex(Rejected,'EXPIRED'):self.review(proof,True)
        self.now-=301
        self.change(self.pool_paths['primary'],"UPDATE workers SET session_hash='changed'")
        with self.assertRaisesRegex(Rejected,'SESSION_BINDING'):self.review(proof,True)
        self.assertFalse(self.backup.exists())

    def test_any_group_live_lease_or_unknown_response_prevents_recovery(self):
        for group in ('primary','secondary'):
            with self.subTest(group=group):
                self.change(self.pool_paths[group],'UPDATE workers SET lease_until=2000')
                with self.assertRaisesRegex(Rejected,'ACTIVE_WORKER'):self.review()
                self.change(self.pool_paths[group],'UPDATE workers SET lease_until=0')
                self.change(self.batch_paths[group],"UPDATE pending SET awaiting='unknown'")
                with self.assertRaisesRegex(Rejected,'UNKNOWN_SOURCE_OUTCOME'):self.review()
                self.change(self.batch_paths[group],'UPDATE pending SET awaiting=NULL')

    def test_unreviewed_failure_global_reason_and_snapshot_change_rejected(self):
        proof=self.review()
        self.change(self.batch_paths['secondary'],"UPDATE trial SET failure='source_http'")
        with self.assertRaisesRegex(Rejected,'FAILURE_CHANGED'):self.review()
        self.change(self.batch_paths['secondary'],"UPDATE trial SET failure='PROTOCOL_VALIDATION_FAILED'")
        self.change(self.pool_paths['primary'],'UPDATE workers SET observed_rate=99')
        with self.assertRaisesRegex(Rejected,'PROOF_CHANGED'):self.review(proof,True)
        path=self.root/'campaigns/sg_round_one_20260928/queue.sqlite3'
        self.change(path,"UPDATE dispatch_control SET reason='DISK_RESERVE_REACHED'")
        with self.assertRaisesRegex(Rejected,'GLOBAL_PAUSE_CHANGED'):self.review()

    def test_modified_complete_record_or_mongo_document_cannot_recover(self):
        key=next(iter(self.mongo.rows));self.mongo.rows[key]['bonus']=99
        with self.assertRaisesRegex(Rejected,'MONGO_CONTENT'):self.review()

    def test_failure_between_db_updates_leaves_global_closed_and_event_recorded(self):
        proof=self.review()
        real_connect=sqlite3.connect
        def interrupted(path,*args,**kwargs):
            if path==self.pool_paths['primary'] and kwargs.get('isolation_level') is None:raise RuntimeError('simulated interruption')
            return real_connect(path,*args,**kwargs)
        with patch('huff_group_recovery.sqlite3.connect',side_effect=interrupted):
            with self.assertRaisesRegex(RuntimeError,'simulated interruption'):self.review(proof,True)
        c=for_group(self.root,'primary',clock=self.clock)
        try:
            self.assertFalse(c.allowed());self.assertEqual(c.db.execute('SELECT applied FROM group_protocol_reviews').fetchone()[0],0)
        finally:c.close()
