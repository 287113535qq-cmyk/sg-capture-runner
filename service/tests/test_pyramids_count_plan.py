import copy,json,os,sys,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(ROOT/'service'),str(ROOT/'scripts/runner-v2')]
from store import digest
from pool_plan import validate_pool_plan
from record_fields import execute,adapters

class PyramidsCountPlanTests(unittest.TestCase):
    def test_independent_count_plan_reaches_actual_intent_validator(self):
        base=json.loads((ROOT/'config/round-one-plans.json').read_text())['32721']
        plan={**base,'countAllocation':'a'*64}
        p=dict(schema='sg-formal-count-pyramids-v1',gameId=32721,group='secondary',workerOffset=20,
          activation='a'*64,basePlanHash=digest(base),planHash=digest(plan),completePreserved=1362,remainingComplete=298488,
          historicalBaseline=150,totalTarget=300000,maxSequence=600000,sessionRotation='closed-batches-v1',
          sourceRunKey='capture-run:36774221164:1',sourceGeneration='85eeac22df0369e166f1c1b31dd4f38a222aeb5910903ee59208800df54a3783',
          sourceProfileHash='93d4cf52cdec03b69e48f078f2ce0fd014165bd0791efa620ae46ec0a8cea339')
        real=Path.read_text
        def read(path,*a,**kw):return json.dumps(p) if path.name=='formal-count-pyramids-20261001.json' else real(path,*a,**kw)
        with patch.object(Path,'read_text',autospec=True,side_effect=read),patch.dict(os.environ,{'SG_FORMAL_COUNT_PROFILE':'formal-count-pyramids-20261001.json'}):
            self.assertEqual(validate_pool_plan(plan),plan);adapters.clear()
            payload='&'.join(f'{k}={v}' for k,v in {**plan['requestParams'],'PID':'gdmgcmoffline-count-synthetic','MSGID':'BET'}.items())
            self.assertEqual(execute({'op':'intent','plan':plan,'raw':{'steps':[]},'payload':payload}),{'validated':True})
            for k,v in [('group','primary'),('gameId',32719),('workerOffset',0),('completePreserved',1361),('remainingComplete',299900),('historicalBaseline',100),('sourceRunKey','capture-run:1:1'),('sourceGeneration','0'*64)]:
                before=copy.deepcopy(p);p[k]=v
                with self.subTest(key=k),self.assertRaises(Exception):validate_pool_plan(plan)
                p.clear();p.update(before)
            for k,v in [('target',300000),('buy',1),('demoGeneration','0'*64),('countAllocation','f'*64)]:
                with self.subTest(key=k),self.assertRaises(Exception):validate_pool_plan({**plan,k:v})
        adapters.clear()
