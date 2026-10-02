import copy,unittest
from test_pyramids_free_review import PLAN,rewrite
from test_pyramids_super_free_review import super_sample
from pyramids_super_coin_review import PyramidsSuperCoinSequence,EXTENSION
from pyramids_super_free_review import PyramidsSuperFreeSequence
from pyramids_fields import PyramidsFields
from round_fields import FieldError,type_profile

def super_coin_sample(symbol=-4):
    raw=super_sample()
    for i,step in enumerate(raw['steps']):
        rewrite(step,GSD='BGRS~1;2;3;4;5;#SFGT~1'+(f'#CL~0;0;{symbol};|' if i else ''))
    return raw

class SuperCoinTests(unittest.TestCase):
    def test_composition_has_separate_mapping_and_preserves_prefixes(self):
        parser=PyramidsFields(PLAN)
        for symbol in (-4,-3,-2):
            raw=super_coin_sample(symbol);before=copy.deepcopy(raw)
            result=parser.settled(raw)
            self.assertEqual(result['bonus'],10)
            self.assertEqual(result['typeMappingHash'],type_profile(EXTENSION)[1])
            self.assertEqual(raw,before)
            for n in range(1,11):
                prefix={**raw,'steps':raw['steps'][:n]}
                self.assertEqual(parser.next_request(prefix),{'MSGID':'FREE_GAME'})
                with self.assertRaises(FieldError):parser.settled(prefix)
            with self.assertRaisesRegex(FieldError,'UNREVIEWED_COIN'):PyramidsSuperFreeSequence(PLAN).sequence(raw)
        self.assertEqual(parser.settled(super_sample())['bonus'],7)
    def test_unknown_compositions_and_wallets_are_rejected(self):
        for changes in [dict(FID='0|1|'),dict(TFG=15,NFG=14),dict(GCT=1),dict(B=99981),dict(AB=99981),dict(GSD='SFGT~1#SHNST~1'),dict(GSD='SFGT~2#CL~0;0;-4;|'),dict(GSD='SFGT~1#CL~0;0;-1;|'),dict(GSD='SFGT~1#CL~0;0;-5;|'),dict(GSD='SFGT~1#CL~3;0;-4;|')]:
            raw=super_coin_sample();rewrite(raw['steps'][1],**changes)
            with self.subTest(changes=changes),self.assertRaises(FieldError):PyramidsSuperCoinSequence(PLAN).sequence(raw)
        raw=super_coin_sample();raw['steps'][1]['responseXml']='<GDMRESPONSE/>'
        with self.assertRaises(FieldError):PyramidsSuperCoinSequence(PLAN).sequence(raw)
    def test_pending_account_balance_remains_uncredited(self):
        raw=super_coin_sample()
        for i,step in enumerate(raw['steps']):
            terminal=i==10
            rewrite(step,TW=20 if i else 0,B=100000 if i else 99980,AB=100000 if terminal else 99980)
            step['responseBalance']=100000 if terminal else 99980
        self.assertIsNone(PyramidsSuperCoinSequence(PLAN).sequence(raw))
        raw['steps'][1]['responseBalance']=100000
        with self.assertRaisesRegex(FieldError,'RESPONSE_BALANCE'):PyramidsSuperCoinSequence(PLAN).sequence(raw)
