import copy
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'service'))
from store import digest
from session_layout_plan import session_layout_plan
from pool_plan import validate_pool_plan


def fixture(lanes=2):
    plans = json.loads((ROOT/'config/round-one-plans.json').read_text(encoding='utf-8'))
    base = plans['32795']
    p = dict(schema='sg-session-layout-profile-v1', gameId=32795, group='primary', basePlanHash=digest(base),
        featureProfile='additive-free-awards-v2', activation='a'*64, parentActivation='b'*64,
        maxSequence=600000, sessionRotation='closed-batches-v1', completePreserved=12100,
        remainingComplete=287900, newBetAllowance=0, sourceCommit='a'*40, sourceRun='77:1',
        previousLanesPerHost=1 if lanes==2 else 2, comparisonHash=None if lanes==2 else 'c'*64,
        sessionLayout=dict(schema='sg-independent-sessions-v1', group='primary', hosts=20, lanesPerHost=lanes))
    for k in ('parentProfileHash','sourceSpecHash','poolHash','campaignHash','sourcePermitHash'):
        p[k]='c'*64
    plan={**base,'maxSteps':1026,'featureProfile':p['featureProfile'],'countAllocation':p['activation'],
          'sessionLayout':copy.deepcopy(p['sessionLayout'])}
    p['planHash']=digest(plan)
    return plans,p,plan


class SessionLayoutPlanTests(unittest.TestCase):
    def test_independent_profile_is_required_by_actual_python_plan_entry(self):
        for lanes,filename in ((2,'formal-sessions-pearl-two-20261001.json'),(4,'formal-sessions-pearl-four-20261001.json')):
            plans,p,plan=fixture(lanes)
            def read(path,*a,**kw):
                return json.dumps(p if path.name==filename else plans)
            with patch.dict(os.environ,SG_FORMAL_COUNT_PROFILE=filename),patch.object(Path,'read_text',read):
                self.assertEqual(validate_pool_plan(plan),plan)
                changed={**plan,'buy':1}
                with self.assertRaises(Exception): validate_pool_plan(changed)

    def test_scope_budget_and_staged_expansion_rejected(self):
        for key,value in [('gameId',32721),('group','secondary'),('completePreserved',True),
                          ('remainingComplete',300000),('newBetAllowance',1),('newBetAllowance',False),
                          ('activation','b'*64),('sourceRun','77:2'),('maxSequence',900000),
                          ('featureProfile','other'),('previousLanesPerHost',2),('planHash','0'*64)]:
            plans,p,_=fixture();p[key]=value
            with self.subTest(key=key),self.assertRaises(Exception):session_layout_plan(plans['32795'],p)
        for key,value in [('hosts',40),('hosts',True),('lanesPerHost',4),('lanesPerHost',8),('group','secondary')]:
            plans,p,_=fixture();p['sessionLayout'][key]=value
            with self.subTest(key=key),self.assertRaises(Exception):session_layout_plan(plans['32795'],p)
        plans,p,_=fixture(4);p['comparisonHash']=None
        with self.assertRaises(Exception):session_layout_plan(plans['32795'],p)

    def test_old_applied_profile_cannot_be_expanded_with_environment_only(self):
        plans,p,plan=fixture()
        with patch.dict(os.environ,SG_FORMAL_COUNT_PROFILE='formal-repair-pearl-awards-20261001.json'):
            with self.assertRaises(Exception):validate_pool_plan(plan)

