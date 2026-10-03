import contextlib,copy,io,json,pathlib,sys,tempfile,time,unittest
from run_offline_preflight import run_checks,run_group,tasks,compare_results,save_result

class OfflinePreflightTests(unittest.TestCase):
    def test_failure_is_joined_and_does_not_hide_independent_group(self):
        with tempfile.TemporaryDirectory() as d,contextlib.redirect_stdout(io.StringIO()):
            root=pathlib.Path(d)
            inventory=[('bad',[(root,[sys.executable,'-c','raise SystemExit(7)']),
                              (root,[sys.executable,'-c',"raise SystemExit('must not run')"])]),
                       ('good',[(root,[sys.executable,'-c','print(1)'])])]
            out=run_checks(inventory,2)
            self.assertFalse(out['passed']);self.assertEqual(len(out['groups']),2)
            bad=next(g for g in out['groups'] if g['group']=='bad')
            self.assertEqual(len(bad['commands']),1);self.assertEqual(bad['commands'][0]['exitCode'],7)
            self.assertTrue(next(g for g in out['groups'] if g['group']=='good')['passed'])
    def test_timeout_is_a_failure_with_no_later_command(self):
        with tempfile.TemporaryDirectory() as d:
            out=run_group(('slow',[(pathlib.Path(d),[sys.executable,'-c','import time;time.sleep(10)'])]),deadline=.1)
            self.assertFalse(out['passed']);self.assertEqual(out['commands'][0]['exitCode'],124)
    def test_inventory_retains_all_existing_checks_without_source_tools(self):
        inventory=tasks();self.assertEqual(len(inventory),3)
        commands=[argv for _,entries in inventory for _,argv in entries]
        self.assertEqual(len(commands),14)
        self.assertTrue(any('pool-e2e-fixture.mjs' in ' '.join(c) for c in commands))
        self.assertIn(['node','scripts/build-ag-rolling-core.mjs','--check'],commands)
        self.assertFalse(any('gh' in c or 'ssh' in c for c in commands))
    def test_comparison_requires_both_pairs_and_identical_complete_checks(self):
        runs=[{'workers':w,'elapsedSeconds':seconds,'passed':True,'groups':[
            {'group':name,'passed':True,'commands':[{'exitCode':0,'argvHash':str(i)} for i in range(len(commands))]}
            for name,commands in tasks()]} for w,seconds in [(1,100),(2,70),(2,75),(1,90)]]
        self.assertTrue(compare_results(runs)['accepted'])
        bad=copy.deepcopy(runs);bad[2]['elapsedSeconds']=95
        self.assertFalse(compare_results(bad)['accepted'])
        bad=copy.deepcopy(runs);bad[2]['groups'][0]['commands'].pop()
        self.assertFalse(compare_results(bad)['accepted'])
        bad=copy.deepcopy(runs);bad[2]['groups'][0]['commands'][0]['argvHash']='changed'
        self.assertFalse(compare_results(bad)['accepted'])
        self.assertFalse(compare_results(runs[:3])['accepted'])
    def test_partial_result_survives_as_explicitly_incomplete(self):
        with tempfile.TemporaryDirectory() as directory:
            path=pathlib.Path(directory)/'result.json'
            save_result(path,{'runs':[{'passed':True}],'complete':False,'passed':False})
            self.assertFalse(json.loads(path.read_text())['complete'])
            save_result(path,{'runs':[],'complete':True,'passed':True})
            self.assertTrue(json.loads(path.read_text())['complete'])
            self.assertFalse(path.with_suffix('.tmp').exists())
