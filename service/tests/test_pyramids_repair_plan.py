import copy
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pool_plan import validate_pool_plan
from store import digest


class PyramidsRepairPlanTests(unittest.TestCase):
    def check_scope(self,v2=False):
        plans = json.loads((Path(__file__).resolve().parents[2]/'config/round-one-plans.json').read_text(encoding='utf-8'))
        base = plans['32721'];plan = {**base, 'countAllocation': 'a'*64}
        profile = dict(schema='sg-formal-repair-pyramids-v2' if v2 else 'sg-formal-repair-pyramids-v1', gameId=32721, group='secondary', workerOffset=20,
            historicalBaseline=150,totalTarget=300000,oldProfileHash='93fef71918ebb6ad0d08e546b3ec13a2964b8493b8f860306e99564899808533' if v2 else '989d114146fc85a759015ead8fa46c0f7d89c19d29f590ac849c9ff059ffdb9c',
            sourceRun='36791455132:1' if v2 else '36778619850:1',sourceCommit='876797180569bb1134fd7cc6c6934dc347cd0cb1' if v2 else 'c3e172c9712084034ddd34d69ab51071d78cb1a4',
            basePlanHash=digest(base),activation='a'*64,completePreserved=2127 if v2 else 1658,remainingComplete=297723 if v2 else 298192,
            maxSequence=600000,sessionRotation='closed-batches-v1',planHash=digest(plan))
        name='formal-repair-pyramids-display-20261001.json' if v2 else 'formal-repair-pyramids-coins-20261001.json'
        def read(p,*a,**kw):
            return json.dumps(profile if p.name==name else plans)
        with patch.dict(os.environ,SG_FORMAL_COUNT_PROFILE=name),patch.object(Path,'read_text',read):
            self.assertEqual(validate_pool_plan(plan), plan)
            for k,v in [('target',300000),('buy',1),('sessionLayout',{'lanesPerHost':2}),('gameId',32795)]:
                altered={**plan,k:v};profile['planHash']=digest(altered)
                with self.subTest(key=k),self.assertRaises(Exception):validate_pool_plan(altered)
            profile['planHash']=digest(plan)
            for k,v in [('completePreserved',1362),('remainingComplete',299850),('sourceRun','1:1'),('group','primary')]:
                old=copy.deepcopy(profile);profile[k]=v
                with self.subTest(key=k),self.assertRaises(Exception):validate_pool_plan(plan)
                profile.clear();profile.update(old)

    def test_first_repair_scope(self):self.check_scope()
    def test_second_repair_scope(self):self.check_scope(True)
