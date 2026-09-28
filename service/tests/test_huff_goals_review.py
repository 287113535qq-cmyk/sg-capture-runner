import json
from pathlib import Path
import sys
import unittest
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'service'))
from huff_goals_review import SOURCE, inspect_frame, review_round
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError


class HuffGoalsReviewTests(unittest.TestCase):
    def setUp(self):
        self.plan = json.loads((ROOT / 'config/round-one-plans.json').read_text())['32717']

    def step(self, msg='BET', fid='2|', nfg='1', tfg='1', cfgg='0', gsd='NEXTTRIGGER~WHEEL1', **extra):
        request = '&'.join(f'{k}={v}' for k, v in {
            **self.plan['requestParams'], 'MSGID': msg, 'PID': 'gdmgcmgoals-fixture'}.items())
        response = '&'.join(f'{k}={v}' for k, v in {
            'MSGID': msg, 'IFG': '1' if msg == 'FREE_GAME' else '0', 'NFG': nfg,
            'TFG': tfg, 'CFGG': cfgg, 'B': '100020', 'AB': '100020', 'TW': '0',
            'FID': fid, 'GSD': gsd, **extra}.items())
        return {'msgId': msg, 'requestPayload': request, 'responsePayload': response,
                'elapsedMs': 1, 'responseXml': self.xml(response)}

    @staticmethod
    def xml(response):
        return '<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>' + escape(response) + '</PAYLOAD></GDMRESPONSE>'

    def raw(self, *steps):
        return {'sourceKey': SOURCE, 'protocol': 'nextgen', 'fixtureOnly': True, 'steps': list(steps)}

    def test_wheel_trigger_is_not_the_other_games_touch_up_feature(self):
        step = self.step()
        frame = inspect_frame(self.plan, step)
        self.assertEqual(frame['clientModeNames'], ['Wheel'])
        self.assertTrue(frame['wheelIntroObserved'])
        self.assertEqual(frame['clientContinuationHint'], 'FREE_GAME')
        self.assertFalse(frame['settlementVerified'])
        self.assertFalse(frame['captureAuthorized'])
        with self.assertRaisesRegex(FieldError, 'UNKNOWN_TRIAL_FEATURE'):
            NativeNextgenFields(self.plan).frame(step)
        with self.assertRaisesRegex(FieldError, 'GOALS_REVIEW_PROFILE_REQUIRED'):
            inspect_frame({**self.plan, 'gameId': 32714}, step)

    def test_modes_current_replay_and_next_trigger_are_separate(self):
        frame = inspect_frame(self.plan, self.step('FREE_GAME', '2|0|', gsd='FEAT~MANSION#NEXTTRIGGER~WHEEL2#WHSLICE~MEGAHAT'))
        self.assertEqual(frame['clientModeNames'], ['Wheel', 'FreeSpin'])
        self.assertEqual(frame['replayName'], 'MANSION')
        self.assertEqual(frame['nextTrigger'], 'WHEEL2')
        self.assertEqual(frame['wheelResult'], 'MEGAHAT')

    def test_retrigger_can_increase_total_without_reducing_remaining(self):
        result = review_round(self.plan, self.raw(
            self.step(fid='0|', nfg='6', tfg='6', gsd='NEXTTRIGGER~FG'),
            self.step('FREE_GAME', '0|', '5', '6', '1', 'FEAT~FG'),
            self.step('FREE_GAME', '0|', '5', '7', '2', 'FEAT~FG')))
        self.assertEqual(result['totalCounterIncreases'], 1)
        self.assertTrue(all(f['counterSumConsistent'] for f in result['frames']))
        self.assertEqual(result['clientContinuationHint'], 'FREE_GAME')
        self.assertFalse(result['settlementVerified'])

    def test_counter_zero_does_not_claim_a_verified_settlement(self):
        result = review_round(self.plan, self.raw(
            self.step(), self.step('FREE_GAME', '2|', '0', '1', '1', 'WHSLICE~MINI')))
        self.assertIsNone(result['clientContinuationHint'])
        self.assertFalse(result['settlementVerified'])
        self.assertFalse(result['captureAuthorized'])

    def test_missing_ordinary_counters_stay_missing_and_free_requires_them(self):
        ordinary = self.step(fid='', nfg='0', gsd='')
        for msg in ('BET', 'FREE_GAME'):
            step = ordinary if msg == 'BET' else self.step(msg)
            step['responsePayload'] = '&'.join(p for p in step['responsePayload'].split('&')
                                              if p.split('=', 1)[0] not in {'NFG', 'TFG', 'CFGG'})
            step['responseXml'] = self.xml(step['responsePayload'])
            if msg == 'BET':
                frame = inspect_frame(self.plan, step)
                self.assertEqual(frame['counters'], {'NFG': None, 'TFG': None, 'CFGG': None})
                self.assertIsNone(frame['counterSumConsistent'])
            else:
                with self.assertRaisesRegex(FieldError, 'GOALS_MISSING_FEATURE_COUNTER'):
                    inspect_frame(self.plan, step)

    def test_unknown_feature_routing_and_malformed_fid_fail_closed(self):
        for fid in ('3|', '-1|', '1||', '2|2|', '0|1|2|'):
            with self.subTest(fid=fid), self.assertRaises(FieldError):
                inspect_frame(self.plan, self.step(fid=fid))
        for gsd in ('FEAT~HARDHAT', 'NEXTTRIGGER~UNKNOWN', 'WHSLICE~UNKNOWN',
                    'FEAT~FG#FEAT~FG', 'NEXTTRIGGER'):
            with self.subTest(gsd=gsd), self.assertRaises(FieldError):
                inspect_frame(self.plan, self.step(gsd=gsd))
        for extra in ({'CFG': '1'}, {'FS_2': '0'}, {'NFR_2': '1'}, {'NFG': '101'}):
            with self.subTest(extra=extra), self.assertRaises(FieldError):
                inspect_frame(self.plan, self.step(**extra))

    def test_xml_request_template_and_session_must_match(self):
        step = self.step()
        step['responseXml'] = step['responseXml'].replace('FID=2|', 'FID=0|')
        with self.assertRaisesRegex(FieldError, 'TRIAL_XML_EVIDENCE_MISMATCH'):
            inspect_frame(self.plan, step)
        step = self.step();step['requestPayload'] += '&ABPM=1'
        with self.assertRaisesRegex(FieldError, 'FIRST_ROUND_REQUEST_MODE'):
            inspect_frame(self.plan, step)
        free = self.step('FREE_GAME');free['requestPayload'] = free['requestPayload'].replace('goals-fixture', 'other-fixture')
        with self.assertRaisesRegex(FieldError, 'SESSION_CHANGED_MID_ROUND'):
            review_round(self.plan, self.raw(self.step(), free))
        with self.assertRaisesRegex(FieldError, 'MULTIPLE_PAID_ROUNDS'):
            review_round(self.plan, self.raw(self.step(), self.step()))
        with self.assertRaisesRegex(FieldError, 'UNEXPECTED_FREE_CONTINUATION'):
            review_round(self.plan, self.raw(self.step(nfg='0'), self.step('FREE_GAME')))

    def test_report_has_no_credentials_payload_or_unreviewed_gsd_contents(self):
        text = json.dumps(review_round(self.plan, self.raw(self.step(gsd='NEXTTRIGGER~WHEEL1#PRIVATE~secret-marker#WH1~private-table'))))
        for value in ('gdmgcm', 'PID', 'requestPayload', 'responsePayload', 'secret-marker', 'private-table'):
            self.assertNotIn(value, text)


if __name__ == '__main__':
    unittest.main()
