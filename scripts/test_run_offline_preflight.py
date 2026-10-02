import contextlib,io,pathlib,sys,tempfile,time,unittest
from run_offline_preflight import run_checks,run_group,tasks

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
        self.assertEqual(len(commands),13)
        self.assertTrue(any('pool-e2e-fixture.mjs' in ' '.join(c) for c in commands))
        self.assertFalse(any('gh' in c or 'ssh' in c for c in commands))
