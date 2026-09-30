"""Synthetic terminal and bounded rejection cases for the offline candidate."""
import copy
import json
import sys
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'service'), str(ROOT / 'service/tests')]
from test_morepuff_fields import sample, VA
from test_jinzita_fields import rewrite
from morepuff_megahat_review import inspect, EXTENSION
from morepuff_fields import MorepuffSequence
from test_morepuff_fields import PLAN
from round_fields import FieldError, type_profile


def fixture():
    raw = sample()
    rewrite(raw['steps'][1], FID='1|2|', NFG=1, TFG=1, CFGG=0, IFG=1,
            GSD=f'VA~{VA}#WHSTOP~3#WHSLICE~MEGAHAT#WHEELSPIN~1')
    tail = copy.deepcopy(raw['steps'][1])
    rewrite(tail, FID='0|', NFG=0, TFG=1, CFGG=1, IFG=1, B=98500, AB=98500, TW=500,
            GSD=f'VA~{VA}')
    raw['steps'].append(tail)
    return raw


def mutations():
    result = []
    for i, changes in [(1, {'FID': '2|1|'}), (1, {'NFG': 0, 'CFGG': 1}),
            (1, {'TFG': 2}), (2, {'TFG': 6, 'NFG': 5}), (2, {'FID': '1|2|'}),
            (2, {'CFGG': 0}), (2, {'NFG': 1}), (2, {'IFG': 0}), (2, {'RID': 3}),
            (2, {'GCT': 1}), (2, {'FRBAL': 1}), (2, {'TW': 501}),
            (2, {'AB': 98501}), (2, {'B': 98501, 'AB': 98501}),
            (1, {'GSD': f'VA~{VA}#WHSTOP~6#WHSLICE~MEGAHAT#WHEELSPIN~1'}),
            (1, {'GSD': f'VA~{VA}#WHSTOP~3#WHSLICE~UNKNOWN#WHEELSPIN~1'}),
            (2, {'GSD': f'VA~{VA}#WHSTOP~3'}), (2, {'GSD': f'VA~{VA}#FRAMEWINS~100'}),
            (2, {'GSD': f'VA~{VA}#FEAT~FREE'}), (2, {'GSD': f'VA~{VA}#UNKNOWN~1'}),
            (2, {'GSD': f'VA~{VA}#VA~{VA}'}),
            (2, {'GSD': 'VA~13,13,13,14,14,14,14,14,14,0,0,0,0,0,0'})]:
        raw = fixture()
        rewrite(raw['steps'][i], **changes)
        result.append(raw)
    for kind in ('session', 'stake', 'extra', 'missing'):
        raw = fixture()
        if kind == 'session':
            raw['steps'][2]['requestPayload'] = raw['steps'][2]['requestPayload'].replace('offline-wheel', 'other')
        elif kind == 'stake':
            raw['steps'][2]['requestPayload'] = raw['steps'][2]['requestPayload'].replace('BPR=100', 'BPR=101')
        elif kind == 'extra':
            raw['steps'].append(copy.deepcopy(raw['steps'][2]))
        else:
            raw['steps'].pop(1)
        result.append(raw)
    return result


class MegaHatReviewTests(unittest.TestCase):
    def test_prefix_and_synthetic_terminal(self):
        raw = fixture()
        for count in (1, 2):
            r = inspect({**raw, 'steps': raw['steps'][:count]})
            self.assertEqual((r['next'], r['complete']), ('FREE_GAME', False))
        self.assertEqual(inspect(raw), dict(next=None, complete=True,
            kind='wheel-megahat-single-free', endBalanceRaw=98500, totalWinRaw=500, betRaw=2000))

    def test_shape_counter_money_session_and_further_features(self):
        for i, raw in enumerate(mutations()):
            with self.subTest(case=i), self.assertRaises(FieldError):
                inspect(raw)
            with self.subTest(production_case=i), self.assertRaises(FieldError):
                MorepuffSequence(PLAN).settled(raw)

    def test_xml_full_evidence_required(self):
        for kind in ('missing', 'mismatch', 'entity'):
            raw = fixture()
            raw['steps'][2]['responseXml'] = {'missing': None, 'mismatch': raw['steps'][0]['responseXml'],
                                              'entity': '<!ENTITY unsafe "x">'}[kind]
            with self.subTest(case=kind), self.assertRaises(FieldError):
                inspect(raw)

    def test_production_next_and_additive_mapping(self):
        raw = fixture()
        fields = MorepuffSequence(PLAN).settled(raw)
        self.assertEqual(fields['bonus'], 3)
        self.assertEqual(fields['typeMappingHash'], type_profile(EXTENSION)[1])
        self.assertEqual(fields['money']['betRaw'], 2000)
        self.assertEqual(MorepuffSequence(PLAN).next_request({**raw, 'steps':raw['steps'][:2]}), {'MSGID':'FREE_GAME'})


if __name__ == '__main__':
    if '--json' in sys.argv:
        raw = fixture()
        print(json.dumps(dict(positive=[dict(raw={**raw, 'steps': raw['steps'][:n]},
            result=inspect({**raw, 'steps': raw['steps'][:n]})) for n in (1, 2, 3)], negative=mutations(),
            normalized=MorepuffSequence(PLAN).settled(raw), mappingHash=type_profile(EXTENSION)[1])))
    else:
        unittest.main()
