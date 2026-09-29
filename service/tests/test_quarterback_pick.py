"""Synthetic Pick A Ball protocol tests; these are not official captured rounds."""
import copy
import unittest
from test_quarterback_fields import sample, response, PLAN
from quarterback_fields import QuarterbackFields, PICK_EXTENSION, EXTENSION
from round_fields import params, FieldError, type_profile


def pick_sample(clear=False, omit=False):
    value = sample(clear)
    for step in value['steps']:
        step['requestPayload'] = step['requestPayload'].replace('CFG=2', 'CFG=1').replace('FP=0|1|800', 'FP=0|1|1')
        old = params(step['responsePayload'])
        changed = {k.replace('_2', '_1'): ('1|' if k == 'FID' and v == '2|' else '1' if k == 'CFG' else v)
                   for k, v in old.items()}
        step['responsePayload'] = ''
        response(step, changed)
    if omit:
        response(value['steps'][-1], remove=['CFG', 'FS_1', 'NFR_1', 'CFR_1', 'CFP_1'])
    return value


class PickABallTests(unittest.TestCase):
    def setUp(self):
        self.adapter = QuarterbackFields(PLAN)

    def test_fixed_choice_and_all_prefixes(self):
        value = pick_sample()
        for n, expected in enumerate([{'MSGID':'FEATURE_START','CFG':'1'},
                                      {'MSGID':'FEATURE_PICK','CFG':'1','FP':'0|1|1'},
                                      {'MSGID':'FEATURE_END','CFG':'1'}], 1):
            partial = {**value, 'steps':value['steps'][:n]}
            self.assertEqual(self.adapter.next_request(partial), expected)
            with self.assertRaises(FieldError): self.adapter.settled(partial)
        for v in [value, pick_sample(True), pick_sample(omit=True)]:
            fields = self.adapter.settled(v)
            self.assertEqual((fields['bonus'], fields['money']['betRaw'], fields['money']['totalWinRaw']), (3,25,4000))
            self.assertEqual(fields['typeMappingHash'], type_profile(PICK_EXTENSION)[1])
            self.assertNotEqual(fields['typeMappingHash'], type_profile(EXTENSION)[1])

    def test_choice_does_not_read_start_prize(self):
        for data in ['featureData~9999;1;0', 'BVAL~5', None]:
            v = pick_sample()
            response(v['steps'][1], {'GSD':data} if data is not None else {}, [] if data is not None else ['GSD'])
            self.assertEqual(self.adapter.next_request({**v,'steps':v['steps'][:2]})['FP'], '0|1|1')
        for choice in ['0|1|0','0|1|2','0|1|3','0|2|1','1|1|1','0|1|9999']:
            v=pick_sample();v['steps'][2]['requestPayload']=v['steps'][2]['requestPayload'].replace('0|1|1',choice)
            with self.assertRaises(FieldError): self.adapter.settled(v)

    def test_foam_after_pick_never_mistaken_for_terminal(self):
        for i in range(4):
            for data in [{'FID':'1|2|'}, {'FID':'2|'}, {'FS_2':0}, {'NFR_2':1}, {'NFG':1}, {'IFG':1}, {'CFG':2}]:
                v=pick_sample();response(v['steps'][i], data)
                with self.assertRaises(FieldError): self.adapter.settled(v)

    def test_partial_end_counters_incomplete_pick_and_balance_rejected(self):
        for data in [{'CFG':1},{'FS_1':1},{'NFR_1':1},{'CFR_1':1},{'CFP_1':1}]:
            v=pick_sample(omit=True);response(v['steps'][-1],data)
            with self.assertRaises(FieldError):self.adapter.settled(v)
        for data in [{'CFR_1':0},{'CFP_1':0},{'AB':0},{'B':0},{'TW':0}]:
            v=pick_sample();response(v['steps'][-1],data)
            with self.assertRaises(FieldError):self.adapter.settled(v)

    def test_replayed_bet_changed_session_and_extra_feature_end_rejected(self):
        for case in range(4):
            v=pick_sample()
            if case==0:v['steps'][2]=copy.deepcopy(v['steps'][0])
            elif case==1:v['steps'][2]['requestPayload']=v['steps'][2]['requestPayload'].replace('gdmgcmfoam-fixture','gdmgcmchanged')
            elif case==2:v['steps'].append(copy.deepcopy(v['steps'][-1]))
            else:v['steps'][-1]['responseXml']=v['steps'][-1]['responseXml'].replace('true','false')
            with self.assertRaises(FieldError):self.adapter.settled(v)
