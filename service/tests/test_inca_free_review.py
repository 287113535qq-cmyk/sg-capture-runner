"""Synthetic standalone free termination, failure boundaries and real routing."""
import copy
import json
from pathlib import Path
import sys
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'service'), str(ROOT / 'scripts/runner-v2')]
from inca_free_review import IncaSequence, SOURCE
from round_fields import FieldError, VERSION, type_profile
from native_nextgen_fields import NativeNextgenFields
from record_fields import execute
PLAN = json.loads((ROOT / 'config/round-one-plans.json').read_text())['32719']


def rewrite(step, **changes):
    p = dict(item.split('=', 1) for item in step['responsePayload'].split('&'))
    p.update({k:str(v) for k,v in changes.items() if v is not None})
    for k,v in changes.items():
        if v is None: p.pop(k, None)
    step['responsePayload'] = '&'.join(f'{k}={v}' for k,v in p.items())
    xml = ET.Element('GDMRESPONSE')
    ET.SubElement(xml, 'SUCCESS').text = 'true'
    ET.SubElement(xml, 'PAYLOAD').text = step['responsePayload']
    step['responseXml'] = ET.tostring(xml, encoding='unicode')
    return step


def frame(msg, n, t=10, c=None, fid='1|'):
    step = dict(msgId=msg, elapsedMs=1,
                requestPayload='&'.join(f'{k}={v}' for k,v in {
                    **PLAN['requestParams'], 'PID':'gdmgcmoffline-jinzita', 'MSGID':msg}.items()),
                responsePayload='MSGID='+msg)
    return rewrite(step, FID=fid, NFG=n, TFG=t, CFGG=t-n if c is None else c,
                   IFG=int(msg=='FREE_GAME'), B=99980, AB=99980, TW=0, GSD='BGRS~1;2;3;4;5;#NWI~1;4;')


def raw(steps):
    return dict(protocol='nextgen', sourceKey=SOURCE, fixtureOnly=False,
                roundFieldsVersion=VERSION, startBalanceRaw=100000, steps=steps)


def sample():
    return raw([frame('BET',10)] + [frame('FREE_GAME',n) for n in range(9,-1,-1)])


class IncaReviewTests(unittest.TestCase):
    def test_all_prefixes_and_synthetic_terminal(self):
        value=sample();parser=IncaSequence(PLAN)
        for i in range(1,11):
            prefix={**value,'steps':value['steps'][:i]}
            self.assertEqual(parser.sequence(prefix),{'MSGID':'FREE_GAME'})
            with self.assertRaises(FieldError):parser.settled(prefix)
        result=parser.settled(value)
        self.assertEqual(result['betRaw'],20);self.assertTrue(result['complete'])
        self.assertFalse(result['captureAuthorized'])
        rewrite(value['steps'][-1],GSD='FGRS~0#CFGC~10')
        self.assertEqual(parser.settled(value),result)

    def test_unreviewed_features_counters_and_amounts(self):
        mutations=[(1,{'FID':f}) for f in ('0|','2|','1|0|','0|1|','1|1|','')]
        mutations += [(1,{'NFG':None}),(1,{'CFGG':0}),(1,{'TFG':11,'NFG':10}),
            (10,{'GSD':'FGRS~2#CFGC~10'}),(1,{'GSD':'CFGC~8'}),
            (1,{'GSD':'HRS~1'}),(1,{'GSD':'IIFS~1'}),(1,{'GSD':'NWI~1#NWI~2'}),
            (1,{'GCT':1}),(1,{'FRBAL':1}),(1,{'FS_1':1}),(1,{'CFG':1}),
            (10,{'B':99990,'AB':99990}),(10,{'AB':99999}),(0,{'IFG':1})]
        for i,changes in mutations:
            value=sample();rewrite(value['steps'][i],**changes)
            with self.subTest(changes=changes),self.assertRaises(FieldError):IncaSequence(PLAN).settled(value)

    def test_xml_session_sequence_profile_and_missing_frames(self):
        for kind in ('xml','session','extra','missing','source','game','doctype'):
            value=sample();plan=dict(PLAN)
            if kind=='xml':value['steps'][1]['responseXml']=value['steps'][0]['responseXml']
            if kind=='session':value['steps'][1]['requestPayload']=value['steps'][1]['requestPayload'].replace('offline-jinzita','other')
            if kind=='extra':value['steps'].append(copy.deepcopy(value['steps'][-1]))
            if kind=='missing':value['steps'].pop(1)
            if kind=='source':value['sourceKey']='hyperchargedjinzita96-round-one-base-v1'
            if kind=='game':plan['gameId']=32720
            if kind=='doctype':value['steps'][1]['responseXml']='<!DOCTYPE a>'+value['steps'][1]['responseXml']
            with self.subTest(kind=kind),self.assertRaises(FieldError):IncaSequence(plan).settled(value)

if __name__=='__main__':unittest.main()
