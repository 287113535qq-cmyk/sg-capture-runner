import copy,unittest
from test_pyramids_free_review import sample,rewrite,PLAN
from pyramids_super_free_review import PyramidsSuperFreeSequence,EXTENSION
from pyramids_fields import PyramidsFields
from round_fields import FieldError,params,type_profile

def super_sample():
    raw=sample()
    for step in raw['steps']:rewrite(step,GSD=params(step['responsePayload'])['GSD']+'#SFGT~1')
    return raw

class SuperFreeTests(unittest.TestCase):
    def test_independent_mapping_and_prefixes(self):
        raw=super_sample();before=copy.deepcopy(raw);parser=PyramidsFields(PLAN)
        fields=parser.settled(raw);self.assertEqual(fields['bonus'],7);self.assertEqual(fields['typeMappingHash'],type_profile(EXTENSION)[1])
        for n in range(1,11):
            prefix={**raw,'steps':raw['steps'][:n]}
            self.assertEqual(parser.next_request(prefix),{'MSGID':'FREE_GAME'})
            with self.assertRaises(FieldError):parser.settled(prefix)
        self.assertEqual(raw,before)
        self.assertEqual(parser.settled(sample())['bonus'],2)
    def test_mixed_flags_counters_money_and_xml_refused(self):
        parser=PyramidsSuperFreeSequence(PLAN)
        for i,changes in [(0,{'GSD':'SFGT~0'}),(0,{'GSD':'SFGT~2'}),(1,{'GSD':'SFGT~1#SHNST~1'}),(1,{'GSD':'SFGT~1#UNKNOWN~1'}),(1,{'FID':'0|1|'}),(1,{'TFG':15,'NFG':14}),(1,{'GCT':1}),(10,{'TW':10}),(1,{'GSD':'SFGT~1#CL~0;0;-3;|'})]:
            raw=super_sample();rewrite(raw['steps'][i],**changes)
            with self.subTest(changes=changes),self.assertRaises(FieldError):parser.settled(raw)
        for text in ['<OGS_RC>1</OGS_RC>','<OGS_RC>0</OGS_RC><OGS_RC>0</OGS_RC>','<SUCCESS>true</SUCCESS>','<X><SUCCESS>true</SUCCESS></X>']:
            raw=super_sample();s=raw['steps'][1];s['responseXml']=s['responseXml'].replace('<GDMRESPONSE>','<GDMRESPONSE>'+text)
            with self.assertRaises(FieldError):parser.settled(raw)
