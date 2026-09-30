import copy
import pathlib
import sys
import unittest
from types import SimpleNamespace
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from mongo_only_gateway import Gateway, Refused


class Collection:
    def __init__(self): self.rows = {}
    def insert_one(self, row):
        if row['_id'] in self.rows:
            e=Exception();e.code=11000;raise e
        self.rows[row['_id']] = copy.deepcopy(row)
    def find_one(self, query, **_): return copy.deepcopy(self.rows.get(query['_id']))
    def find(self, query, **_):
        class Cursor(list):
            def limit(self,n):return self[:n]
        return Cursor(copy.deepcopy([self.rows[k] for k in query['_id']['$in'] if k in self.rows]))
    def replace_one(self, query, row):
        old=self.rows.get(query['_id']);matched=old is not None and old['version']==query['version']
        if matched:self.rows[row['_id']]=copy.deepcopy(row)
        return SimpleNamespace(matched_count=int(matched))


class GatewayTests(unittest.TestCase):
    def setUp(self):
        self.db={x:Collection() for x in ('capture_state_v2','capture_journal_v2','official_rounds')}
        self.manifest={'schema':'sg-mongo-only-access-v2','metadataWritesEnabled':True,'roundWritesEnabled':False,
                       'trials':{'sg_r1_20260928_32723':{'group':'primary','gameId':32723,'runtimeGameId':33123,'target':299900}}}
        self.g=Gateway(self.db,'primary',self.manifest,sample=lambda:{'rawCounters':True})
    def call(self,op,**kw):return self.g.dispatch({'schema':'sg-mongo-only-v2','op':op,**kw})
    def test_cas_excludes_stale_update(self):
        self.assertTrue(self.call('create',collection='state',key='worker:0',value={'a':1})['created'])
        self.assertFalse(self.call('create',collection='state',key='worker:0',value={'a':99})['created'])
        self.assertTrue(self.call('cas',collection='state',key='worker:0',version=0,value={'a':2})['replaced'])
        self.assertFalse(self.call('cas',collection='state',key='worker:0',version=0,value={'a':99})['replaced'])
        self.assertEqual(self.call('read',collection='state',key='worker:0')['value'],{'a':2})
    def test_group_cannot_be_selected_in_rpc(self):
        with self.assertRaisesRegex(Refused,'GROUP_IS_NOT_CLIENT_INPUT'):self.call('hello',group='secondary')
        self.call('create',collection='state',key='worker:0',value={'private':True})
        other=Gateway(self.db,'secondary',self.manifest)
        self.assertIsNone(other.dispatch({'schema':'sg-mongo-only-v2','op':'read','collection':'state','key':'worker:0'}))
    def test_no_arbitrary_database_query_or_shell(self):
        for op in ('eval','delete','drop','select','exchange_journal','audit','aggregate'):
            with self.assertRaises(Refused):self.call(op)
        for alias in ('simulate','official_rounds','admin','$where'):
            with self.assertRaises(Refused):self.call('create',collection=alias,key='key',value={})
        with self.assertRaises(Refused):self.call('read',collection='state',key='../secondary')
    def test_disabled_write_manifest_stays_closed(self):
        self.manifest['metadataWritesEnabled']=False
        with self.assertRaisesRegex(Refused,'METADATA_WRITES_DISABLED'):self.call('create',collection='state',key='x',value={})
        with self.assertRaisesRegex(Refused,'ROUND_WRITES_DISABLED'):self.call('rounds_insert',trialId='sg_r1_20260928_32723',records=[])
    def test_round_scope_and_sampling_do_not_invoke_business_code(self):
        self.assertEqual(self.call('resources'),{'rawCounters':True})
        with self.assertRaisesRegex(Refused,'GROUP_SCOPE_DENIED'):
            Gateway(self.db,'secondary',self.manifest).dispatch({'schema':'sg-mongo-only-v2','op':'rounds_read','trialId':'sg_r1_20260928_32723','ids':[]})
        source=pathlib.Path(sys.modules['mongo_only_gateway'].__file__).read_text()
        for imported in ('import sqlite3','from trial_store','from campaign','from round_fields','subprocess'):
            self.assertNotIn(imported,source)
    def test_shared_holds_are_read_only_and_fixed_to_the_two_groups(self):
        self.call('create',collection='state',key='global-hold',value={'active':True})
        holds=self.call('global_holds')
        self.assertTrue(holds[0]['value']['active']);self.assertIsNone(holds[1])
        with self.assertRaises(Refused):self.call('global_holds',group='secondary')
    def test_bulk_reads_are_bounded_and_group_scoped(self):
        self.call('create',collection='journal',key='receipt:1',value={'private':True})
        rows=self.call('read_many',collection='journal',keys=['receipt:1','receipt:2'])
        self.assertEqual([x['_id'] for x in rows],['primary/receipt:1'])
        for keys in ([],['x']*101,['x','x'],['secondary/private'],[{'$where':'x'}]):
            with self.assertRaises(Refused):self.call('read_many',collection='state',keys=keys)
        other=Gateway(self.db,'secondary',self.manifest)
        self.assertEqual(other.dispatch({'schema':'sg-mongo-only-v2','op':'read_many','collection':'journal','keys':['receipt:1']}),[])
    def test_control_read_returns_only_fixed_documents_and_checks_trial_scope(self):
        for key in ('global-hold','campaign','pool:sg_r1_20260928_32723','unrelated'):
            self.call('create',collection='state',key=key,value={})
        rows=self.call('control_read',trialId='sg_r1_20260928_32723')
        self.assertEqual(len(rows),3)
        self.assertNotIn('primary/unrelated',[x['_id'] for x in rows])
        with self.assertRaises(Refused):self.call('control_read',trialId='not-approved')
        with self.assertRaises(Refused):Gateway(self.db,'secondary',self.manifest).dispatch({'schema':'sg-mongo-only-v2','op':'control_read','trialId':'sg_r1_20260928_32723'})

    def test_separate_sequence_ceiling_is_fixed_to_reviewed_pearl_storage_scope(self):
        trial='sg_r1_20260930_32795'
        self.manifest['trials'][trial]={'group':'primary','gameId':32795,'runtimeGameId':33155,'target':300000,'maxSequence':600000}
        self.assertEqual(self.g.scope({'trialId':trial})[1]['target'],300000)
        for value in (600001, True, 300000):
            self.manifest['trials'][trial]['maxSequence']=value
            with self.assertRaisesRegex(Refused,'SEQUENCE_SCOPE_DENIED'):self.g.scope({'trialId':trial})
        self.manifest['trials']['sg_r1_20260928_32723']['maxSequence']=600000
        with self.assertRaisesRegex(Refused,'SEQUENCE_SCOPE_DENIED'):self.g.scope({'trialId':'sg_r1_20260928_32723'})


if __name__=='__main__':unittest.main()
