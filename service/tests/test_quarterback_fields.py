"""Synthetic foam sequences: no claim of observed live feature settlement."""
import copy
import json
from pathlib import Path
import sys
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'service'), str(ROOT / 'scripts/runner-v2')]
from quarterback_fields import QuarterbackFields, SOURCE, EXTENSION
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError, VERSION, params, type_profile, derive
from record_fields import execute

PLAN = json.loads((ROOT / 'config/round-one-plans.json').read_text())['32836']


def response(step, changes=None, remove=()):
    p = params(step['responsePayload'])
    p.update({k: str(v) for k, v in (changes or {}).items()})
    for k in remove:
        p.pop(k, None)
    step['responsePayload'] = '&'.join(f'{k}={v}' for k, v in p.items())
    root = ET.Element('GDMRESPONSE')
    ET.SubElement(root, 'SUCCESS').text = 'true'
    ET.SubElement(root, 'PAYLOAD').text = step['responsePayload']
    step['responseXml'] = ET.tostring(root, encoding='unicode')
    return step


def exchange(msg, **extra):
    req = {**PLAN['requestParams'], 'MSGID': msg, 'PID': 'gdmgcmfoam-fixture'} if msg in {'BET', 'FREE_GAME'} else {
        'GN': PLAN['runtimeSlug'], 'MSGID': msg, 'PID': 'gdmgcmfoam-fixture', 'CFG': '2'}
    if msg == 'FEATURE_PICK':
        req['FP'] = '0|1|800'
    return response({'msgId': msg, 'requestPayload': '&'.join(f'{k}={v}' for k, v in req.items()),
                     'responsePayload': '', 'elapsedMs': 1},
                    {'MSGID': msg, 'B': 99975, 'AB': 99975, 'TW': 0, 'IFG': int(msg == 'FREE_GAME'), **extra})


def raw(steps):
    return {'fixtureOnly': False, 'protocol': 'nextgen', 'sourceKey': SOURCE,
            'roundFieldsVersion': VERSION, 'startBalanceRaw': 100000, 'steps': steps}


def sample(clear=False):
    steps = [exchange('BET', FID='2|', CFG=2, FS_2=0, NFR_2=1, CFR_2=0, CFP_2=0, FPM_2='|',
                      FTV_2='800;0;4;800;900;1875;1500;|', GSD='BVAL~5#display~fixture'),
             exchange('FEATURE_START', FID='2|', CFG=2, FS_2=1, NFR_2=1, CFR_2=0, CFP_2=0,
                      GSD='BVAL~5#featureData~800;900;1875;1500'),
             exchange('FEATURE_PICK', FID='2|', CFG=2, FS_2=1, NFR_2=1, CFR_2=1, CFP_2=1, TW=4000),
             exchange('FEATURE_END', FID='2|', CFG=2, FS_2=1, NFR_2=1, CFR_2=1, CFP_2=1,
                      TW=4000, B=103975, AB=103975)]
    if clear:
        response(steps[-1], {'FID': ''}, ['CFG', 'FS_2', 'NFR_2', 'CFR_2', 'CFP_2'])
    return raw(steps)


