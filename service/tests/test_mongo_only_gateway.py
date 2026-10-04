import copy
import pathlib
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from mongo_only_gateway import Gateway, Refused


class Collection:
    def __init__(self): self.rows = {}
    def insert_one(self, row):
        if row['_id'] in self.rows:
            e=Exception();e.code=11000;raise e
        self.rows[row['_id']] = copy.deepcopy(row)
    def find_one(self, query, **_): return copy.deepcopy(self.rows.get(query['_id']))
    def find(self, query, projection=None, **_):
        class Cursor(list):
            def limit(self,n):return self[:n]
        rows=copy.deepcopy([self.rows[k] for k in query['_id']['$in'] if k in self.rows])
        if projection:
            out=[]
            for row in rows:
                projected={}
                for path,include in projection.items():
                    if not include:continue
                    parts=path.split('.');src=row;dest=projected
                    for part in parts:
                        if not isinstance(src,dict) or part not in src:break
                        src=src[part]
                    else:
                        for part in parts[:-1]:dest=dest.setdefault(part,{})
                        dest[parts[-1]]=copy.deepcopy(src)
                out.append(projected)
            rows=out
        return Cursor(rows)
    def replace_one(self, query, row):
        old=self.rows.get(query['_id']);matched=old is not None and old['version']==query['version']
        if matched:self.rows[row['_id']]=copy.deepcopy(row)
        return SimpleNamespace(matched_count=int(matched))
    def bulk_write(self, operations, ordered):
        assert ordered is True
        inserted = 0
        for operation in operations:
            assert operation._upsert is True and set(operation._filter) == {'_id'}
            document = operation._doc['$setOnInsert']
            assert document['_id'] == operation._filter['_id']
            if document['_id'] not in self.rows:
                self.rows[document['_id']] = copy.deepcopy(document);inserted += 1
        return SimpleNamespace(upserted_count=inserted)
    def update_one(self, query, update, upsert=False):
        assert upsert is False
        old=self.rows.get(query['_id']);matched=old is not None and old['version']==query['version']
        if matched:
            row=copy.deepcopy(old)
            for path,value in update.get('$set',{}).items():
                parts=path.split('.');node=row
                for part in parts[:-1]:node=node.setdefault(part,{})
                node[parts[-1]]=copy.deepcopy(value)
            for path in update.get('$unset',{}):
                parts=path.split('.');node=row
                for part in parts[:-1]:node=node.get(part,{})
                node.pop(parts[-1],None)
            row['version']+=update['$inc']['version'];self.rows[query['_id']]=row
        return SimpleNamespace(matched_count=int(matched))


