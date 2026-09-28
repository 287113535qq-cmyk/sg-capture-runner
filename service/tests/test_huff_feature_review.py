import json
from pathlib import Path
import sys
import unittest
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'service'))
from huff_feature_review import SOURCE, inspect_frame, review_round
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError


class HuffFeatureReviewTests(unittest.TestCase):
    def setUp(self):
        self.plan = json.loads((ROOT / 'config/round-one-plans.json').read_text())['32714']

    def step(self, msg='BET', fid='1|', remaining='6', gsd='', **extra):
        request = '&'.join(f'{k}={v}' for k, v in {
            **self.plan['requestParams'], 'MSGID': msg, 'PID': 'gdmgcmhuff-fixture'}.items())
        response = '&'.join(f'{k}={v}' for k, v in {
            'MSGID': msg, 'IFG': '1' if msg == 'FREE_GAME' else '0', 'NFG': remaining,
            'TFG': '6', 'CFGG': '0', 'B': '99500', 'AB': '99500', 'TW': '0',
            'FID': fid, 'GSD': gsd, **extra}.items())
        return {'msgId': msg, 'requestPayload': request, 'responsePayload': response,
                'elapsedMs': 1, 'responseXml': '<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'
                + escape(response) + '</PAYLOAD></GDMRESPONSE>'}

    def raw(self, *steps):
        return {'sourceKey': SOURCE, 'protocol': 'nextgen', 'fixtureOnly': True, 'steps': list(steps)}

    def test_hard_hat_trigger_is_evidence_only_and_does_not_enable_runtime(self):
        step = self.step()
        result = review_round(self.plan, self.raw(step))
        self.assertEqual(result['observedFeatureIds'], [1])
        self.assertEqual(result['frames'][0]['featureNames'], ['HARD_HAT_FS'])
        self.assertEqual(result['clientContinuationHint'], 'FREE_GAME')
        self.assertFalse(result['captureAuthorized'])
        self.assertFalse(result['settlementVerified'])
        with self.assertRaisesRegex(FieldError, 'UNKNOWN_TRIAL_FEATURE'):
            NativeNextgenFields(self.plan).frame(step)

    def test_fid_slots_and_current_replay_are_preserved_separately(self):
        frame = inspect_frame(self.plan, self.step('FREE_GAME', '2|1|', '4',
                                                  'FEAT~HARDHAT#PCFID~1|0|'))
        self.assertEqual(frame['featureIds'], [2, 1])
        self.assertEqual(frame['previousFeatureIds'], [1, 0])
        self.assertEqual(frame['replayFeatureId'], 1)
        self.assertTrue(frame['combinationObserved'])
        self.assertFalse(frame['captureAuthorized'])

    def test_five_named_replays_are_distinct(self):
        for i, name in enumerate(('MMANSION', 'HARDHAT', 'PAINT', 'HOMEIMP', 'MANSION')):
            with self.subTest(name=name):
                frame = inspect_frame(self.plan, self.step('FREE_GAME', f'{i}|', '0', f'FEAT~{name}'))
                self.assertEqual(frame['replayFeatureId'], i)

    def test_mansion_flag_with_result_is_not_an_extra_spin_counter(self):
        pending = inspect_frame(self.plan, self.step(fid='0|', remaining='0', gsd='MMBG~1'))
        final = inspect_frame(self.plan, self.step('FREE_GAME', '0|', '0',
                                                  'MMBG~1#MMW~1;8;-1;-1;10000#FEAT~MMANSION'))
        self.assertEqual(pending['clientContinuationHint'], 'FREE_GAME')
        self.assertIsNone(final['clientContinuationHint'])
        self.assertFalse(final['settlementVerified'])

    def test_partial_chain_does_not_claim_settlement(self):
        result = review_round(self.plan, self.raw(self.step(), self.step('FREE_GAME', '1|', '5', 'FEAT~HARDHAT')))
        self.assertEqual(result['observedReplayIds'], [1])
        self.assertEqual(result['clientContinuationHint'], 'FREE_GAME')
        self.assertFalse(result['settlementVerified'])

    def test_absent_ordinary_counters_are_reported_as_missing_not_zero(self):
        step = self.step(fid='', remaining='0')
        step['responsePayload'] = '&'.join(p for p in step['responsePayload'].split('&')
                                          if p.split('=', 1)[0] not in {'FID', 'NFG', 'TFG', 'CFGG'})
        step['responseXml'] = '<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>' + escape(step['responsePayload']) + '</PAYLOAD></GDMRESPONSE>'
        frame = inspect_frame(self.plan, step)
        self.assertEqual(frame['counters'], {'NFG': None, 'TFG': None, 'CFGG': None})
        self.assertFalse(frame['fidPresent'])
        self.assertFalse(frame['settlementVerified'])

    def test_missing_free_counter_is_not_a_terminal_zero(self):
        step = self.step('FREE_GAME', '1|', '0')
        step['responsePayload'] = step['responsePayload'].replace('&NFG=0', '')
        step['responseXml'] = '<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>' + escape(step['responsePayload']) + '</PAYLOAD></GDMRESPONSE>'
        with self.assertRaisesRegex(FieldError, 'HUFF_MISSING_FEATURE_COUNTER'):
            inspect_frame(self.plan, step)

    def test_unknown_and_malformed_feature_ids_fail_closed(self):
        for value in ('5|', '-1|', '1||', '1|1|', '0|1|2|', 'garbage'):
            with self.subTest(value=value), self.assertRaises(FieldError):
                inspect_frame(self.plan, self.step(fid=value))

    def test_unknown_replay_or_ambiguous_gsd_fails_closed(self):
        for value in ('FEAT~UNKNOWN', 'FEAT~HARDHAT#FEAT~MMANSION', 'PCFID~9|', 'MMBG~2', 'FEAT'):
            with self.subTest(value=value), self.assertRaises(FieldError):
                inspect_frame(self.plan, self.step(gsd=value))

    def test_unknown_feature_messages_and_counters_are_rejected(self):
        for values in ({'CFG': '1'}, {'FS_1': '0'}, {'NFR_1': '1'}, {'ABPM': '1'},
                       {'NFG': '-1'}, {'CFGG': '101'}, {'TFG': 'x'}, {'B': '-1'}):
            with self.subTest(values=values), self.assertRaises(FieldError):
                inspect_frame(self.plan, self.step(**values))

    def test_xml_must_match_full_response(self):
        step = self.step()
        step['responseXml'] = step['responseXml'].replace('FID=1|', 'FID=0|')
        with self.assertRaisesRegex(FieldError, 'TRIAL_XML_EVIDENCE_MISMATCH'):
            inspect_frame(self.plan, step)

    def test_unplanned_stake_or_game_is_rejected(self):
        step = self.step()
        step['requestPayload'] += '&ABPM=1'
        with self.assertRaisesRegex(FieldError, 'FIRST_ROUND_REQUEST_MODE'):
            inspect_frame(self.plan, step)
        plan = {**self.plan, 'gameId': 32651}
        with self.assertRaisesRegex(FieldError, 'HUFF_REVIEW_PROFILE_REQUIRED'):
            inspect_frame(plan, self.step())

    def test_changed_session_or_extra_bet_is_rejected(self):
        free = self.step('FREE_GAME')
        free['requestPayload'] = free['requestPayload'].replace('gdmgcmhuff-fixture', 'gdmgcmother-fixture')
        with self.assertRaisesRegex(FieldError, 'SESSION_CHANGED_MID_ROUND'):
            review_round(self.plan, self.raw(self.step(), free))
        with self.assertRaisesRegex(FieldError, 'MULTIPLE_PAID_ROUNDS'):
            review_round(self.plan, self.raw(self.step(), self.step()))

    def test_zero_counter_cannot_license_unrelated_free_replay(self):
        with self.assertRaisesRegex(FieldError, 'UNEXPECTED_FREE_CONTINUATION'):
            review_round(self.plan, self.raw(self.step(fid='0|', remaining='0'), self.step('FREE_GAME')))

    def test_report_does_not_leak_session_payload_or_arbitrary_gsd_data(self):
        result = review_round(self.plan, self.raw(self.step(gsd='PRIVATE~secret-payload-marker')))
        text = json.dumps(result)
        for private in ('gdmgcm', 'PID', 'requestPayload', 'responsePayload', 'secret-payload-marker'):
            self.assertNotIn(private, text)


if __name__ == '__main__':
    unittest.main()
