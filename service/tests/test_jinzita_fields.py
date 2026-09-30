"""Synthetic standalone free termination, failure boundaries and real routing."""
import copy
import json
from pathlib import Path
import sys
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'service'), str(ROOT / 'scripts/runner-v2')]
from jinzita_fields import JinzitaSequence, SOURCE, EXTENSION
from round_fields import FieldError, VERSION, type_profile
from native_nextgen_fields import NativeNextgenFields
from record_fields import execute
PLAN = json.loads((ROOT / 'config/round-one-plans.json').read_text())['32720']


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


def frame(msg, n, t=3, c=None, fid='1|'):
    step = dict(msgId=msg, elapsedMs=1,
                requestPayload='&'.join(f'{k}={v}' for k,v in {
                    **PLAN['requestParams'], 'PID':'gdmgcmoffline-jinzita', 'MSGID':msg}.items()),
                responsePayload='MSGID='+msg)
    return rewrite(step, FID=fid, NFG=n, TFG=t, CFGG=t-n if c is None else c,
                   IFG=int(msg=='FREE_GAME'), B=99980, AB=99980, TW=0, GSD='FID~[]#BP~false')


def raw(steps):
    return dict(protocol='nextgen', sourceKey=SOURCE, fixtureOnly=False,
                roundFieldsVersion=VERSION, startBalanceRaw=100000, steps=steps)


def sample(retrigger=False):
    steps=[frame('BET',3)]
    if retrigger:
        steps += [frame('FREE_GAME',4,5,1), *[frame('FREE_GAME',n,5) for n in range(3,-1,-1)]]
    else:
        steps += [frame('FREE_GAME',n) for n in range(2,-1,-1)]
    return raw(steps)


class JinzitaTests(unittest.TestCase):
    def test_complete_and_retrigger_actual_analyzer_route(self):
        self.assertEqual(type_profile(SOURCE)[1], 'b8c2ad67152633870401788d541b21624b54a03f7140ba6757505039f9bb56b5')
        for value in (sample(), sample(True)):
            for i in range(1,len(value['steps'])):
                partial={**value,'steps':value['steps'][:i]}
                self.assertEqual(execute(dict(plan=PLAN,op='next',raw=partial)), {'MSGID':'FREE_GAME'})
                with self.assertRaises(FieldError): JinzitaSequence(PLAN).settled(partial)
            result=JinzitaSequence(PLAN).settled(value)
            self.assertEqual(result['bonus'],2)
            self.assertEqual(result['typeMappingHash'],type_profile(EXTENSION)[1])
            self.assertIsNone(execute(dict(plan=PLAN,op='next',raw=value)))

    def test_legacy_complete_fields_unchanged(self):
        for value in (raw([rewrite(frame('BET',0,fid=''),NFG=None,TFG=None,CFGG=None)]),
                      raw([frame('BET',1,1,fid='0|'),frame('FREE_GAME',0,1,fid='0|')])):
            self.assertEqual(JinzitaSequence(PLAN).settled(value), NativeNextgenFields(PLAN).settled(value))

    def test_counter_feature_terminal_and_money_negative_boundaries(self):
        mutations=[(1,{'FID':f}) for f in ('0|','2|','10|','11|','1|0|','')]
        mutations += [(1,{'NFG':None}),(1,{'CFGG':0}),(1,{'TFG':2}),
                      (1,{'GSD':'CFG~1'}),(1,{'GCT':1}),(1,{'GSD':'FGRS~9'}),(3,{'GSD':'FGRS~1'}),(1,{'GSD':'CFGC~9'}),(1,{'GSD':'FID~[0]'}),
                      (3,{'NFG':None}),(0,{'NFG':0,'CFGG':3}),
                      (3,{'B':99901,'AB':99901})]
        for i,changes in mutations:
            value=sample();rewrite(value['steps'][i],**changes)
            with self.subTest(changes=changes),self.assertRaises(FieldError): JinzitaSequence(PLAN).settled(value)
        value=sample();value['steps']=value['steps'][:2];rewrite(value['steps'][1],NFG=0,CFGG=3)
        with self.assertRaises(FieldError): JinzitaSequence(PLAN).settled(value)

    def test_xml_session_and_after_terminal_rejected(self):
        for kind in ('xml','session','extra'):
            value=sample()
            if kind=='xml': value['steps'][1]['responseXml']=value['steps'][0]['responseXml']
            if kind=='session': value['steps'][1]['requestPayload']=value['steps'][1]['requestPayload'].replace('offline-jinzita','other')
            if kind=='extra': value['steps'].append(copy.deepcopy(value['steps'][-1]))
            with self.assertRaises(FieldError): JinzitaSequence(PLAN).settled(value)


if __name__ == '__main__': unittest.main()
