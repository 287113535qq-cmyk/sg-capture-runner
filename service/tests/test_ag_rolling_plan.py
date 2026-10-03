import copy,json,pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from pool_plan import validate_pool_plan
from store import digest


class RollingPlans(unittest.TestCase):
    def setUp(self):
        self.registry=json.loads((pathlib.Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_text(encoding='utf-8'))

    def test_every_new_plan_has_a_fixed_request_and_full_ordinary_round_replay_proof(self):
        self.assertEqual(self.registry['sourceAllowance'],0)
        self.assertGreater(len(self.registry['plans']),50)
        for key,plan in self.registry['plans'].items():
            with self.subTest(game=key):
                self.assertEqual(validate_pool_plan(plan),plan)
                proof=self.registry['proofs'][key]
                self.assertEqual(proof['planHash'],digest(plan))
                self.assertGreaterEqual(proof['acceptedBaseRounds'],10)
                self.assertEqual(proof['formalAdmission'],'requires-two-AG-live-canaries')
                self.assertNotIn(plan['gameId'],self.registry['alreadyComplete'])

    def test_plan_variants_cannot_borrow_a_registered_replay_or_an_old_profile(self):
        base=next(iter(self.registry['plans'].values()))
        for key,value in [('betRaw',base['betRaw']+1),('gameId',32714),('buy',1),('target',300001),
                          ('database','production'),('countAllocation','a'*64),('demoGeneration','b'*64)]:
            plan=copy.deepcopy(base);plan[key]=value
            with self.subTest(field=key),self.assertRaises(Exception):validate_pool_plan(plan)
        plan=copy.deepcopy(base);plan['requestParams']['MSGID']='FEATURE_PICK'
        with self.assertRaises(Exception):validate_pool_plan(plan)


if __name__=='__main__':unittest.main()
