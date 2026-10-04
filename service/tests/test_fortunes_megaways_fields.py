import copy,json,pathlib,sys,tempfile,unittest
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from fortunes_megaways_fields import SOURCE,HEADER,request,bootstrap,FortunesMegawaysFields
from pool_plan import validate_pool_plan
from store import digest

class FortunesBoundary(unittest.TestCase):
    def setUp(self):
        self.registry=json.loads((pathlib.Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_bytes())
        self.plan=self.registry['plans']['32751']

    def test_exact_checked_plan_and_wiring_scope(self):
        self.assertEqual(validate_pool_plan(self.plan),self.plan)
        self.assertEqual(self.plan['runtimeGameId'],32973)
        self.assertEqual(self.plan['wmsGameId'],20371)
        for k,v in [('gameId',32749),('runtimeGameId',20371),('betRaw',176),('maxSteps',15),('wmsGameId',32973)]:
            with self.subTest(k=k),self.assertRaises(Exception):validate_pool_plan({**self.plan,k:v})

    def test_wiring_proof_cannot_borrow_count_only_or_source_evidence(self):
        for k,v in [('sourceRoutesValidated',2041),('gameId',32749),('sourceRequests',1),('actualRecordAndVerifyIpc',False),('rawHashesUnchanged',False)]:
            registry=copy.deepcopy(self.registry);wired=registry['proofs']['32751']['wiringEvidence'];wired[k]=v
            wired['evidenceHash']=digest({a:b for a,b in wired.items() if a!='evidenceHash'})
            with tempfile.TemporaryDirectory() as folder:
                root=pathlib.Path(folder);(root/'config').mkdir();(root/'config/ag-rolling-plans.json').write_bytes(json.dumps(registry).encode())
                with patch('ag_rolling_plan.Path') as location:
                    location.return_value.resolve.return_value.parents=[None,root]
                    with self.subTest(k=k),self.assertRaises(Exception):validate_pool_plan(registry['plans']['32751'])

    def test_paid_request_is_exact_mode_and_currency(self):
        h='<Header '+' '.join(f'{k}="{v}"' for k,v in {**HEADER,'sessionID':'offline'}.items())+'/>'
        q=f'<GameRequest type="Logic">{h}<Stake total="16" gameMode="0"/><PaylineCount count="1"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></GameRequest>'
        self.assertEqual(request(q,'Logic',True),'offline')
        for a,b in [('gameMode="0"','gameMode="1"'),('total="16"','total="176"'),('>1</Currency','>2</Currency')]:
            with self.assertRaises(Exception):request(q.replace(a,b),'Logic',True)

    def test_new_session_init_has_no_recovery_or_paid_result(self):
        h='<Header '+' '.join(f'{k}="{v}"' for k,v in {**HEADER,'sessionID':'offline'}.items())+'/>'
        q=f'<GameRequest type="Init">{h}</GameRequest>'
        p='<GameResponse type="Init"><Header gameID="20371" versionID="1_0" sessionID="rotated" isRecovering="N" readyForEndGame="N"/><Balances><Balance name="CASH_BALANCE" value="1000"/></Balances><GameInfo><Stakes>16|32|</Stakes></GameInfo></GameResponse>'
        def s(x):return dict(msgId='Init',requestPayload=q,responsePayload=x,responseXml=x,responseBalance=1000,elapsedMs=0)
        self.assertEqual(bootstrap(s(p),'offline')['balanceRaw'],1000)
        for a,b in [('16|32|','15|32|'),('isRecovering="N"','isRecovering="Y"'),('</GameResponse>','<GameResult/></GameResponse>'),
                    ('</GameInfo>','<NewBonus/></GameInfo>')]:
            with self.assertRaises(Exception):bootstrap(s(p.replace(a,b)),'offline')

    def test_empty_prefix_routes_logic_but_cannot_be_settled(self):
        parser=FortunesMegawaysFields(self.plan)
        raw=dict(fixtureOnly=False,sourceKey=SOURCE,protocol='wms',roundFieldsVersion='sg-round-fields-v1',startBalanceRaw=1000,steps=[])
        self.assertEqual(parser.next_request(raw),{'MSGID':'Logic'})
        with self.assertRaises(Exception):parser.settled(raw)
        raw['sourceKey']='fivetreasures-ag-rolling-wms-v1'
        with self.assertRaises(Exception):parser.next_request(raw)

if __name__=='__main__':unittest.main()
