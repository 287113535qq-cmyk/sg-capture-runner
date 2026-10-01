import importlib.util
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('record_plan_preflight',ROOT/'scripts/runner-v2/record_fields.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class RecordPlanPreflightTests(unittest.TestCase):
    def setUp(self):
        module.adapters.clear()
        base=json.loads((ROOT/'config/round-one-plans.json').read_text())['32721']
        profile=json.loads((ROOT/'config/formal-repair-pyramids-coins-20261001.json').read_text())
        self.plan={**base,'countAllocation':profile['activation']}
    def test_retirement_old_plan_is_validated_without_any_response_or_new_profile(self):
        with patch.dict(os.environ,SG_FORMAL_COUNT_PROFILE='formal-repair-pyramids-coins-20261001.json'):
            self.assertEqual(module.execute({'op':'plan','plan':self.plan}),{'validated':True})
    def test_wrong_profile_and_modified_plan_are_refused_before_any_store_mutation(self):
        with patch.dict(os.environ,SG_FORMAL_COUNT_PROFILE='formal-count-pyramids-20261001.json'):
            with self.assertRaises(Exception):module.execute({'op':'plan','plan':self.plan})
        with patch.dict(os.environ,SG_FORMAL_COUNT_PROFILE='formal-repair-pyramids-coins-20261001.json'):
            for change in ({'buy':1},{'countAllocation':'a'*64},{'target':300000}):
                with self.assertRaises(Exception):module.execute({'op':'plan','plan':{**self.plan,**change}})

if __name__=='__main__':unittest.main()
