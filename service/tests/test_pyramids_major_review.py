import copy, unittest
from test_pyramids_free_review import PLAN, sample, rewrite
from pyramids_free_review import PyramidsFreeSequence
from pyramids_fields import PyramidsFields
from pyramids_major_review import PyramidsMajorSequence, EXTENSION
from round_fields import FieldError, type_profile

def major_sample():
    value=sample()
    rewrite(value['steps'][1],GSD='CL~0;0;-3;|#CLBN~0;0;-3;|#FSRS~1;2;3;4;5;')
    return value

class MajorReviewTests(unittest.TestCase):
    def test_all_prefixes_original_evidence_and_additive_mapping(self):
        raw=major_sample();saved=copy.deepcopy(raw);parser=PyramidsFields(PLAN)
        for i in range(1,11):
            self.assertEqual(parser.next_request({**raw,'steps':raw['steps'][:i]}),{'MSGID':'FREE_GAME'})
        result=parser.settled(raw)
        self.assertEqual(result['bonus'],3)
        self.assertEqual(result['typeMappingHash'],type_profile(EXTENSION)[1])
        self.assertEqual(result['money'],parser.settled(sample())['money'])
        self.assertEqual(raw,saved)
        with self.assertRaisesRegex(FieldError,'PYRAMIDS_FREE_UNREVIEWED_COIN'):
            PyramidsFreeSequence(PLAN).sequence(raw)

    def test_invalid_geometry_symbols_alias_xml_counter_and_money_rejected(self):
        for text in ('0;0;-5;|','0;0;-2;|','0;0;-4;|','3;0;-3;|','0;5;-3;|',
                     '0;0;-3;|0;0;20;|','0;0;-3;|3;0;-4;|','0;0;-0;|'):
            raw=major_sample();rewrite(raw['steps'][1],GSD='CL~'+text)
            with self.subTest(text=text),self.assertRaises(FieldError):PyramidsFields(PLAN).settled(raw)
        for index,changes in ((0,{'GSD':'CL~0;0;-3;|'}),(1,{'GSD':'BGCL~0;0;-3;|'}),
                (1,{'GSD':'CL~0;0;-3;|#CLBN~0;0;20;|'}),(1,{'CFGG':0}),
                (1,{'GCT':1}),(10,{'B':99990,'AB':99990})):
            raw=major_sample();rewrite(raw['steps'][index],**changes)
            with self.subTest(changes=changes),self.assertRaises(FieldError):PyramidsFields(PLAN).settled(raw)
        raw=major_sample();raw['steps'][1]['responseXml']=raw['steps'][0]['responseXml']
        with self.assertRaises(FieldError):PyramidsFields(PLAN).settled(raw)

if __name__=='__main__':unittest.main()
