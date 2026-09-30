import copy,json,unittest
from pathlib import Path
from pyramids_hold_review import PyramidsHoldSequence
from round_fields import FieldError
from tests.test_inca_free_review import rewrite

ROOT=Path(__file__).resolve().parents[2]
PLAN=json.loads((ROOT/'config/round-one-plans.json').read_text())['32721']
def sample():return json.loads((ROOT/'scripts/trial/fixtures/pyramids-hold-synthetic.json').read_text())

class PyramidsReviewTests(unittest.TestCase):
    def test_extensions_prefixes_and_complete_money(self):
        raw=sample();original=copy.deepcopy(raw);p=PyramidsHoldSequence(PLAN)
        for n in range(1,len(raw['steps'])):
            prefix={**raw,'steps':raw['steps'][:n]}
            self.assertEqual(p.next_request(prefix),{'MSGID':'FREE_GAME'})
            with self.assertRaises(FieldError):p.settled(prefix)
        self.assertEqual(p.settled(raw)['money']['betRaw'],20)
        self.assertEqual(raw,original)

    def test_unknown_or_inconsistent_chain_never_settles(self):
        mutations=[(0,{'FID':'1|'}),(1,{'FID':'0|1|'}),(1,{'JPV':'x'}),(1,{'GCT':1}),
                   (1,{'FRBAL':1}),(1,{'CFGG':2}),(1,{'TFG':7,'NFG':6}),
                   (1,{'GSD':'HNS~1#HNS~1'}),(1,{'GSD':'MANSION~1'}),
                   (8,{'TW':99}),(8,{'B':100081,'AB':100081}),(8,{'AB':100079})]
        for i,changes in mutations:
            r=sample();rewrite(r['steps'][i],**changes)
            with self.subTest(changes=changes),self.assertRaises(FieldError):PyramidsHoldSequence(PLAN).settled(r)
        for mode in ['missing','extra','session','xml','grand']:
            r=sample()
            if mode=='missing':r['steps'].pop(2)
            if mode=='extra':r['steps'].append(copy.deepcopy(r['steps'][-1]))
            if mode=='session':r['steps'][1]['requestPayload']=r['steps'][1]['requestPayload'].replace('fixture-pyramids','other')
            if mode=='xml':r['steps'][1]['responseXml']=r['steps'][0]['responseXml']
            if mode=='grand':
                g=r['steps'][0]['responsePayload'].split('GSD=',1)[1].replace('CL~0;0;20','CL~0;0;-1')
                rewrite(r['steps'][0],GSD=g)
            with self.subTest(mode=mode),self.assertRaises(FieldError):PyramidsHoldSequence(PLAN).settled(r)

if __name__=='__main__':unittest.main()
