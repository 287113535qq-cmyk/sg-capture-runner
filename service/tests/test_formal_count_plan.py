import copy
import json
import os
import pathlib
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from pool_plan import validate_pool_plan
from store import digest


class FormalPlanTests(unittest.TestCase):
    def setUp(self):
        self.plans=json.loads((pathlib.Path(__file__).resolve().parents[2]/'config/round-one-plans.json').read_text(encoding='utf-8'))
        self.base=self.plans['32795']
        self.plan={**self.base,'countAllocation':'a'*64}
        self.profile={'schema':'sg-formal-count-profile-v1','gameId':32795,'basePlanHash':digest(self.base),
            'activation':'a'*64,'completePreserved':100,'remainingComplete':299900,'maxSequence':600000,
            'sessionRotation':'closed-batches-v1','planHash':digest(self.plan)}

    def check(self,plan):
        def read(path,*a,**kw):
            return json.dumps(self.profile if path.name=='formal-count-pearl-20260930.json' else self.plans)
        with patch.dict(os.environ,{'SG_FORMAL_COUNT_PROFILE':'formal-count-pearl-20260930.json'}),patch.object(pathlib.Path,'read_text',read):
            return validate_pool_plan(plan)

    def test_independent_formal_plan_preserves_base_and_complete_target(self):
        self.assertEqual(self.check(self.plan),self.plan)
        self.assertEqual(self.check(self.base),self.base)

    def test_pilot_or_count_changes_cannot_mint_formal_scope(self):
        for key,value in [('demoGeneration','b'*64),('target',600000),('countAllocation','c'*64),('buy',1),('gameId',32636)]:
            with self.subTest(key=key),self.assertRaises(Exception):self.check({**self.plan,key:value})
        for key,value in [('remainingComplete',300000),('maxSequence',600001),('completePreserved',0)]:
            old=copy.deepcopy(self.profile)
            self.profile[key]=value
            with self.subTest(key=key),self.assertRaises(Exception):self.check(self.plan)
            self.profile=old