class QuarterbackFieldsTests(unittest.TestCase):
    def setUp(self):
        self.adapter = QuarterbackFields(PLAN)

    def test_prefixes_start_pick_end_and_awarded_count_terminal(self):
        expected = [{'MSGID': 'FEATURE_START', 'CFG': '2'},
                    {'MSGID': 'FEATURE_PICK', 'CFG': '2', 'FP': '0|1|800'},
                    {'MSGID': 'FEATURE_END', 'CFG': '2'}]
        for clear in (False, True):
            value = sample(clear)
            for n, next_step in enumerate(expected, 1):
                partial = {**value, 'steps': value['steps'][:n]}
                self.assertEqual(self.adapter.next_request(partial), next_step)
                with self.assertRaises(FieldError):
                    self.adapter.settled(partial)
            self.assertIsNone(self.adapter.next_request(value))
            f = self.adapter.settled(value)
            self.assertEqual((f['bonus'], f['buy'], f['money']['betRaw'], f['money']['totalWinRaw']), (2, 0, 25, 4000))
            self.assertEqual(f['typeMappingHash'], type_profile(EXTENSION)[1])

    def test_missing_nfg_is_not_used_to_finish_bet_or_start(self):
        value = sample()
        self.assertNotIn('NFG', params(value['steps'][0]['responsePayload']))
        self.assertEqual(self.adapter.next_request({**value, 'steps': value['steps'][:1]})['MSGID'], 'FEATURE_START')
        value['steps'][1] = response(value['steps'][1], remove=['FS_2', 'FID'])
        self.assertEqual(self.adapter.next_request({**value, 'steps': value['steps'][:2]})['FP'], '0|1|800')

    def test_server_first_value_not_button_position_or_largest_prize(self):
        for pick in ['0|1|0', '0|1|1875', '1|1|800', '0|2|800']:
            value = sample()
            value['steps'][2]['requestPayload'] = value['steps'][2]['requestPayload'].replace('0|1|800', pick)
            with self.assertRaises(FieldError):
                self.adapter.settled(value)

    def test_start_data_missing_duplicate_or_unbounded_is_rejected(self):
        for gsd in ['', 'BVAL~5', 'featureData~800#featureData~900', 'featureData~',
                    'featureData~800;x', 'featureData~1;2;3;4;5;6', 'featureData~9007199254740992']:
            value = sample()
            response(value['steps'][1], {'GSD': gsd})
            with self.assertRaises(FieldError):
                self.adapter.next_request({**value, 'steps': value['steps'][:2]})

    def test_unknown_stacks_other_features_and_free_combinations_stay_unsupported(self):
        for extra in [{'FID': '1|'}, {'FID': '2|0|'}, {'FID': '1|2|'}, {'FS_1': 1}, {'CFG': 1},
                      {'NFG': 1}, {'IFG': 1}, {'ABPM': 1}, {'NFR_2': 2}]:
            value = sample()
            response(value['steps'][0], extra)
            with self.assertRaisesRegex(FieldError, 'UNKNOWN_TRIAL_FEATURE'):
                self.adapter.next_request({**value, 'steps': value['steps'][:1]})

    def test_pending_end_does_not_become_complete(self):
        for extra, remove in [({'CFR_2': 0}, []), ({'CFP_2': 0}, []), ({}, ['CFR_2']), ({'NFG': 1}, [])]:
            value = sample()
            response(value['steps'][-1], extra, remove)
            with self.assertRaises(FieldError):
                self.adapter.settled(value)

    def test_no_skipped_start_duplicate_pick_extra_end_paid_replay_or_session_change(self):
        for case in range(5):
            value = sample()
            if case == 0:
                del value['steps'][1]
            elif case == 1:
                value['steps'][3] = value['steps'][2]
            elif case == 2:
                value['steps'].append(value['steps'][-1])
            elif case == 3:
                value['steps'][2] = value['steps'][0]
            else:
                value['steps'][2]['requestPayload'] = value['steps'][2]['requestPayload'].replace('gdmgcmfoam-fixture', 'gdmgcmother')
            with self.assertRaises(FieldError):
                self.adapter.settled(value)

    def test_xml_money_paid_cost_and_request_mode_independently_verified(self):
        for case in range(5):
            value = sample()
            if case == 0:
                value['steps'][-1]['responseXml'] = value['steps'][-1]['responseXml'].replace('<SUCCESS>true', '<SUCCESS>false')
            elif case == 1:
                response(value['steps'][-1], {'AB': 99975})
            elif case == 2:
                value['startBalanceRaw'] += 1
            elif case == 3:
                value['steps'][0]['requestPayload'] += '&ABPM=1'
            else:
                value['steps'][-1]['responseBalance'] = 99975
            with self.assertRaises(FieldError):
                self.adapter.settled(value)

    def test_base_and_fid_zero_fields_and_mapping_hash_remain_exact(self):
        for value in [raw([exchange('BET')]), raw([exchange('BET', FID='0|', NFG=1),
                     exchange('FREE_GAME', FID='0|', NFG=0, TW=50, B=100025, AB=100025)])]:
            self.assertEqual(self.adapter.settled(value), NativeNextgenFields(PLAN).settled(value))
            self.assertEqual(self.adapter.settled(value)['typeMappingHash'], type_profile(SOURCE)[1])

    def test_other_games_keep_generic_nfr_protection(self):
        value = sample()
        with self.assertRaises(FieldError):
            QuarterbackFields({**PLAN, 'gameId': 32651})
        with self.assertRaisesRegex(FieldError, 'UNKNOWN_TRIAL_FEATURE'):
            NativeNextgenFields(PLAN).next_request({**value, 'steps': value['steps'][:1]})
        value['sourceKey'] = 'other'
        with self.assertRaisesRegex(FieldError, 'INCOMPLETE_ROUND'):
            derive(value)

    def test_mongo_analyzer_accepts_only_next_request_then_full_record(self):
        value = sample()
        for n in range(1, 4):
            request = {'plan': PLAN, 'raw': {**value, 'steps': value['steps'][:n]}}
            self.assertTrue(execute({**request, 'op': 'intent', 'payload': value['steps'][n]['requestPayload']})['validated'])
            with self.assertRaises((FieldError, AssertionError)):
                execute({**request, 'op': 'intent', 'payload': value['steps'][0]['requestPayload']})
        fields = self.adapter.settled(value)
        record = execute({'op': 'record', 'plan': PLAN, 'raw': value, 'normalized': fields,
                          'sequence': 113, 'attempt': 'offline-fixture', 'sessionHash': 'a'*64, 'worker': 21, 'batchId': 2})
        self.assertTrue(execute({'op': 'verify', 'plan': PLAN, 'raw': value, 'record': record})['verified'])
        wrong = copy.deepcopy(record)
        wrong['normalized']['bonus'] = 1
        with self.assertRaises(AssertionError):
            execute({'op': 'verify', 'plan': PLAN, 'raw': value, 'record': wrong})


if __name__ == '__main__':
    unittest.main()
