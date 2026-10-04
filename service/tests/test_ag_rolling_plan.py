import copy,json,pathlib,sys,unittest
import tempfile
from unittest.mock import patch
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

    def test_wms_catalog_identity_is_distinct_from_the_evidenced_header_identity(self):
        plan=self.registry['plans']['32749']
        self.assertEqual(plan['runtimeGameId'],32971)
        self.assertEqual(plan['wmsGameId'],20442)
        self.assertEqual(plan['maxSteps'],8)
        for field,value in [('runtimeGameId',20442),('wmsGameId',32971),('wmsChoiceCount',6),('betRaw',200)]:
            candidate={**plan,field:value}
            with self.subTest(field=field),self.assertRaises(Exception):validate_pool_plan(candidate)

    def test_wms_full_wiring_proof_cannot_be_replaced_by_counts_or_another_game(self):
        for field,value in [('runtimeGameId',20442),('sourceRoutesValidated',2000),('sourceRequests',1),
                            ('actualRecordAndVerifyIpc',False),('rawHashesUnchanged',False),('agOptionCounts',{'1':5})]:
            registry=copy.deepcopy(self.registry)
            wired=registry['proofs']['32749']['wiringEvidence'];wired[field]=value
            wired['evidenceHash']=digest({k:v for k,v in wired.items() if k!='evidenceHash'})
            with tempfile.TemporaryDirectory() as folder:
                root=pathlib.Path(folder);(root/'config').mkdir()
                (root/'config/ag-rolling-plans.json').write_text(json.dumps(registry),encoding='utf-8')
                with patch('ag_rolling_plan.Path') as location:
                    location.return_value.resolve.return_value.parents=[None,root]
                    with self.subTest(field=field),self.assertRaises(Exception):validate_pool_plan(registry['plans']['32749'])


if __name__=='__main__':unittest.main()
