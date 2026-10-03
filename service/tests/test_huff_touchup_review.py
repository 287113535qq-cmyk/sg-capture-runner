"""Synthetic Touch Up chains: independent Python/JS decisions, no source IO."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'service'))
from huff_touchup_review import review_touchup
from huff_feature_review import SOURCE
from round_fields import FieldError, params

PLAN = json.loads((ROOT/'config/round-one-plans.json').read_text())['32714']


def update(step, **values):
    p = params(step['responsePayload'])
    p.update({k: str(v) for k, v in values.items()})
    step['responsePayload'] = '&'.join(f'{k}={v}' for k, v in p.items())
    root = ET.Element('GDMRESPONSE')
    ET.SubElement(root, 'SUCCESS').text = 'true'
    ET.SubElement(root, 'PAYLOAD').text = step['responsePayload']
    step['responseXml'] = ET.tostring(root, encoding='unicode')


def sample():
    raw = {'sourceKey': SOURCE, 'protocol': 'nextgen', 'startBalanceRaw': 100000, 'steps': []}
    board = ','.join(['15']*15)
    for i in range(8):
        msg = 'FREE_GAME' if i else 'BET'
        gsd = f'VA~{board}'
        if i == 0:
            fid, n, c, t = '0|', 1, 0, 1
            gsd += '#MMBG~1'
        elif i == 1:
            fid, n, c, t = '2|', 6, 0, 6
            gsd += '#MMBG~1#MMW~fixture#FEAT~MMANSION#PCFID~0|'
        else:
            fid, n, c, t = '2|', 7-i, i-1, 6
            gsd += '#FEAT~PAINT#PCFID~2|#FRAMES~'+'|'.join(['1']*15)
            gsd += '#FRAMEWINS~'+'|'.join(['0']*15)
        req = {**PLAN['requestParams'], 'MSGID': msg, 'PID': 'gdmgcmtouchup-fixture'}
        s = {'msgId': msg, 'elapsedMs': 1, 'responsePayload': '',
             'requestPayload': '&'.join(f'{k}={v}' for k, v in req.items())}
        update(s, MSGID=msg, IFG=int(i>0), FID=fid, NFG=n, CFGG=c, TFG=t,
               RID=0, B=99500, AB=99500, TW=0, GSD=gsd)
        raw['steps'].append(s)
    return raw


def node_reviews(values):
    code = """import fs from 'node:fs';
import {reviewTouchup} from './scripts/trial/huff-touchup-review.mjs';
console.log(JSON.stringify(JSON.parse(fs.readFileSync(0,'utf8')).map(x=>{
try{return reviewTouchup(x)}catch{return {rejected:true}}})));"""
    r = subprocess.run(['node', '--input-type=module', '-e', code], cwd=ROOT,
                       input=json.dumps(values), text=True, capture_output=True, check=True)
    return json.loads(r.stdout)


class TouchupReviewTests(unittest.TestCase):
    def test_reviewed_display_values_share_scope_without_new_feature_permission(self):
        values=[]
        for value in ('1.5','-1','-2','-3','-4.00','-5'):
            raw=sample();step=raw['steps'][-1]
            update(step, GSD=params(step['responsePayload'])['GSD'].replace('FRAMEWINS~0|','FRAMEWINS~'+value+'|'))
            values.append(raw)
        for raw, node in zip(values,node_reviews(values)):
            result=review_touchup(PLAN,raw);self.assertEqual(result,node)
            self.assertTrue(result['candidateComplete']);self.assertFalse(result['captureAuthorized'])

    def test_partial_and_complete_are_only_offline_candidates(self):
        values = [{**sample(), 'steps': sample()['steps'][:n]} for n in range(2, 9)]
        for raw, node in zip(values, node_reviews(values)):
            result = review_touchup(PLAN, raw)
            self.assertEqual(result, node)
            self.assertFalse(result['captureAuthorized'])
            self.assertEqual(result['candidateComplete'], len(raw['steps']) == 8)
            self.assertFalse(result['naturalTerminalObserved'])

    def test_both_implementations_reject_unsafe_exits_and_progress(self):
        values = []
        for patch in ({'FID':'2|1|'}, {'FID':'3|'}, {'NFG':'0','CFGG':'0'},
                      {'TFG':'7'}, {'RID':'1'}, {'GCT':'0'}, {'FRBAL':'1'},
                      {'TW':'1'}, {'AB':'99501'}, {'B':'99501'}, {'IFG':'0'}):
            raw = sample(); update(raw['steps'][-1], **patch); values.append(raw)
        base = params(sample()['steps'][-1]['responsePayload'])['GSD']
        for g in (base+'#UNKNOWN~1', base.replace('PAINT','HOMEIMP'),
                  base.replace('PCFID~2|','PCFID~0|2|'), base+'#MMBG~1',
                  base.replace('FRAMEWINS~0|','FRAMEWINS~-100|'),
                  base.replace('FRAMEWINS~0|','FRAMEWINS~-6|'),
                  base.replace(','.join(['15']*15), ','.join(['13']*3+['14']*6+['15']*6)),
                  base.split('#FRAMEWINS')[0], base+'#MMW~new-feature'):
            raw=sample(); update(raw['steps'][-1], GSD=g); values.append(raw)
        raw=sample(); raw['steps'][-1]['requestPayload']=raw['steps'][-1]['requestPayload'].replace('gdmgcmtouchup-fixture','gdmgcmother'); values.append(raw)
        raw=sample(); raw['steps'].append(copy.deepcopy(raw['steps'][-1])); values.append(raw)
        raw=sample(); del raw['steps'][3]; values.append(raw)
        for raw, node in zip(values, node_reviews(values)):
            with self.assertRaises(FieldError): review_touchup(PLAN, raw)
            self.assertEqual(node, {'rejected':True})

    def test_xml_evidence_is_independently_required_by_python(self):
        raw=sample(); raw['steps'][-1]['responseXml']='<GDMRESPONSE/>'
        with self.assertRaises(FieldError): review_touchup(PLAN, raw)

    def test_review_does_not_mutate_evidence(self):
        raw=sample(); before=copy.deepcopy(raw)
        review_touchup(PLAN,raw)
        self.assertEqual(raw,before)


if __name__ == '__main__': unittest.main()
