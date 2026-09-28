"""Synthetic sequences only. They do not establish live FID1 settlement."""
import copy
import json
from pathlib import Path
import sys
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'service'), str(ROOT / 'scripts/runner-v2')]
from demon_fields import DemonFields, SOURCE, EXTENSION
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError, VERSION, params, type_profile
from record_fields import execute

PLAN = json.loads((ROOT / 'config/round-one-plans.json').read_text())['32739']


def exchange(msg, nfg=None, fid='0|', win=0, **extra):
    req = {**PLAN['requestParams'], 'MSGID': msg, 'PID': 'gdmgcmdemon-fixture'}
    p = {'MSGID': msg, 'FID': fid, 'IFG': int(msg == 'FREE_GAME'),
         'B': 99900 + win, 'AB': 99900 + win, 'TW': win}
    if nfg is not None:
        p.update(NFG=nfg, TFG=max(nfg, 10), CFGG=10-min(nfg, 10))
    p.update(extra)
    payload = '&'.join(f'{k}={v}' for k, v in p.items())
    root = ET.Element('GDMRESPONSE')
    ET.SubElement(root, 'SUCCESS').text = 'true'
    ET.SubElement(root, 'PAYLOAD').text = payload
    return {'msgId': msg, 'requestPayload': '&'.join(f'{k}={v}' for k, v in req.items()),
            'responsePayload': payload, 'responseXml': ET.tostring(root, encoding='unicode'), 'elapsedMs': 1}


def raw(steps):
    return {'fixtureOnly': False, 'protocol': 'nextgen', 'sourceKey': SOURCE,
            'roundFieldsVersion': VERSION, 'startBalanceRaw': 100000, 'steps': steps}


def sample(clear_fid=False):
    # Reaction NFG remains 1 while TFG grows, then counters reset at FID1.
    steps = [exchange('BET', 1, TFG=1, CFGG=0)]
    steps += [exchange('FREE_GAME', 1, TFG=i+1, CFGG=i, win=i*10) for i in range(1, 8)]
    steps += [exchange('FREE_GAME', 10, '1|0|', TFG=10, CFGG=0, win=70),
              exchange('FREE_GAME', 11, '1|0|', TFG=12, CFGG=1, win=100),
              exchange('FREE_GAME', 0, '0|' if clear_fid else '1|0|', TFG=12, CFGG=12, win=500)]
    return raw(steps)


