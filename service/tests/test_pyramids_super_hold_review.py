import copy,json,unittest
from pathlib import Path
from pyramids_fields import PyramidsFields
from pyramids_super_hold_review import has_super_hold,EXTENSION
from round_fields import type_profile,FieldError
from tests.test_inca_free_review import rewrite
from tests.test_pyramids_hold_review import sample,super_display_sample,PLAN

def super_sample():
    raw=sample()
    for s in raw['steps']:
        rewrite(s,GSD=s['responsePayload'].split('GSD=',1)[1].split('&',1)[0]+'#SHNST~1')
    return raw

class SuperHoldTests(unittest.TestCase):
    def test_independent_cash_mapping_and_all_prefixes(self):
        parser=PyramidsFields(PLAN);raw=super_sample();before=copy.deepcopy(raw)
        value=parser.settled(raw);self.assertEqual(value['bonus'],6);self.assertEqual(value['typeMappingHash'],type_profile(EXTENSION)[1]);self.assertEqual(raw,before)
        for n in range(1,len(raw['steps'])):
            p={**raw,'steps':raw['steps'][:n]};self.assertEqual(parser.next_request(p),{'MSGID':'FREE_GAME'})
            with self.assertRaises(FieldError):parser.settled(p)
    def test_first_only_display_remains_old_mapping(self):
        self.assertFalse(has_super_hold(super_display_sample()))
        parser=PyramidsFields(PLAN);self.assertEqual(parser.settled(sample()),parser.settled(super_display_sample()))
    def test_official_return_code_zero_and_malformed_outer_xml(self):
        raw=super_sample()
        for s in raw['steps']:s['responseXml']=s['responseXml'].replace('<GDMRESPONSE>','<GDMRESPONSE><OGS_RC>0</OGS_RC>')
        self.assertEqual(PyramidsFields(PLAN).settled(raw)['bonus'],6)
        for text in ['<OGS_RC>1</OGS_RC>','<OGS_RC>0</OGS_RC><OGS_RC>0</OGS_RC>','<X><SUCCESS>true</SUCCESS></X>']:
            bad=super_sample();bad['steps'][1]['responseXml']=bad['steps'][1]['responseXml'].replace('<GDMRESPONSE>','<GDMRESPONSE>'+text)
            with self.subTest(text=text),self.assertRaises(FieldError):PyramidsFields(PLAN).settled(bad)
    def test_unknown_combinations_money_and_missing_frames_refused(self):
        for values in [{'FID':'0|1|'},{'GCT':'1'},{'NFG':'0'},{'CFGG':'2'},{'GSD':'SHNST~0'},{'GSD':'SHNST~2'},{'GSD':'SHNST~1#WHSTOP~0'},{'TW':'999999'}]:
            raw=super_sample();rewrite(raw['steps'][-1 if 'TW' in values else 1],**values)
            with self.subTest(values=values),self.assertRaises(FieldError):PyramidsFields(PLAN).settled(raw)
        for mode in ['session','missing','duplicate-xml']:
            raw=super_sample()
            if mode=='session':raw['steps'][1]['requestPayload']=raw['steps'][1]['requestPayload'].replace('fixture-pyramids','other')
            if mode=='missing':raw['steps'].pop(2)
            if mode=='duplicate-xml':raw['steps'][1]['responseXml']=raw['steps'][1]['responseXml'].replace('<SUCCESS>true</SUCCESS>','<SUCCESS>true</SUCCESS><SUCCESS>true</SUCCESS>')
            with self.subTest(mode=mode),self.assertRaises(FieldError):PyramidsFields(PLAN).settled(raw)
