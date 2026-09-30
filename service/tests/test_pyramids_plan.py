import copy,json,os,sys,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(ROOT/'service'),str(ROOT/'scripts/runner-v2')]
from pool_plan import validate_pool_plan
from record_fields import execute,adapters
from store import digest
class PyramidsPlanTests(unittest.TestCase):
    def test_applied_plan_and_actual_capture_intent(self):
        profile=json.loads((ROOT/'config/demo-pilot-pyramids-20261001.json').read_text())
        plan={**json.loads((ROOT/'config/round-one-plans.json').read_text())['32721'],'demoGeneration':profile['generation']}
        self.assertEqual(digest(profile),'93d4cf52cdec03b69e48f078f2ce0fd014165bd0791efa620ae46ec0a8cea339')
        with patch.dict(os.environ,{'SG_DEMO_PILOT_PROFILE':'demo-pilot-pyramids-20261001.json'}):
            self.assertEqual(validate_pool_plan(plan),plan)
            adapters.clear()
            payload='&'.join(f'{k}={v}' for k,v in {**plan['requestParams'],'PID':'gdmgcmoffline-pyramids-admission','MSGID':'BET'}.items())
            self.assertEqual(execute({'op':'intent','plan':plan,'raw':{'steps':[]},'payload':payload}),{'validated':True})
            for field,value in [('demoGeneration','0'*64),('gameId',32719),('target',299900),('buy',1)]:
                with self.subTest(field=field),self.assertRaises(Exception):validate_pool_plan({**plan,field:value})
        with patch.dict(os.environ,{'SG_DEMO_PILOT_PROFILE':'demo-pilot-inca-20261001.json'}):
            with self.assertRaises(Exception):validate_pool_plan(plan)
        real=Path.read_text
        def read(path,*args,**kwargs):return json.dumps(profile) if path.name=='demo-pilot-pyramids-20261001.json' else real(path,*args,**kwargs)
        with patch.object(Path,'read_text',autospec=True,side_effect=read),patch.dict(os.environ,{'SG_DEMO_PILOT_PROFILE':'demo-pilot-pyramids-20261001.json'}):
            for field,value in [('group','primary'),('workerOffset',0),('newBetAllowance',101),('sourceClosureHash','0'*64),('completePreserved',1261)]:
                before=copy.deepcopy(profile);profile[field]=value
                with self.subTest(field=field),self.assertRaises(Exception):validate_pool_plan(plan)
                profile.clear();profile.update(before)
        adapters.clear()
