"""Fifteen counter family: synthetic exits, never a natural-terminal claim."""
import copy
import unittest
from test_pyramids_free_review import PLAN, frame, raw, rewrite
from test_pyramids_mixed_review import mixed_sample
from pyramids_fields import PyramidsFields
from pyramids_free_review import PyramidsFreeSequence
from pyramids_fifteen_review import EXTENSION
from round_fields import FieldError, type_profile

def fifteen_sample(mixed=False, extra=0):
    if not mixed:
        return raw([frame('BET',15,t=15)]+[frame('FREE_GAME',n,t=15) for n in range(14,-1,-1)])
    value=mixed_sample(extra)
    for s in value['steps'][:7]:
        p=dict(q.split('=',1) for q in s['responsePayload'].split('&'))
        rewrite(s,NFG=int(p['NFG'])+5,TFG=15)
    for s in value['steps'][7:14+extra]:
        p=dict(q.split('=',1) for q in s['responsePayload'].split('&'))
        rewrite(s,GSD=p['GSD'].replace('FGTS~10','FGTS~15').replace('FGRS~3','FGRS~8'))
    tail=[]
    for n in range(7,-1,-1):
        s=frame('FREE_GAME',n,t=15)
        rewrite(s,B=100080,AB=100080,TW=100,GSD=f'BGRS~1;2;3;4;5;#FGRS~{n}#CFGC~{15-n}')
        s['methodName']='processGameMessage';tail.append(s)
    value['steps']=value['steps'][:14+extra]+tail
    return value

def negative_samples():
    values=[]
    for index,changes in ((0,{'TFG':20,'NFG':20}),(1,{'TFG':10}),(1,{'CFGG':0}),
            (1,{'GCT':1}),(1,{'B':99981}),(1,{'GSD':'UNKNOWN~1'}),(-1,{'AB':99981})):
        value=fifteen_sample();rewrite(value['steps'][index],**changes);values.append(value)
    value=fifteen_sample();del value['steps'][8];values.append(value)
    value=fifteen_sample();value['steps'][1]['requestPayload']=value['steps'][1]['requestPayload'].replace('gdmgcmoffline-pyramids-free','gdmgcmdifferent');values.append(value)
    value=fifteen_sample();value['steps'][1]['responseXml']=value['steps'][1]['responseXml'].replace('</GDMRESPONSE>','<SUCCESS>true</SUCCESS></GDMRESPONSE>');values.append(value)
    value=fifteen_sample(True);rewrite(value['steps'][-1],TFG=10);values.append(value)
    return values

class FifteenTests(unittest.TestCase):
    def test_all_prefixes_exit_and_new_mapping(self):
        parser=PyramidsFields(PLAN)
        for value in [fifteen_sample()]+[fifteen_sample(True,e) for e in (0,2,4)]:
            saved=copy.deepcopy(value)
            for i in range(1,len(value['steps'])):
                prefix={**value,'steps':value['steps'][:i]}
                self.assertEqual(parser.next_request(prefix),{'MSGID':'FREE_GAME'})
                with self.assertRaises(FieldError):parser.settled(prefix)
            result=parser.settled(value)
            self.assertEqual(result['bonus'],5)
            self.assertEqual(result['typeMappingHash'],type_profile(EXTENSION)[1])
            self.assertIsNone(parser.next_request(value));self.assertEqual(value,saved)
    def test_mutations_and_old_counter_scope_rejected(self):
        for index,value in enumerate(negative_samples()):
            with self.subTest(index=index),self.assertRaises((FieldError,ValueError)):
                PyramidsFields(PLAN).settled(value)
        with self.assertRaises(FieldError):PyramidsFreeSequence(PLAN).sequence(fifteen_sample())
