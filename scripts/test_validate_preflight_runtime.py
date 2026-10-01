import copy
import unittest
from validate_preflight_runtime import validate_preflight_runtime


class PreflightRuntimeTests(unittest.TestCase):
    def fixture(self):
        return dict(status='completed', conclusion='success', repository={'full_name':'287113535qq-cmyk/sg-capture-runner'},
                    path='.github/workflows/preflight.yml',run_attempt=1,head_sha='a'*40)

    def test_config_only_commit_reuses_linux_proof_without_source_allowance(self):
        result=validate_preflight_runtime(self.fixture(),'b'*40,lambda commit,root:'c'*40)
        self.assertTrue(result['runtimeIdentical']);self.assertEqual(result['sourceAllowance'],0)

    def test_any_changed_runtime_tree_requires_new_preflight(self):
        for changed in ('scripts','service','collector','.github'):
            with self.subTest(root=changed),self.assertRaises(AssertionError):
                validate_preflight_runtime(self.fixture(),'b'*40,lambda commit,root:'d'*40 if commit=='b'*40 and root==changed else 'c'*40)

    def test_failure_running_wrong_repository_and_identity_are_rejected(self):
        for key,value in [('status','in_progress'),('conclusion','failure'),('repository',{'full_name':'other/repo'}),
                          ('path','.github/workflows/trial-300k.yml'),('run_attempt',2),('head_sha','HEAD')]:
            run=copy.deepcopy(self.fixture());run[key]=value
            with self.subTest(key=key),self.assertRaises(AssertionError):validate_preflight_runtime(run,'b'*40,lambda c,r:'c'*40)
