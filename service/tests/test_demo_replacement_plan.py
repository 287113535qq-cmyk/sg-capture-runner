import os,json,unittest
from pathlib import Path
from unittest.mock import patch
from pool_plan import validate_pool_plan
from store import digest

class ReplacementPlanTests(unittest.TestCase):
    def test_explicit_replacement_file_and_plan_are_required(self):
        root=Path(__file__).resolve().parents[2]
        old=json.loads((root/'config/round-one-plans.json').read_text())['32820']
        plan={**old,'demoGeneration':'b'*64}
        profile={'schema':'sg-demo-pilot-v1','gameId':32820,'oldPlanHash':digest(old),'generation':'b'*64,'planHash':digest(plan)}
        real=Path.read_text
        def read(path,*args,**kwargs):
            return json.dumps(profile) if path.name=='demo-pilot-replacement-20260930.json' else real(path,*args,**kwargs)
        with patch.object(Path,'read_text',autospec=True,side_effect=read),patch.dict(os.environ,{'SG_DEMO_PILOT_PROFILE':'demo-pilot-replacement-20260930.json'}):
            self.assertEqual(validate_pool_plan(plan),plan)
            with self.assertRaises(Exception):validate_pool_plan({**plan,'demoGeneration':'c'*64})
        with patch.dict(os.environ,{'SG_DEMO_PILOT_PROFILE':'../anything.json'}):
            with self.assertRaises(Exception):validate_pool_plan(plan)
