import copy,json,unittest
from pathlib import Path
from inca_hold_action_review import IncaHoldActionReview
from round_fields import FieldError,params
from tests.test_inca_free_review import rewrite

class IncaHoldActionTests(unittest.TestCase):
    def setUp(self):
        self.plan=json.loads(Path('config/round-one-plans.json').read_text())['32719']
        self.raw=json.loads(Path('scripts/trial/fixtures/pyramids-hold-synthetic.json').read_text())
        self.raw['sourceKey']=self.plan['sourceKey'];self.raw['steps']=self.raw['steps'][:7];self.raw['startBalanceRaw']=100000
        grid='|'.join(['1;1;1']*5)
        for i,s in enumerate(self.raw['steps']):
            s['requestPayload']=s['requestPayload'].replace('hyperchargedpyramidsofra96','hyperchargedincajungle96')
            g='CL~0;0;-4#BGCL~0;0;-4#HCL~0;0;-4#HVA~'+grid if not i else 'HNSID~2#HNSRIDS~1;2;3;4;5#HCL~0;0;-4#HVA~'+grid+'#HNSTW~300'
            rewrite(s,NFG=6-i,TFG=6,CFGG=i,GSD=g,TW=500 if i==6 else 0,B=100480 if i==6 else 99980,AB=100480 if i==6 else 99980)
            s.pop('responseBalance',None)
        self.a=IncaHoldActionReview(self.plan)

    def test_display_differences_do_not_block_reviewed_route_or_classify_pending_money(self):
        raw=copy.deepcopy(self.raw)
        for s in raw['steps']:
            g=params(s['responsePayload'])['GSD'].replace('0;0;-4','0;0;12345')+'#NEW_DISPLAY~opaque'
            rewrite(s,GSD=g)
        for n in range(1,7):self.assertEqual(self.a.next_request({**raw,'steps':raw['steps'][:n]}),{'MSGID':'FREE_GAME'})
        self.assertIsNone(self.a.next_request(raw));f=self.a.settled(raw)
        self.assertEqual(f['money']['totalWinRaw'],500);self.assertIsNone(f['bonus'])
        self.assertEqual(f['classificationStatus'],'pending');self.assertFalse(f['captureAuthorization'])

    def test_route_overrides_mixed_features_external_jackpot_and_bad_money_remain_protected(self):
        for changes in ({'FID':'0|1|'},{'JPV':'200'},{'GSD':'FGRS~0'},{'GSD':'CFGC~6'}, {'GSD':'HCL~0;0;-1'}, {'GCT':'1'}, {'CFGG':'6'}, {'B':'100481'}):
            raw=copy.deepcopy(self.raw);rewrite(raw['steps'][6 if 'B' in changes else 1],**changes)
            with self.assertRaises(FieldError):self.a.settled(raw)

if __name__=='__main__':unittest.main()
