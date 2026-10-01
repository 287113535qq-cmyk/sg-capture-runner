"""Synthetic mixed boundaries through the real parser; no natural terminal proof."""
import copy
import unittest
from test_pyramids_free_review import PLAN, sample, frame, rewrite
from pyramids_fields import PyramidsFields
from pyramids_mixed_review import EXTENSION
from round_fields import FieldError, type_profile

def mixed_sample(extra=0):
    value=sample(); value['steps']=value['steps'][:8]
    grid='12;12;12;|'*5
    rewrite(value['steps'][0],GSD='BGRS~1;2;3;4;5;#IIFS~1')
    common='BGRS~1;2;3;4;5;#FGRS~3#CFGC~7#FGTS~10#CL~0;0;10;|#CLBN~0;0;10;|#HCL~0;0;10;|#HVA~'+grid
    rewrite(value['steps'][7],FID='0|1|',NFG=6,TFG=6,CFGG=0,GSD=common+'#FGVABN~'+grid)
    total=6+extra
    for c in range(1,total+1):
        n=total-c; win=100 if n==0 else 0
        g=common+'#HNS~1#HNSID~2#HNSRIDS~2;2;2;#CS~RESPIN'+('#HNSTW~100' if n==0 else '')
        s=frame('FREE_GAME',n,t=total,c=c,fid='0|1|')
        rewrite(s,GSD=g,B=99980+win,AB=99980+win,TW=win)
        value['steps'].append(s)
    for n in (2,1,0):
        s=frame('FREE_GAME',n)
        rewrite(s,B=100080,AB=100080,TW=100,GSD='BGRS~1;2;3;4;5;#FGRS~'+str(n)+'#CFGC~'+str(10-n))
        value['steps'].append(s)
    for s in value['steps']:s['methodName']='processGameMessage'
    return value

def negative_samples():
    result=[]
    def change(index,**kwargs):
        raw=mixed_sample();rewrite(raw['steps'][index],**kwargs);result.append(raw)
    change(8,NFG=5,CFGG=0)
    change(8,GSD='FGRS~2#CFGC~8#FGTS~10')
    change(14,FID='0|1|')
    change(8,GCT=1)
    change(8,FRBAL=1)
    change(8,B=99981)
    change(13,TW=99,B=100079,AB=100079)
    change(-1,AB=100079)
    change(8,GSD='UNKNOWN~1')
    for coin in ('-4','-3','-2','-0'):
        raw=mixed_sample();p=raw['steps'][7]['responsePayload'].split('GSD=',1)[1]
        rewrite(raw['steps'][7],GSD=p.replace('0;0;10;|','0;0;'+coin+';|'));result.append(raw)
    raw=mixed_sample();raw['steps'][8]['requestPayload']=raw['steps'][8]['requestPayload'].replace('gdmgcmoffline-pyramids-free','gdmgcmdifferent');result.append(raw)
    raw=mixed_sample();raw['steps'][8]['methodName']='unknown';result.append(raw)
    raw=mixed_sample();del raw['steps'][8];result.append(raw)
    for index in (7,8):
        for field in ('SUCCESS','PAYLOAD'):
            raw=mixed_sample();s=raw['steps'][index]
            s['responseXml']=s['responseXml'].replace('</GDMRESPONSE>',f'<{field}>true</{field}></GDMRESPONSE>');result.append(raw)
            raw=mixed_sample();s=raw['steps'][index]
            s['responseXml']=s['responseXml'].replace(f'</{field}>',f'<NESTED/></{field}>');result.append(raw)
    return result

class MixedTests(unittest.TestCase):
    def test_real_entry_all_prefixes_mapping_and_money(self):
        parser=PyramidsFields(PLAN)
        for extra in (0,2,4):
            raw=mixed_sample(extra);before=copy.deepcopy(raw)
            for i in range(1,len(raw['steps'])):
                prefix={**raw,'steps':raw['steps'][:i]}
                self.assertEqual(parser.next_request(prefix),{'MSGID':'FREE_GAME'})
                with self.assertRaises(FieldError):parser.settled(prefix)
            self.assertIsNone(parser.next_request(raw))
            fields=parser.settled(raw)
            self.assertEqual(fields['bonus'],4)
            self.assertEqual(fields['typeMappingHash'],type_profile(EXTENSION)[1])
            self.assertEqual(fields['money'],{'startBalanceRaw':100000,'endBalanceRaw':100080,'totalWinRaw':100,'betRaw':20})
            self.assertEqual(raw,before)

    def test_bad_shapes_refused_at_real_entry(self):
        for index,raw in enumerate(negative_samples()):
            with self.subTest(index=index),self.assertRaises((FieldError,ValueError)):
                PyramidsFields(PLAN).settled(raw)

if __name__=='__main__':unittest.main()
