import os,json,unittest
from pathlib import Path
from unittest.mock import patch
from pool_plan import validate_pool_plan
from store import digest
class NextGamePlanTests(unittest.TestCase):
    def test_jinzita_profile_cannot_borrow_luxor_or_change_target(self):
        root=Path(__file__).resolve().parents[2]
        old=json.loads((root/'config/round-one-plans.json').read_text())['32720']
        plan={**old,'demoGeneration':'e'*64}
        profile={'schema':'sg-demo-next-game-v1','gameId':32720,'fromGameId':32835,'workers':20,'perWorker':5,'newBetAllowance':100,'oldPlanHash':digest(old),'generation':'e'*64,'planHash':digest(plan)}
        real=Path.read_text
        def read(path,*args,**kwargs):
            return json.dumps(profile) if path.name=='demo-pilot-jinzita-20260930.json' else real(path,*args,**kwargs)
        with patch.object(Path,'read_text',autospec=True,side_effect=read),patch.dict(os.environ,{'SG_DEMO_PILOT_PROFILE':'demo-pilot-jinzita-20260930.json'}):
            self.assertEqual(validate_pool_plan(plan),plan)
            for key,value in [('fromGameId',32820),('newBetAllowance',101),('gameId',32835),('workers',21)]:
                before=profile[key];profile[key]=value
                with self.assertRaises(Exception):validate_pool_plan(plan)
                profile[key]=before
            with self.assertRaises(Exception):validate_pool_plan({**plan,'target':300000})
        with patch.dict(os.environ,{'SG_DEMO_PILOT_PROFILE':'demo-pilot-luxor-20260930.json'}):
            with self.assertRaises(Exception):validate_pool_plan(plan)
    def test_morepuff_requires_independent_closed_source_and_budget(self):
        root=Path(__file__).resolve().parents[2]
        old=json.loads((root/'config/round-one-plans.json').read_text())['32718']
        plan={**old,'demoGeneration':'e'*64}
        profile={'sourceClosureHash':'f'*64,'schema':'sg-demo-next-game-v1','gameId':32718,'fromGameId':32720,'workers':20,'perWorker':5,'newBetAllowance':100,'oldPlanHash':digest(old),'generation':'e'*64,'planHash':digest(plan)}
        real=Path.read_text
        def read(path,*args,**kwargs):
            return json.dumps(profile) if path.name=='demo-pilot-morepuff-20260930.json' else real(path,*args,**kwargs)
        with patch.object(Path,'read_text',autospec=True,side_effect=read),patch.dict(os.environ,{'SG_DEMO_PILOT_PROFILE':'demo-pilot-morepuff-20260930.json'}):
            self.assertEqual(validate_pool_plan(plan),plan)
            for key,value in [('sourceClosureHash',''),('fromGameId',32820),('newBetAllowance',101),('gameId',32720),('workers',21)]:
                before=profile[key];profile[key]=value
                with self.assertRaises(Exception):validate_pool_plan(plan)
                profile[key]=before
            with self.assertRaises(Exception):validate_pool_plan({**plan,'target':300000})
        with patch.dict(os.environ,{'SG_DEMO_PILOT_PROFILE':'demo-pilot-luxor-20260930.json'}):
            with self.assertRaises(Exception):validate_pool_plan(plan)
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