class GatewayTests(unittest.TestCase):
    def setUp(self):
        self.db={x:Collection() for x in ('capture_state_v2','capture_journal_v2','official_rounds')}
        self.manifest={'schema':'sg-mongo-only-access-v2','metadataWritesEnabled':True,'roundWritesEnabled':False,
                       'trials':{'sg_r1_20260928_32723':{'group':'primary','gameId':32723,'runtimeGameId':33123,'target':299900}}}
        self.g=Gateway(self.db,'primary',self.manifest,sample=lambda:{'rawCounters':True})
    def call(self,op,**kw):return self.g.dispatch({'schema':'sg-mongo-only-v2','op':op,**kw})
    def test_shared_rolling_namespace_reuses_primary_tasks_without_aliasing_legacy_metadata(self):
        self.manifest['rollingSharedNamespace']='primary'
        other=Gateway(self.db,'secondary',self.manifest)
        call=lambda op,**kw:other.dispatch({'schema':'sg-mongo-only-v2','op':op,**kw})
        key='rolling-task:'+'a'*64+':worker:1'
        self.call('create',collection='state',key=key,value={'status':'pending','oldPrefixCount':500})
        before=call('read',collection='state',key=key)
        self.assertEqual(before['_id'],'primary/'+key)
        self.assertTrue(call('cas',collection='state',key=key,version=before['version'],value={'status':'running','oldPrefixCount':500})['replaced'])
        self.assertEqual(self.call('read',collection='state',key=key)['value']['oldPrefixCount'],500)
        call('create',collection='state',key='campaign',value={'preserved':'secondary'})
        self.assertIsNone(self.call('read',collection='state',key='campaign'))
        self.assertEqual(call('read',collection='state',key='campaign')['_id'],'secondary/campaign')
        self.assertEqual(call('hello')['group'],'secondary')
        self.assertEqual(call('hello')['rollingNamespace'],'primary')
    def test_secondary_shared_source_records_are_insert_only_but_coordinator_formal_and_cleanup_writes_stay_primary(self):
        self.manifest.update(rollingSharedNamespace='primary',rollingJournalBatchEnabled=True,rollingCleanupEnabled=True)
        other=Gateway(self.db,'secondary',self.manifest)
        call=lambda op,**kw:other.dispatch({'schema':'sg-mongo-only-v2','op':op,**kw})
        key='rolling-source:'+'a'*64+':0000000001:intent'
        rows=[{'key':key,'value':{'requestHash':'b'*64}}]
        native=SimpleNamespace(UpdateOne=lambda q,u,upsert:SimpleNamespace(_filter=q,_doc=u,_upsert=upsert))
        with patch.dict(sys.modules,{'pymongo':native}):
            self.assertEqual(call('rolling_journal_insert',records=rows)['inserted'],1)
            self.assertEqual(call('rolling_journal_insert',records=rows)['inserted'],0)
        self.assertEqual(self.call('read',collection='journal',key=key)['_id'],'primary/'+key)
        for alias,key in [('state','rolling-source'),('journal','rolling-activation:'+'a'*64+':complete'),('journal','rolling-ended:queue:123:1'),('journal','rolling-merge:'+'b'*64)]:
            with self.assertRaisesRegex(Refused,'COORDINATOR_WRITE_DENIED'):call('create',collection=alias,key=key,value={})
        with self.assertRaisesRegex(Refused,'COORDINATOR_WRITE_DENIED'):call('rolling_journal_delete',keys=[rows[0]['key']])
        with self.assertRaisesRegex(Refused,'GROUP_IS_NOT_CLIENT_INPUT'):call('read',collection='state',key='campaign',group='primary')
    def test_shared_namespace_cannot_be_enabled_by_a_request_or_an_unreviewed_manifest_value(self):
        other=Gateway(self.db,'secondary',self.manifest)
        key='rolling-task:'+'a'*64+':worker:1'
        self.call('create',collection='state',key=key,value={'x':1})
        for value in [None,'secondary','both',True]:
            self.manifest['rollingSharedNamespace']=value
            self.assertIsNone(other.dispatch({'schema':'sg-mongo-only-v2','op':'read','collection':'state','key':key,'rollingSharedNamespace':'primary'}))
    def test_rolling_batch_is_capability_gated_insert_only_and_group_scoped(self):
        rows=[{'key':'rolling-stage:'+'a'*64+':0000000001','value':{'private':1}},
              {'key':'rolling-source:'+'a'*64+':0000000001:intent','value':{'private':2}}]
        with self.assertRaisesRegex(Refused,'ROLLING_BATCH_DISABLED'):self.call('rolling_journal_insert',records=rows)
        self.manifest['rollingJournalBatchEnabled']=True
        native=SimpleNamespace(UpdateOne=lambda q,u,upsert:SimpleNamespace(_filter=q,_doc=u,_upsert=upsert))
        with patch.dict(sys.modules,{'pymongo':native}):
            self.assertEqual(self.call('rolling_journal_insert',records=rows),{'inserted':2})
            changed=copy.deepcopy(rows);changed[0]['value']={'private':'different'}
            self.assertEqual(self.call('rolling_journal_insert',records=changed),{'inserted':0})
        self.assertEqual(self.call('read_many',collection='journal',keys=[r['key'] for r in rows]),
                         [{'_id':'primary/'+r['key'],'version':0,'value':r['value']} for r in rows])
        other=Gateway(self.db,'secondary',self.manifest)
        self.assertEqual(other.dispatch({'schema':'sg-mongo-only-v2','op':'read_many',
                         'collection':'journal','keys':[r['key'] for r in rows]}),[])
        self.assertTrue(self.call('hello')['rollingJournalBatchEnabled'])
    def test_rolling_batch_rejects_bad_keys_injection_duplicates_and_bounds_before_writing(self):
        self.manifest['rollingJournalBatchEnabled']=True
        row={'key':'rolling-stage:'+'a'*64+':0000000001','value':{'a':1}}
        requests=[{}, {'records':[]},{'records':[row]*2},{'records':[row]*101},
                  {'records':[{'key':'pool:x','value':{}}]}, {'records':[{'key':row['key'],'value':[]}]},
                  {'records':[row],'collection':'official_rounds'}, {'records':[row],'query':{}},
                  {'records':[{**row,'version':0}]}]
        for request in requests:
            with self.assertRaises(Refused):self.call('rolling_journal_insert',**request)
            self.assertEqual(self.db['capture_journal_v2'].rows,{})
    def test_rolling_task_seed_is_insert_only_with_exact_22_task_names(self):
        self.manifest['rollingJournalBatchEnabled']=True
        rows=[{'key':'rolling-task:'+'a'*64+':'+name,'value':{'status':'pending'}}
              for name in ['canary:1','canary:2']+['worker:'+str(i) for i in range(1,21)]]
        native=SimpleNamespace(UpdateOne=lambda q,u,upsert:SimpleNamespace(_filter=q,_doc=u,_upsert=upsert))
        with patch.dict(sys.modules,{'pymongo':native}):
            self.assertEqual(self.call('rolling_task_insert',records=rows),{'inserted':22})
            self.db['capture_state_v2'].rows['primary/'+rows[0]['key']]['value']['status']='running'
            self.assertEqual(self.call('rolling_task_insert',records=rows),{'inserted':0})
        self.assertEqual(self.db['capture_state_v2'].rows['primary/'+rows[0]['key']]['value']['status'],'running')
        for name in ['worker:0','worker:21','canary:3','worker:01']:
            with self.assertRaises(Refused):self.call('rolling_task_insert',records=[{**rows[0],'key':'rolling-task:'+'a'*64+':'+name}])
    def test_rolling_copy_uses_fixed_native_pipeline_and_exact_root_trial_identity(self):
        trial='sg_ag_r1_20261004_32723'
        self.manifest['trials'][trial]={'group':'primary','rolling':True,'gameId':32723,'runtimeGameId':33123,'target':300000,'maxSequence':300140}
        row={'key':'rolling-stage:'+'a'*64+':0000000001','id':'b'*64,'contentHash':'c'*64}
        with self.assertRaises(Refused):self.call('rolling_stage_copy',trialId=trial,records=[row])
        self.manifest.update(roundWritesEnabled=True,rollingJournalBatchEnabled=True)
        captured=[]
        self.db['capture_journal_v2'].aggregate=lambda pipeline,**kwargs:captured.append((pipeline,kwargs)) or []
        self.assertEqual(self.call('rolling_stage_copy',trialId=trial,records=[row]),{'acknowledged':True})
        pipeline,options=captured[0]
        self.assertEqual(pipeline[0]['$match']['$and'][0],{'$or':[{'_id':'primary/'+row['key'],'value.record._id':row['id'],'value.record.contentHash':row['contentHash']}]})
        self.assertEqual(pipeline[0]['$match']['$and'][1],{'value.record.trialId':trial,'value.record.gameId':32723,
            'value.record.runtimeGameId':33123,'value.record.fixtureOnly':False,'value.record.buy':0,
            'value.record.sequence':{'$gte':1,'$lte':300140}})
        self.assertEqual(pipeline[1],{'$replaceRoot':{'newRoot':'$value.record'}})
        self.assertEqual(pipeline[2],{'$merge':{'into':'official_rounds','on':'_id','whenMatched':'keepExisting','whenNotMatched':'insert'}})
        self.assertEqual(options,{'maxTimeMS':30000})
        for change in ({'query':{}},{'records':[row]*2},{'records':[{**row,'key':'secondary/private'}]},
                       {'records':[{**row,'id':{'$where':'bad'}}]},{'records':[{**row,'extra':1}]}):
            with self.assertRaises(Refused):self.call('rolling_stage_copy',**{'trialId':trial,'records':[row],**change})
        self.assertEqual(len(captured),1)
        self.manifest['trials'][trial]['maxSequence']=999999
        with self.assertRaises(Refused):self.call('rolling_stage_copy',trialId=trial,records=[row])
    def test_rolling_cleanup_is_separately_enabled_and_cannot_delete_receipts_or_other_groups(self):
        keys=['rolling-stage:'+'a'*64+':0000000001','rolling-source:'+'b'*64+':0000000001:response']
        with self.assertRaises(Refused):self.call('rolling_journal_delete',keys=keys)
        self.manifest['rollingCleanupEnabled']=True;captured=[]
        self.db['capture_journal_v2'].delete_many=lambda query:captured.append(query) or SimpleNamespace(deleted_count=2)
        self.assertEqual(self.call('rolling_journal_delete',keys=keys),{'deleted':2})
        self.assertEqual(captured,[{'_id':{'$in':['primary/'+k for k in keys]}}])
        for invalid in ([],keys*2,['campaign'],['secondary/'+keys[0]],
                        ['rolling-source:'+'b'*64+':0000000000:closed'],[{}],keys*501):
            with self.assertRaises(Refused):self.call('rolling_journal_delete',keys=invalid)
        self.assertEqual(len(captured),1)
    def test_native_round_count_is_fixed_trial_only(self):
        self.db['official_rounds'].count_documents=lambda query,**kw: 73 if query=={'trialId':'sg_r1_20260928_32723'} and kw=={'maxTimeMS':10000} else self.fail('unexpected query')
        self.assertEqual(self.call('rounds_count',trialId='sg_r1_20260928_32723'),{'count':73})
        for extra in ({'query':{}},{'group':'secondary'},{'limit':999}):
            with self.assertRaises(Refused):self.call('rounds_count',trialId='sg_r1_20260928_32723',**extra)
    def test_rolling_game_count_reads_legacy_trials_without_client_query_or_writes(self):
        trial='sg_ag_r1_20261004_32723'
        self.manifest['trials'][trial]={'group':'primary','rolling':True,'gameId':32723,
            'runtimeGameId':33123,'target':300000,'maxSequence':300140}
        with self.assertRaisesRegex(Refused,'ROUND_GAME_COUNT_DISABLED'):self.call('rounds_game_count',trialId=trial)
        self.manifest['rollingGameCountEnabled']=True
        queries=[]
        def count(query,**kw):
            queries.append(query);self.assertEqual(kw,{'hint':'rolling_game_count','maxTimeMS':10000})
            # Historical rows have another trial and are still included.
            rows=[{'gameId':32723,'trialId':'old-trial'}, {'gameId':32723,'trialId':trial},
                  {'gameId':32724,'trialId':'other-trial'}]
            return sum(r['gameId']==query.get('gameId') for r in rows)
        self.db['official_rounds'].count_documents=count
        self.assertEqual(self.call('rounds_game_count',trialId=trial),{'gameId':32723,'count':2})
        self.assertEqual(queries,[{'gameId':32723}])
        for extra in ({'gameId':32724},{'query':{}},{'trialId':'unknown'}, {'group':'secondary'}):
            with self.assertRaises(Refused):self.call('rounds_game_count',**{'trialId':trial,**extra})
        with self.assertRaises(Refused):self.call('rounds_game_count',trialId='sg_r1_20260928_32723')
        secondary=Gateway(self.db,'secondary',self.manifest)
        with self.assertRaises(Refused):secondary.dispatch({'schema':'sg-mongo-only-v2','op':'rounds_game_count','trialId':trial})
        self.assertEqual(queries,[{'gameId':32723}]);self.assertTrue(self.call('hello')['rollingGameCountEnabled'])
        self.assertTrue(all(c.rows=={} for c in self.db.values()))
    def test_rolling_baseline_projection_is_two_fixed_campaigns_only_and_readonly(self):
        with self.assertRaises(Refused):self.call('rolling_campaign_baselines')
        self.manifest['rollingGameCountEnabled']=True
        self.db['capture_state_v2'].rows['primary/private']={'_id':'primary/private','value':{'secret':True}}
        before=copy.deepcopy(self.db['capture_state_v2'].rows);calls=[]
        class Cursor(list):
            def limit(self,n):self.limit_count=n;return self[:n]
        def find(query,projection,**kw):
            calls.append((query,projection,kw));return Cursor([{'_id':'primary/campaign'},{'_id':'secondary/campaign'}])
        self.db['capture_state_v2'].find=find
        self.assertEqual(self.call('rolling_campaign_baselines'),[{'_id':'primary/campaign'},{'_id':'secondary/campaign'}])
        self.assertEqual(calls,[({'_id':{'$in':['primary/campaign','secondary/campaign']}},
            {'_id':1,'value.games.game_id':1,'value.games.baseline':1,'value.games.confirmed':1,'value.games.status':1},
            {'max_time_ms':10000})])
        for extra in ({'query':{}},{'group':'secondary'},{'gameId':32723},{'projection':{}}):
            with self.assertRaises(Refused):self.call('rolling_campaign_baselines',**extra)
        with self.assertRaises(Refused):Gateway(self.db,'secondary',self.manifest).dispatch(
            {'schema':'sg-mongo-only-v2','op':'rolling_campaign_baselines'})
        self.assertEqual(len(calls),1);self.assertEqual(before,self.db['capture_state_v2'].rows)
    def test_rolling_index_setup_is_fixed_native_storage_io_with_no_round_mutation(self):
        with self.assertRaises(Refused):self.call('rolling_game_index_prepare')
        self.manifest['rollingGameCountEnabled']=True;calls=[]
        def create(keys,**opts):
            calls.append((keys,opts));return opts['name']
        self.db['official_rounds'].create_index=create
        self.assertEqual(self.call('rolling_game_index_prepare'),{'indexName':'rolling_game_count'})
        self.assertEqual(calls,[([('gameId',1)],{'name':'rolling_game_count','unique':False,'maxTimeMS':300000})])
        for extra in ({'collection':'production'},{'keys':[('private',1)]},{'options':{}},{'group':'secondary'}):
            with self.assertRaises(Refused):self.call('rolling_game_index_prepare',**extra)
        with self.assertRaises(Refused):Gateway(self.db,'secondary',self.manifest).dispatch(
            {'schema':'sg-mongo-only-v2','op':'rolling_game_index_prepare'})
        self.assertEqual(len(calls),1);self.assertTrue(all(c.rows=={} for c in self.db.values()))
    def test_rolling_index_timeout_is_not_retried_and_preserves_rounds(self):
        self.manifest['rollingGameCountEnabled']=True;calls=[]
        self.db['official_rounds'].rows['preserved']={'gameId':32714,'sequence':1}
        before=copy.deepcopy(self.db['official_rounds'].rows)
        failure=RuntimeError('INDEX_BUILD_TIMEOUT')
        def create(keys,**opts):
            calls.append((keys,opts));raise failure
        self.db['official_rounds'].create_index=create
        with self.assertRaises(RuntimeError) as raised:self.call('rolling_game_index_prepare')
        self.assertIs(raised.exception,failure)
        self.assertEqual(len(calls),1)
        self.assertEqual(self.db['official_rounds'].rows,before)
    def test_delta_cas_requires_separate_capability_and_preserves_full_document(self):
        key='pool:sg_r1_20260928_32723'
        old={'history':[{'old':1}],'workers':{'0':{'lease':1,'active':{'id':2}},'1':{'lease':9}},'removed':True}
        self.call('create',collection='state',key=key,value=old)
        request=dict(collection='state',key=key,version=0,set={'workers.0.lease':3,'workers.0.active':None,'workers.0.extra':{}},unset=['removed'])
        with self.assertRaisesRegex(Refused,'DELTA_CAS_DISABLED'):self.call('cas_delta',**request)
        self.manifest['stateDeltaEnabled']=True
        self.assertTrue(self.call('cas_delta',**request)['replaced'])
        row=self.call('read',collection='state',key=key)
        self.assertEqual(row['version'],1);self.assertEqual(row['value']['workers']['1'],old['workers']['1'])
        self.assertEqual(row['value']['history'],old['history']);self.assertNotIn('removed',row['value'])
        self.assertIsNone(row['value']['workers']['0']['active'])
        self.assertFalse(self.call('cas_delta',**request)['replaced']);self.assertEqual(row,self.call('read',collection='state',key=key))
    def test_delta_cas_rejects_scope_injection_overlap_and_unbounded_payload_without_writes(self):
        self.manifest['stateDeltaEnabled']=True;key='pool:sg_r1_20260928_32723'
        self.call('create',collection='state',key=key,value={'a':1});before=copy.deepcopy(self.db['capture_state_v2'].rows)
        valid=dict(collection='state',key=key,version=0,set={'a':2},unset=[])
        invalid=[{'collection':'journal'},{'key':'campaign'},{'key':'pool:unknown'},{'version':True},{'query':{}},
                 {'set':{'a.$bad':1}},{'set':{'a..b':1}},{'set':{'__proto__.x':1}},
                 {'set':{'a':1,'a.b':2}},{'unset':['a']},{'set':{},'unset':[]},
                 {'set':{'a':'x'*65536}},{'set':{'k'+str(i):i for i in range(65)}}]
        for change in invalid:
            with self.assertRaises(Refused):self.call('cas_delta',**{**valid,**change})
            self.assertEqual(before,self.db['capture_state_v2'].rows)
    def test_delta_diagnostic_is_separate_from_existing_game_pools(self):
        self.manifest['stateDeltaEnabled']=True;key='validation:123:1:delta'
        self.call('create',collection='state',key=key,value={'stage':0,'retained':[1,2]})
        self.assertTrue(self.call('hello')['stateDeltaEnabled'])
        self.assertTrue(self.call('cas_delta',collection='state',key=key,version=0,set={'stage':1},unset=[])['replaced'])
        self.assertEqual(self.call('read',collection='state',key=key)['value'],{'stage':1,'retained':[1,2]})
        with self.assertRaises(Refused):self.call('cas_delta',collection='state',key='validation:123:1:other',version=0,set={'stage':1},unset=[])
    def test_parallel_primary_read_is_fixed_secondary_readonly(self):
        request={'schema':'sg-mongo-only-v2','op':'parallel_primary_boundary'}
        with self.assertRaisesRegex(Refused,'GROUP_SCOPE_DENIED'):self.g.dispatch(request)
        g=Gateway(self.db,'secondary',self.manifest)
        self.db['capture_state_v2'].rows['primary/campaign']={'_id':'primary/campaign','value':{'fixture':1}}
        self.db['capture_state_v2'].rows['primary/private']={'_id':'primary/private','value':{'unrelated':1}}
        before=copy.deepcopy(self.db['capture_state_v2'].rows)
        result=g.dispatch(request)
        self.assertEqual(result['state'],[before['primary/campaign']]);self.assertEqual(result['journal'],[])
        self.assertEqual(before,self.db['capture_state_v2'].rows)
        for extra in ({'keys':['primary/private']},{'trialId':'other'},{'query':{}},{'path':'x'}):
            with self.assertRaises(Refused):g.dispatch({**request,**extra})

    def test_observation_boundary_is_additive_fixed_readonly_not_client_selected(self):
        g=Gateway(self.db,'secondary',self.manifest)
        for run in (36753473985,36782298458,999):
            key=f'primary/capture-run:{run}:1'
            self.db['capture_state_v2'].rows[key]={'_id':key,'value':{'fixture':run}}
        request={'schema':'sg-mongo-only-v2','op':'parallel_primary_observation_boundary'}
        result=g.dispatch(request)
        self.assertEqual([r['value']['fixture'] for r in result['state']],[36782298458])
        self.assertEqual([r['value']['fixture'] for r in g.dispatch({**request,'op':'parallel_primary_boundary'})['state']],[36753473985])
        for extra in ({'runId':999},{'keys':['primary/private']},{'trialId':'anything'}):
            with self.assertRaises(Refused):g.dispatch({**request,**extra})
        with self.assertRaises(Refused):self.g.dispatch(request)

    def test_cas_excludes_stale_update(self):
        self.assertTrue(self.call('create',collection='state',key='worker:0',value={'a':1})['created'])
        self.assertFalse(self.call('create',collection='state',key='worker:0',value={'a':99})['created'])
        self.assertTrue(self.call('cas',collection='state',key='worker:0',version=0,value={'a':2})['replaced'])
        self.assertFalse(self.call('cas',collection='state',key='worker:0',version=0,value={'a':99})['replaced'])
        self.assertEqual(self.call('read',collection='state',key='worker:0')['value'],{'a':2})
    def test_rhino_peer_is_four_fixed_documents_under_existing_trial_scope(self):
        m=copy.deepcopy(self.manifest);m['trials']['sg_r1_20261001_32799']={'gameId':32799,'runtimeGameId':33159,'group':'primary','target':300000,'maxSequence':600000}
        g=Gateway(self.db,'secondary',m);request={'schema':'sg-mongo-only-v2','op':'parallel_primary_rhino_two_boundary'}
        for key in ['primary/count-run:sg_r1_20261001_32799:36835017232:1','primary/count-run:sg_r1_20261001_32799:999:1']:
            self.db['capture_journal_v2'].rows[key]={'_id':key,'value':{}}
        before=copy.deepcopy(self.db['capture_journal_v2'].rows)
        result=g.dispatch(request);self.assertEqual(len(result['journal']),1);self.assertIn('36835017232',result['journal'][0]['_id'])
        self.assertEqual(before,self.db['capture_journal_v2'].rows)
        for extra in ({'runId':999},{'keys':[]},{'trialId':'other'}):
            with self.assertRaises(Refused):g.dispatch({**request,**extra})
        with self.assertRaises(Refused):self.g.dispatch(request)
        m['trials']['sg_r1_20261001_32799']['maxSequence']=999999
        with self.assertRaises(Refused):Gateway(self.db,'secondary',m).dispatch(request)
    def test_group_cannot_be_selected_in_rpc(self):
        with self.assertRaisesRegex(Refused,'GROUP_IS_NOT_CLIENT_INPUT'):self.call('hello',group='secondary')
        self.call('create',collection='state',key='worker:0',value={'private':True})
        other=Gateway(self.db,'secondary',self.manifest)
        self.assertIsNone(other.dispatch({'schema':'sg-mongo-only-v2','op':'read','collection':'state','key':'worker:0'}))
    def test_count_peer_scopes_are_reciprocal_fixed_trial_reads_without_writes(self):
        for group,trial,game,runtime,target,op in (
            ('primary','sg_r1_20261001_32799',32799,33159,300000,'parallel_rhino_count_boundary'),
            ('secondary','sg_r1_20260928_32721',32721,33121,299850,'parallel_pyramids_count_boundary')):
            m=copy.deepcopy(self.manifest);m['trials'][trial]={'group':group,'gameId':game,'runtimeGameId':runtime,'target':target,'maxSequence':600000}
            reader=Gateway(self.db,'secondary' if group=='primary' else 'primary',m)
            request={'schema':'sg-mongo-only-v2','op':op,'run':'987654:1','activation':'a'*64}
            key=group+'/count-run:'+trial+':987654:1';unrelated=group+'/count-run:'+trial+':999:1'
            self.db['capture_journal_v2'].rows[key]={'_id':key,'value':{}}
            self.db['capture_journal_v2'].rows[unrelated]={'_id':unrelated,'value':{}}
            before=copy.deepcopy(self.db['capture_journal_v2'].rows)
            result=reader.dispatch(request);self.assertEqual([x['_id'] for x in result['journal']],[key])
            self.assertEqual(self.db['capture_journal_v2'].rows,before)
            with self.assertRaises(Refused):Gateway(self.db,group,m).dispatch(request)
            for extra in ({'keys':[]},{'trialId':trial},{'query':{}},{'run':'987654:2'},{'run':'../other'},{'activation':'bad'}):
                with self.assertRaises(Refused):reader.dispatch({**request,**extra})
            m['trials'][trial]['maxSequence']=999999
            with self.assertRaises(Refused):Gateway(self.db,reader.group,m).dispatch(request)
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
    def test_compact_control_projects_only_fresh_hold_campaign_and_exact_worker(self):
        trial='sg_r1_20260928_32723'
        for key,value in [('global-hold',{'active':False,'private':'omit'}),('campaign',{'enabled':True,'activeGame':32723,'games':['omit']}),
                          ('pool:'+trial,{'enabled':True,'failure':None,'confirmed':12,'workers':{'0':{'owner':'fresh','epoch':2},'1':{'owner':'peer'}},'countAllocation':{'large':'omit'}})]:
            self.call('create',collection='state',key=key,value=value)
        before=copy.deepcopy(self.db['capture_state_v2'].rows)
        rows=self.call('control_read',trialId=trial,workerId=0)
        pool=next(r for r in rows if '/pool:' in r['_id'])
        self.assertEqual(pool['value'],{'enabled':True,'failure':None,'confirmed':12,'workers':{'0':{'owner':'fresh','epoch':2}}})
        self.assertEqual(next(r for r in rows if r['_id']=='primary/global-hold')['value'],{'active':False})
        self.assertEqual(before,self.db['capture_state_v2'].rows)
        self.db['capture_state_v2'].rows['primary/global-hold']['value']['active']=True
        self.db['capture_state_v2'].rows['primary/pool:'+trial]['value']['workers']['0']['epoch']=3
        next_rows=self.call('control_read',trialId=trial,workerId=0)
        self.assertTrue(next(r for r in next_rows if r['_id']=='primary/global-hold')['value']['active'])
        self.assertEqual(next(r for r in next_rows if '/pool:' in r['_id'])['value']['workers']['0']['epoch'],3)
        for worker in (-1,160,True,'0',{'$where':'anything'}):
            with self.assertRaises(Refused):self.call('control_read',trialId=trial,workerId=worker)
        with self.assertRaises(Refused):self.call('control_read',workerId=0)

    def test_separate_sequence_ceiling_is_fixed_to_reviewed_pearl_storage_scope(self):
        trial='sg_r1_20260930_32795'
        self.manifest['trials'][trial]={'group':'primary','gameId':32795,'runtimeGameId':33155,'target':300000,'maxSequence':600000}
        self.assertEqual(self.g.scope({'trialId':trial})[1]['target'],300000)
        for value in (600001, True, 300000):
            self.manifest['trials'][trial]['maxSequence']=value
            with self.assertRaisesRegex(Refused,'SEQUENCE_SCOPE_DENIED'):self.g.scope({'trialId':trial})
        self.manifest['trials']['sg_r1_20260928_32723']['maxSequence']=600000
        with self.assertRaisesRegex(Refused,'SEQUENCE_SCOPE_DENIED'):self.g.scope({'trialId':'sg_r1_20260928_32723'})

    def test_rhino_sequence_ceiling_does_not_borrow_pearl_identity(self):
        trial='sg_r1_20261001_32799'
        scope={'group':'primary','gameId':32799,'runtimeGameId':33159,'target':300000,'maxSequence':600000}
        self.manifest['trials'][trial]=scope
        self.assertEqual(self.g.scope({'trialId':trial})[1]['target'],300000)
        for key,value in [('gameId',32795),('runtimeGameId',33155),('target',600000),('maxSequence',600001)]:
            original=scope[key];scope[key]=value
            with self.subTest(key=key),self.assertRaisesRegex(Refused,'SEQUENCE_SCOPE_DENIED'):self.g.scope({'trialId':trial})
            scope[key]=original

    def test_mansion_count_storage_scope_is_exact_and_does_not_authorize_capture(self):
        trial='sg_r1_20260928_32714'
        scope={'group':'primary','gameId':32714,'runtimeGameId':33114,'target':300000,'maxSequence':600000}
        self.manifest['trials'][trial]=scope
        self.assertEqual(self.g.scope({'trialId':trial})[1],scope)
        for key,value in [('gameId',32718),('runtimeGameId',33118),('target',299900),('maxSequence',600001)]:
            original=scope[key];scope[key]=value
            with self.subTest(key=key),self.assertRaisesRegex(Refused,'SEQUENCE_SCOPE_DENIED'):
                self.g.scope({'trialId':trial})
            scope[key]=original

    def test_pyramids_secondary_ceiling_preserves_separate_historical_baseline(self):
        trial='sg_r1_20260928_32721'
        scope={'group':'secondary','gameId':32721,'runtimeGameId':33121,'target':299850,'maxSequence':600000}
        self.manifest['trials'][trial]=scope
        secondary=Gateway(self.db,'secondary',self.manifest)
        self.assertEqual(secondary.scope({'trialId':trial})[1]['target'],299850)
        with self.assertRaisesRegex(Refused,'GROUP_SCOPE_DENIED'):self.g.scope({'trialId':trial})
        for key,value in [('gameId',32719),('runtimeGameId',33119),('target',300000),('maxSequence',600001)]:
            before=scope[key];scope[key]=value
            with self.subTest(key=key),self.assertRaisesRegex(Refused,'SEQUENCE_SCOPE_DENIED'):secondary.scope({'trialId':trial})
            scope[key]=before


