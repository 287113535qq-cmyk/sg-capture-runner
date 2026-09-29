import os,json,unittest
from pathlib import Path
from unittest.mock import patch
from pool_plan import validate_pool_plan
from store import digest
class NextGamePlanTests(unittest.TestCase):
    def test_luxor_requires_independent_profile_exact_budget_and_generation(self):
        root=Path(__file__).resolve().parents[2]
        old=json.loads((root/'config/round-one-plans.json').read_text())['32835']
        plan={**old,'demoGeneration':'c'*64}
        profile={'schema':'sg-demo-next-game-v1','gameId':32835,'fromGameId':32820,'workers':20,'perWorker':5,'newBetAllowance':100,'oldPlanHash':digest(old),'generation':'c'*64,'planHash':digest(plan)}
        real=Path.read_text
        def read(path,*args,**kwargs):
            return json.dumps(profile) if path.name=='demo-pilot-luxor-20260930.json' else real(path,*args,**kwargs)
        with patch.object(Path,'read_text',autospec=True,side_effect=read),patch.dict(os.environ,{'SG_DEMO_PILOT_PROFILE':'demo-pilot-luxor-20260930.json'}):
            self.assertEqual(validate_pool_plan(plan),plan)
            for key,value in [('fromGameId',32739),('newBetAllowance',101),('perWorker',6),('gameId',32820),('schema','sg-demo-pilot-v1')]:
                original=profile[key];profile[key]=value
                with self.assertRaises(Exception):validate_pool_plan(plan)
                profile[key]=original
            with self.assertRaises(Exception):validate_pool_plan({**plan,'demoGeneration':'d'*64})
        with patch.dict(os.environ,{'SG_DEMO_PILOT_PROFILE':'demo-residual-beaver-20260930.json'}):
            with self.assertRaises(Exception):validate_pool_plan(plan)
