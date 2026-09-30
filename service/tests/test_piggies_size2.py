import copy,unittest
from test_piggies_fields import sample as base, rewrite, PLAN
from piggies_fields import PiggiesFields,SOURCE,SIZE2_EXTENSION
from round_fields import type_profile,FieldError,params

def sample():
    raw=base(False);first=raw['steps'][0];raw['steps']=[]
    for i in range(10):
        s=copy.deepcopy(first);msg='FREE_GAME' if i else 'BET';s['msgId']=msg;s['requestPayload']=s['requestPayload'].replace('MSGID=BET','MSGID='+msg)
        rewrite(s,MSGID=msg,NFG=9-i,TFG=9,CFGG=i,IFG=int(i>0),FGT=9 if i==0 else None,GSD='GT~1#BT~1#PGS2~-45#GE2~45#PGG~1#VA~0');raw['steps'].append(s)
    return raw

class Size2Tests(unittest.TestCase):
    def test_prefixes_and_independent_mapping(self):
        a=PiggiesFields(PLAN);raw=sample()
        for n in range(1,10):
            part={**raw,'steps':raw['steps'][:n]};self.assertEqual(a.next_request(part),{'MSGID':'FREE_GAME'})
            with self.assertRaises(FieldError):a.settled(part)
        fields=a.settled(raw);self.assertEqual(fields['bonus'],1);self.assertEqual(fields['typeMappingHash'],type_profile(SIZE2_EXTENSION)[1]);self.assertNotEqual(fields['typeMappingHash'],type_profile(SOURCE)[1])
        self.assertEqual(a.settled(base())['typeMappingHash'],type_profile(SOURCE)[1])
    def test_unknown_mixed_money_xml_and_counter_reject(self):
        for update in [dict(GSD='GT~1#BT~1#PGG~1#EP4~1'),dict(GSD='GT~0#BT~1#PGG~1'),dict(GSD='GT~1#BT~1#PGG~1#PGS2~-45#GE2~-1'),dict(GSD='GT~1#BT~1#PGG~1#PGS2~-45#GE2~45#UNKNOWN~1'),dict(FID='1|'),dict(GCT=1),dict(NFG=1),dict(TFG=10),dict(CFGG=8),dict(B=99901),dict(AB=99901),dict(TW=1),dict(FRBAL=1)]:
            r=sample();rewrite(r['steps'][-1],**update)
            with self.assertRaises(FieldError):PiggiesFields(PLAN).settled(r)
        r=sample();r['steps'][2]['requestPayload']=r['steps'][2]['requestPayload'].replace('gdmgcmpiggies-offline','gdmgcmdifferent')
        with self.assertRaises(FieldError):PiggiesFields(PLAN).settled(r)
        r=sample();r['steps'][-1]['responseXml']='bad'
        with self.assertRaises(FieldError):PiggiesFields(PLAN).settled(r)
if __name__=='__main__':unittest.main()