if __name__=='__main__':unittest.main()


class JoblessFenceReadTests(unittest.TestCase):
    setUp = GatewayTests.setUp
    def test_jobless_fence_is_two_exact_readonly_keys(self):
        m=copy.deepcopy(self.manifest)
        m['trials']['sg_r1_20261001_32799']={'gameId':32799,'runtimeGameId':33159,'group':'primary','target':300000,'maxSequence':600000}
        g=Gateway(self.db,'secondary',m)
        keys=['primary/count-run:sg_r1_20261001_32799:36854881370:1','primary/count-jobless-revocation:sg_r1_20261001_32799:36854881370:1:complete']
        for k in keys+['primary/count-run:sg_r1_20261001_32799:999:1']:
            self.db['capture_journal_v2'].rows[k]={'_id':k,'value':{}}
        request={'schema':'sg-mongo-only-v2','op':'parallel_rhino_jobless_fence'}
        before=copy.deepcopy(self.db['capture_journal_v2'].rows)
        self.assertEqual([r['_id'] for r in g.dispatch(request)],keys)
        self.assertEqual(before,self.db['capture_journal_v2'].rows)
        for extra in ({'run':'999:1'},{'keys':keys},{'trialId':'other'}):
            with self.assertRaises(Refused):g.dispatch({**request,**extra})
        with self.assertRaises(Refused):Gateway(self.db,'primary',m).dispatch(request)
        m['trials']['sg_r1_20261001_32799']['maxSequence']=999999
        with self.assertRaises(Refused):Gateway(self.db,'secondary',m).dispatch(request)
