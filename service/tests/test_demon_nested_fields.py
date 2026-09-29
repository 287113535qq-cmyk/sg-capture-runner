"""Fabricated nested transition fixtures; not official SG results."""
import copy,json,pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'service'))
from demon_nested_fields import DemonNestedFields,EXTENSION
from round_fields import FieldError,type_profile

class DemonNestedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan=json.loads((ROOT/'config/round-one-plans.json').read_text())['32739']
        cls.cases=json.loads((ROOT/'fixtures/demon-nested-synthetic.json').read_text())

    def test_portable_transition_boundaries(self):
        adapter=DemonNestedFields(self.plan)
        for c in self.cases:
            with self.subTest(name=c['name']):
                if c.get('reject'):
                    with self.assertRaises((FieldError,ValueError)):adapter.next_request(c['raw'])
                else:self.assertEqual(adapter.next_request(c['raw']),c['next'])

    def test_synthetic_settlement_and_mapping(self):
        raw=copy.deepcopy(next(c['raw'] for c in self.cases if c['name']=='explicit outer terminal'))
        raw['fixtureOnly']=False
        fields=DemonNestedFields(self.plan).settled(raw)
        self.assertEqual(fields['bonus'],2)
        self.assertEqual(fields['typeMappingHash'],type_profile(EXTENSION)[1])
        self.assertEqual(fields['money'],{'startBalanceRaw':10000,'endBalanceRaw':10000,'totalWinRaw':100,'betRaw':100})
        for kind in ['balance','wager','incomplete']:
            r=copy.deepcopy(raw)
            if kind=='balance':r['steps'][-1]['responseBalance']=9999
            elif kind=='wager':r['startBalanceRaw']=9999
            else:r['steps'].pop()
            with self.subTest(kind=kind),self.assertRaises(FieldError):DemonNestedFields(self.plan).settled(r)

if __name__=='__main__':unittest.main()
