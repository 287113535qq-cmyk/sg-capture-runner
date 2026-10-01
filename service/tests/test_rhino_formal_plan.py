import json,os,unittest
from pathlib import Path
from unittest.mock import patch
from pool_plan import validate_pool_plan
from store import digest

class RhinoFormalPlanTests(unittest.TestCase):
    def check_scope(self,repaired=False):
        root=Path(__file__).resolve().parents[2]
        base=json.loads((root/'config/round-one-plans.json').read_text())['32799']
        plan={**base,'countAllocation':'a'*64}
        profile=dict(schema='sg-formal-count-rhino-v2' if repaired else 'sg-formal-count-rhino-v1',gameId=32799,basePlanHash=digest(base),activation='a'*64,
                     completePreserved=151 if repaired else 100,remainingComplete=299849 if repaired else 299900,maxSequence=600000,
                     sessionRotation='closed-batches-v1',planHash=digest(plan))
        name='formal-count-rhino-guarantee-20261001.json' if repaired else 'formal-count-rhino-20261001.json'
        if repaired:profile.update(sourceProfileHash='d03dc36c60fa3bf208126fe7592d70ab16a74a32afe39844817fa160ac565433',sourceRunKey='capture-run:36826318464:1',sourceCommit='65d870c75d77022b2de8deaca2755f5cd55e1528',sourceGeneration='a8bbaf0c5f2522764d73a5111acb42eceed9076d276f5b077f8bc1c6eabcfc0d',repairedBaseline={'completePreserved':51})
        real=Path.read_text
        def read(path,*args,**kwargs):
            return json.dumps(profile) if path.name in (name,'formal-count-pearl-20260930.json') else real(path,*args,**kwargs)
        with patch.object(Path,'read_text',autospec=True,side_effect=read),patch.dict(os.environ,{'SG_FORMAL_COUNT_PROFILE':name}):
            self.assertEqual(validate_pool_plan(plan),plan)
            for k,v in [('gameId',32795),('schema','sg-formal-count-profile-v1'),('remainingComplete',300000),('completePreserved',0),('maxSequence',600001)]:
                old=profile[k];profile[k]=v
                with self.subTest(field=k),self.assertRaises(Exception):validate_pool_plan(plan)
                profile[k]=old
            for k,v in [('demoGeneration','b'*64),('target',600000),('buy',1),('countAllocation','b'*64)]:
                with self.subTest(planField=k),self.assertRaises(Exception):validate_pool_plan({**plan,k:v})
            with patch.dict(os.environ,{'SG_FORMAL_COUNT_PROFILE':'formal-count-pearl-20260930.json'}),self.assertRaises(Exception):validate_pool_plan(plan)

    def test_scope_cannot_borrow_pilot_or_pearl_permission(self):self.check_scope()
    def test_repaired_scope_preserves151_and_rejects_expansion(self):self.check_scope(True)
