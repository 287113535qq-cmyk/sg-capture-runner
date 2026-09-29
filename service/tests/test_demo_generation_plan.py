import json
import unittest
from pathlib import Path
from unittest.mock import patch
from pool_plan import validate_pool_plan
from store import digest

class DemoGenerationPlanTests(unittest.TestCase):
    def test_explicit_profile_accepts_only_unchanged_plan_and_bound_generation(self):
        root=Path(__file__).resolve().parents[2]
        old=json.loads((root/'config/round-one-plans.json').read_text())['32820']
        plan={**old,'demoGeneration':'a'*64}
        profile={'schema':'sg-demo-pilot-v1','gameId':32820,'oldPlanHash':digest(old),'generation':'a'*64,'planHash':digest(plan)}
        original=Path.read_text
        def read(path,*args,**kwargs):
            return json.dumps(profile) if path.name=='demo-pilot-beaver-20260930.json' else original(path,*args,**kwargs)
        with patch.object(Path,'read_text',autospec=True,side_effect=read):
            self.assertEqual(validate_pool_plan(plan),plan)
            self.assertEqual(validate_pool_plan(old),old)
            for delta in ({'demoGeneration':'b'*64},{'betRaw':old['betRaw']+1},{'target':old['target']+1}):
                with self.assertRaises(Exception):validate_pool_plan({**plan,**delta})
            altered={**plan,'betRaw':old['betRaw']+1};profile['planHash']=digest(altered)
            with self.assertRaises(Exception):validate_pool_plan(altered)
