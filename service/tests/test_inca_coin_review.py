import copy
import unittest
from inca_coin_review import IncaCoinSequence
from inca_free_review import IncaSequence
from round_fields import FieldError
from tests.test_inca_free_review import PLAN, sample, rewrite


def coin_sample():
    raw=sample()
    for step in raw['steps']:rewrite(step,GSD='CL~0;1;20;|2;4;800;|#BGCL~1;2;10;|')
    return raw


class CoinRepairTests(unittest.TestCase):
    def test_prefixes_and_terminal_keep_original_xml_evidence(self):
        raw=sample()
        for step in raw['steps']:
            rewrite(step,GSD='CL~0;1;20;|2;4;800;|#BGCL~1;2;10;|')
        original=copy.deepcopy(raw)
        parser=IncaCoinSequence(PLAN)
        for n in range(1,11):
            self.assertEqual(parser.next_request({**raw,'steps':raw['steps'][:n]}),{'MSGID':'FREE_GAME'})
        self.assertTrue(parser.settled(raw)['complete'])
        self.assertEqual(raw,original)
        with self.assertRaises(FieldError):IncaSequence(PLAN).settled(raw)

    def test_unreviewed_coins_and_other_features_remain_rejected(self):
        for gsd in ['CL~0;0;-4;', 'CL~0;0;999;', 'CL~3;0;20;', 'CL~0;5;20;',
                    'CL~0;0;20;|0;0;40;', 'CL~0;0;20;||', 'CL~', 'CL~0;0;20;#HCL~0;0;20;',
                    'BGCL~0;0;20;9;', 'CL~0;0;20;#CL~0;0;20;']:
            raw=sample();rewrite(raw['steps'][0],GSD=gsd)
            with self.subTest(gsd=gsd),self.assertRaises(FieldError):IncaCoinSequence(PLAN).settled(raw)
        raw=sample();rewrite(raw['steps'][1],FID='1|0|',GSD='CL~0;0;20;')
        with self.assertRaises(FieldError):IncaCoinSequence(PLAN).settled(raw)


if __name__=='__main__':unittest.main()
