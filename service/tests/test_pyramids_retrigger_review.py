import copy,json,unittest
from test_pyramids_free_review import PLAN,frame,raw,rewrite
from pyramids_retrigger_review import PyramidsRetriggerSequence
from pyramids_free_review import PyramidsFreeSequence
from round_fields import FieldError
from round_fields import type_profile
from pyramids_retrigger_review import EXTENSION
from pyramids_fields import PyramidsFields

def retrigger_sample():
    return raw([frame('BET',10),frame('FREE_GAME',9,t=10,c=1),frame('FREE_GAME',18,t=20,c=2)]+[frame('FREE_GAME',n,t=20,c=20-n) for n in range(17,-1,-1)])

def negative_samples():
    values=[]
    for changes in [dict(NFG=19),dict(NFG=28,TFG=30),dict(CFGG=1,NFG=19),dict(FID='0|1|'),dict(GCT=1),dict(GSD='FGRS~1'),dict(GSD='UNKNOWN~1')]:
        x=retrigger_sample();rewrite(x['steps'][2],**changes);values.append(x)
    x=retrigger_sample();rewrite(x['steps'][0],NFG=20,TFG=20);values.append(x)
    x=retrigger_sample();x['steps'][2]['responseXml']=x['steps'][1]['responseXml'];values.append(x)
    x=retrigger_sample();x['steps'][2]['requestPayload']=x['steps'][2]['requestPayload'].replace('gdmgcmoffline-pyramids-free','gdmgcmother');values.append(x)
    for tag,value in [('OGS_RC','1'),('SUCCESS','true')]:
        x=retrigger_sample();x['steps'][2]['responseXml']=x['steps'][2]['responseXml'].replace('</GDMRESPONSE>',f'<{tag}>{value}</{tag}></GDMRESPONSE>');values.append(x)
    return values

class RetriggerReviewTest(unittest.TestCase):
    def test_full_mapping_preserves_old_scope_and_rejects_incomplete(self):
        value=retrigger_sample();parser=PyramidsFields(PLAN)
        result=parser.settled(value)
        self.assertEqual(result['bonus'],8)
        self.assertEqual(result['typeMappingHash'],type_profile(EXTENSION)[1])
        prefix={**value,'steps':value['steps'][:3]}
        self.assertEqual(parser.next_request(prefix),{'MSGID':'FREE_GAME'})
        with self.assertRaises(FieldError):parser.settled(prefix)
        from test_pyramids_free_review import sample
        self.assertEqual(parser.settled(sample())['bonus'],2)
    def test_independent_prefix_and_synthetic_cash_terminal(self):
        value=retrigger_sample();before=copy.deepcopy(value);adapter=PyramidsRetriggerSequence(PLAN)
        for count in range(1,len(value['steps'])):
            prefix={**value,'steps':value['steps'][:count]};self.assertEqual(adapter.sequence(prefix),{'MSGID':'FREE_GAME'})
            with self.assertRaises(FieldError):adapter.settled(prefix)
        self.assertTrue(adapter.settled(value)['complete']);self.assertEqual(value,before)
        with self.assertRaises(FieldError):PyramidsFreeSequence(PLAN).sequence(value)
    def test_wrong_progress_xml_session_or_feature_rejected(self):
        for value in negative_samples():
            with self.assertRaises(FieldError):PyramidsRetriggerSequence(PLAN).settled(value)
