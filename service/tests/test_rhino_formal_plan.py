import json,os,unittest
from pathlib import Path
from unittest.mock import patch
from pool_plan import validate_pool_plan
from store import digest

class RhinoFormalPlanTests(unittest.TestCase):
    def test_scope_cannot_borrow_pilot_or_pearl_permission(self):
        root=Path(__file__).resolve().parents[2]
        base=json.loads((root/'config/round-one-plans.json').read_text())['32799']
        plan={**base,'countAllocation':'a'*64}
        profile=dict(schema='sg-formal-count-rhino-v1',gameId=32799,basePlanHash=digest(base),activation='a'*64,
                     completePreserved=100,remainingComplete=299900,maxSequence=600000,
                     sessionRotation='closed-batches-v1',planHash=digest(plan))
        real=Path.read_text
        def read(path,*args,**kwargs):
            return json.dumps(profile) if path.name in ('formal-count-rhino-20261001.json','formal-count-pearl-20260930.json') else real(path,*args,**kwargs)
        with patch.object(Path,'read_text',autospec=True,side_effect=read),patch.dict(os.environ,{'SG_FORMAL_COUNT_PROFILE':'formal-count-rhino-20261001.json'}):
            self.assertEqual(validate_pool_plan(plan),plan)
            for k,v in [('gameId',32795),('schema','sg-formal-count-profile-v1'),('remainingComplete',300000),('completePreserved',0),('maxSequence',600001)]:
                old=profile[k];profile[k]=v
                with self.subTest(field=k),self.assertRaises(Exception):validate_pool_plan(plan)
                profile[k]=old
            for k,v in [('demoGeneration','b'*64),('target',600000),('buy',1),('countAllocation','b'*64)]:
                with self.subTest(planField=k),self.assertRaises(Exception):validate_pool_plan({**plan,k:v})
            with patch.dict(os.environ,{'SG_FORMAL_COUNT_PROFILE':'formal-count-pearl-20260930.json'}),self.assertRaises(Exception):validate_pool_plan(plan)