class DemonFieldsTests(unittest.TestCase):
    def setUp(self):
        self.adapter = DemonFields(PLAN)

    def test_reaction_to_free_mode_retrigger_and_terminal_fid_reset(self):
        for clear in (False, True):
            value = sample(clear)
            for n in range(1, len(value['steps'])):
                partial = {**value, 'steps': value['steps'][:n]}
                self.assertEqual(self.adapter.next_request(partial), {'MSGID': 'FREE_GAME'})
                with self.assertRaises(FieldError):
                    self.adapter.settled(partial)
            fields = self.adapter.settled(value)
            self.assertIsNone(self.adapter.next_request(value))
            self.assertEqual((fields['bonus'], fields['buy'], fields['money']['betRaw']), (2, 0, 100))
            self.assertEqual(fields['typeMappingHash'], type_profile(EXTENSION)[1])

    def test_ordinary_and_fid_zero_keep_the_exact_original_fields(self):
        for value in [raw([exchange('BET')]), raw([exchange('BET', 1), exchange('FREE_GAME', 0, win=100)])]:
            self.assertEqual(self.adapter.settled(value), NativeNextgenFields(PLAN).settled(value))
            self.assertEqual(self.adapter.settled(value)['typeMappingHash'], type_profile(SOURCE)[1])

    def test_unknown_stacks_and_pick_messages_are_not_reinterpreted(self):
        for fid in ['2|', '1|', '0|1|0|', '1|0|0|', '01|0|']:
            with self.subTest(fid=fid), self.assertRaisesRegex(FieldError, 'UNKNOWN_TRIAL_FEATURE'):
                self.adapter.next_request(raw([exchange('BET', 10, fid)]))
        for extra in [{'FS_1': 0}, {'NFR_1': 1}, {'CFG': 1}, {'ABPM': 1}]:
            with self.assertRaisesRegex(FieldError, 'UNKNOWN_TRIAL_FEATURE'):
                self.adapter.next_request(raw([exchange('BET', 1, **extra)]))

    def test_free_counter_missing_is_not_settled_zero(self):
        for key in ['NFG', 'TFG', 'CFGG']:
            value = sample()
            frame = value['steps'][-1]
            p = params(frame['responsePayload'])
            del p[key]
            frame['responsePayload'] = '&'.join(f'{k}={v}' for k, v in p.items())
            with self.assertRaisesRegex(FieldError, 'DEMON_MISSING_FREE_COUNTER'):
                self.adapter.next_request(value)

    def test_paid_replay_extra_free_and_changed_session_rejected(self):
        for case in range(3):
            value = sample()
            if case == 0:
                value['steps'][2] = exchange('BET', 1)
            elif case == 1:
                value['steps'].append(exchange('FREE_GAME', 0, win=500))
            else:
                value['steps'][1]['requestPayload'] = value['steps'][1]['requestPayload'].replace('gdmgcmdemon-fixture', 'gdmgcmother')
            with self.assertRaises(FieldError):
                self.adapter.settled(value)

    def test_trigger_without_a_following_free_response_is_not_complete(self):
        value = raw([exchange('BET', 1), exchange('FREE_GAME', 0, '1|0|', win=10)])
        with self.assertRaisesRegex(FieldError, 'DEMON_EMPTY_FREE_TRIGGER'):
            self.adapter.settled(value)

    def test_xml_and_final_balance_and_actual_stake_must_reconcile(self):
        for case in range(4):
            value = sample()
            if case == 0:
                value['steps'][-1]['responseXml'] = value['steps'][-1]['responseXml'].replace('<SUCCESS>true', '<SUCCESS>false')
            elif case == 1:
                value['steps'][-1] = exchange('FREE_GAME', 0, '1|0|', win=500, AB=99900)
            elif case == 2:
                value['startBalanceRaw'] += 1
            else:
                value['steps'][0]['requestPayload'] += '&ABPM=1'
            with self.assertRaises(FieldError):
                self.adapter.settled(value)

    def test_legacy_adapter_still_rejects_fid_one_for_other_games(self):
        with self.assertRaisesRegex(FieldError, 'UNKNOWN_TRIAL_FEATURE'):
            NativeNextgenFields(PLAN).next_request({**sample(), 'steps': sample()['steps'][:9]})
        with self.assertRaisesRegex(FieldError, 'DEMON_PROFILE_REQUIRED'):
            DemonFields({**PLAN, 'gameId': 32717})

    def test_mongo_v2_analyzer_resumes_same_successful_bet_and_verifies_record(self):
        value = sample()
        partial = {**value, 'steps': value['steps'][:9]}
        request = {'plan': PLAN, 'raw': partial}
        self.assertEqual(execute({**request, 'op': 'next'}), {'MSGID': 'FREE_GAME'})
        self.assertTrue(execute({**request, 'op': 'intent', 'payload': value['steps'][9]['requestPayload']})['validated'])
        with self.assertRaises(FieldError):
            execute({**request, 'op': 'intent', 'payload': value['steps'][0]['requestPayload']})
        fields = self.adapter.settled(value)
        record = execute({'op': 'record', 'plan': PLAN, 'raw': value, 'normalized': fields,
                          'sequence': 432, 'attempt': 'offline-fixture', 'sessionHash': 'a'*64, 'worker': 0, 'batchId': 5})
        self.assertTrue(execute({'op': 'verify', 'plan': PLAN, 'raw': value, 'record': record})['verified'])
        wrong = copy.deepcopy(record)
        wrong['normalized']['bonus'] = 1
        with self.assertRaises(AssertionError):
            execute({'op': 'verify', 'plan': PLAN, 'raw': value, 'record': wrong})


if __name__ == '__main__':
    unittest.main()
