"""Synthetic wheel cash exits and conservative failure boundaries."""
import copy
import json
from pathlib import Path
import sys
import unittest
ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'service'), str(ROOT / 'scripts/runner-v2')]
from morepuff_fields import MorepuffSequence, SOURCE, EXTENSION
from round_fields import FieldError, VERSION, type_profile
from native_nextgen_fields import NativeNextgenFields
from record_fields import execute
from test_jinzita_fields import rewrite
PLAN = json.loads((ROOT / 'config/round-one-plans.json').read_text())['32718']
VA = '13,13,13,0,0,0,0,0,0,0,0,0,0,0,0'


def sample(stop=0, win=0):
    steps = []
    for i in range(2):
        msg = 'FREE_GAME' if i else 'BET'
        step = dict(msgId=msg, elapsedMs=1, requestPayload='&'.join(f'{k}={v}' for k,v in {
            **PLAN['requestParams'], 'PID':'gdmgcmoffline-wheel', 'MSGID':msg}.items()), responsePayload='MSGID='+msg)
        steps.append(rewrite(step, FID='0|' if i else '2|', NFG=1-i, TFG=1, CFGG=i,
            IFG=i, RID=0, B=98000+(win if i else 0), AB=98000+(win if i else 0), TW=win if i else 0,
            GSD=f'VA~{VA}#'+(f'WHSTOP~{stop}' if i else 'BMS~13'), FRBAL=0))
    return dict(sourceKey=SOURCE, protocol='nextgen', roundFieldsVersion=VERSION,
                fixtureOnly=False, startBalanceRaw=100000, steps=steps)


class MorepuffTests(unittest.TestCase):
    def test_cash_cases_analyzer_and_unchanged_base_hash(self):
        self.assertEqual(type_profile(SOURCE)[1], 'a537d5692ce49c0bb4407f0cf652608fe56e2f16da353bf5c98b8a849bad2e1c')
        for stop in (0, 2, 7, 8, 11):
            value=sample(stop, stop*100)
            self.assertEqual(execute(dict(plan=PLAN,op='next',raw={**value,'steps':value['steps'][:1]})), {'MSGID':'FREE_GAME'})
            self.assertIsNone(execute(dict(plan=PLAN,op='next',raw=value)))
            fields=MorepuffSequence(PLAN).settled(value)
            self.assertEqual(fields['bonus'],2)
            self.assertEqual(fields['money']['betRaw'],2000)
            self.assertEqual(fields['typeMappingHash'],type_profile(EXTENSION)[1])

    def test_old_base_remains_identical(self):
        value=sample();value['steps']=value['steps'][:1]
        rewrite(value['steps'][0],FID=None,NFG=None,TFG=None,CFGG=None)
        self.assertEqual(MorepuffSequence(PLAN).settled(value),NativeNextgenFields(PLAN).settled(value))

    def test_further_unknown_combined_counter_and_money_refused(self):
        mutations=[{'GSD':f'VA~{VA}#WHSTOP~{stop}'} for stop in (1,3,4,5,6,9,10,12)]
        mutations += [{'FID':f} for f in ('2|','0|1|','10|','11|','')]
        mutations += [{'NFG':None},{'TFG':2},{'CFGG':0},{'GCT':1},{'FRBAL':1},
            {'GSD':f'VA~{VA}#WHSTOP~0#FEAT~MANSION'}, {'GSD':f'VA~{VA}#WHSTOP~0#CFG~0'},
            {'GSD':'VA~13,13,13,14,14,14,14,14,14,0,0,0,0,0,0#WHSTOP~0'},
            {'GSD':f'VA~{VA}#WHSTOP~0#WHSTOP~0'}, {'B':99000,'AB':99000}]
        for changes in mutations:
            value=sample();rewrite(value['steps'][1],**changes)
            with self.subTest(changes=changes),self.assertRaises(FieldError):MorepuffSequence(PLAN).settled(value)

    def test_xml_session_partial_extra_and_fid_after_first_rejected(self):
        for kind in ('xml','session','partial','extra','late'):
            value=sample()
            if kind=='xml':value['steps'][1]['responseXml']=value['steps'][0]['responseXml']
            if kind=='session':value['steps'][1]['requestPayload']=value['steps'][1]['requestPayload'].replace('offline-wheel','other')
            if kind=='partial':value['steps'].pop()
            if kind=='extra':value['steps'].append(copy.deepcopy(value['steps'][1]))
            if kind=='late':rewrite(value['steps'][0],FID='0|');rewrite(value['steps'][1],FID='2|')
            with self.subTest(kind=kind),self.assertRaises(FieldError):MorepuffSequence(PLAN).settled(value)

    def test_observed_continuation_shape_remains_unsettled(self):
        value=sample(3)
        rewrite(value['steps'][1],FID='1|2|',NFG=1,TFG=1,CFGG=0,IFG=1,
                GSD=f'VA~{VA}#WHSTOP~3#WHSLICE~0')
        with self.assertRaises(FieldError):execute(dict(plan=PLAN,op='next',raw=value))
        with self.assertRaises(FieldError):MorepuffSequence(PLAN).settled(value)


if __name__=='__main__':unittest.main()
