import copy
import pathlib
import sys
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'scripts'))
from build_ag_native_manifest import append_rolling_scopes


class NativeAppendTests(unittest.TestCase):
    def fixture(self):
        def plan(game, runtime):
            return {'gameId':game, 'runtimeGameId':runtime, 'trialId':f'sg_ag_r1_20261004_{game}',
                    'mode':'demo','buy':0,'database':'sg_capture_staging_v1','target':300000}
        old={'schema':'sg-mongo-only-access-v2','metadataWritesEnabled':True,'roundWritesEnabled':True,
             'trials':{'legacy':{'group':'secondary','gameId':32719,'target':299850}}}
        plans={'schema':'sg-ag-rolling-plan-registry-v1','sourceAllowance':0,
               'plans':{'32441':plan(32441,32801)}}
        old,_=append_rolling_scopes(old,plans)
        plans['plans']['32749']=plan(32749,32971)
        return old,plans
    def test_additive_new_wms_scope_preserves_all_old_scopes_and_inputs(self):
        old,plans=self.fixture();before=copy.deepcopy((old,plans))
        desired,added=append_rolling_scopes(old,plans)
        self.assertEqual((old,plans),before)
        self.assertEqual(list(added),['sg_ag_r1_20261004_32749'])
        self.assertEqual(added['sg_ag_r1_20261004_32749']['runtimeGameId'],32971)
        self.assertTrue(desired['rollingGameCountEnabled'])
        for trial,scope in old['trials'].items():self.assertEqual(desired['trials'][trial],scope)
    def test_existing_trial_cannot_change_game_runtime_target_or_extra_scope_fields(self):
        old,plans=self.fixture()
        for field,value in [('runtimeGameId',20442),('gameId',32749),('target',300001),('ignored',True)]:
            bad=copy.deepcopy(old);bad['trials']['sg_ag_r1_20261004_32441'][field]=value
            with self.assertRaisesRegex(AssertionError,'EXISTING_SCOPE_CHANGED'):append_rolling_scopes(bad,plans)
            self.assertEqual(old['trials']['sg_ag_r1_20261004_32441']['runtimeGameId'],32801)
    def test_unregistered_or_non_staging_game_is_rejected_before_manifest_mutation(self):
        old,plans=self.fixture();before=copy.deepcopy(old)
        for field,value in [('trialId','other'),('buy',1),('database','production'),('target',300001),('gameId',32750)]:
            bad=copy.deepcopy(plans);bad['plans']['32749'][field]=value
            with self.assertRaises(AssertionError):append_rolling_scopes(old,bad)
            self.assertEqual(old,before)
    def test_second_manifest_build_does_not_reappend_or_modify_old_registered_scopes(self):
        old,plans=self.fixture();desired,added=append_rolling_scopes(old,plans)
        self.assertEqual(len(added),1)
        again,added=append_rolling_scopes(desired,plans)
        self.assertEqual(added,{});self.assertEqual(again,desired)
        plans['plans']['32441']['trialId']='sg_ag_r1_20261005_32441'
        with self.assertRaisesRegex(AssertionError,'GAME_TRIAL_CHANGED'):append_rolling_scopes(desired,plans)
