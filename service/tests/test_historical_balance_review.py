import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('historical_balance_review', ROOT / 'scripts/review-historical-balances.py')
reviewer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reviewer)


class HistoricalBalanceReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.assets = Path(self.temp.name)
        self.directory = self.assets / 'sg/32530'
        self.directory.mkdir(parents=True)

    def frame(self, balance, win=0, session='gdmgcm-private-fixture'):
        payload = f'MSGID=BET&B={balance}&AB={balance}&TW={win}&IFG=0&NFG=0&FID=0|'
        return {'msgId': 'BET', 'requestPayload': f'MSGID=BET&PID={session}&GN=fixture',
                'responsePayload': payload,
                'responseXml': '<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>' + escape(payload) + '</PAYLOAD></GDMRESPONSE>',
                'url': 'https://secret.example/?cookie=private'}

    def run_review(self, frames, start=988.10, bet=0, traffic=None):
        row = {'buy': 0, 'bet': bet, 'data': {'startBalance': start, 'steps': frames}}
        (self.directory / 'rounds.jsonl').write_text(json.dumps(row) + '\n', encoding='utf-8')
        if traffic is not None:
            (self.directory / 'traffic.jsonl').write_text(''.join(json.dumps(s) + '\n' for s in traffic), encoding='utf-8')
        return reviewer.review(32530, self.assets)

    def test_balance_jump_is_preserved_and_joined_without_private_fields(self):
        frame = self.frame(99900)
        report = self.run_review([frame], traffic=[self.frame(98810), frame])
        issue = report['anomalies'][0]
        self.assertEqual(issue['balanceDerivedStakeRaw'], -1090)
        self.assertEqual(issue['trafficMatchStatus'], 'unique')
        self.assertTrue(issue['trafficMatches'][0]['sameSessionAsPreviousSuccessfulFrame'])
        self.assertTrue(issue['trafficMatches'][0]['previousBalanceMatchesRecordedStart'])
        self.assertFalse(issue['creditEligible'])
        text = json.dumps(report)
        for private in ['PID', 'gdmgcm', 'secret.example', 'cookie', 'requestPayload', 'responsePayload']:
            self.assertNotIn(private, text)
        self.assertEqual(report['creditedHistoricalRounds'], 0)

    def test_positive_money_match_is_not_full_protocol_or_mongo_proof(self):
        report = self.run_review([self.frame(99900)], start=1000, bet=1)
        self.assertEqual(report['counts']['moneyEquationMatchesStoredBet'], 1)
        self.assertFalse(report['fullProtocolCoverageProven'])
        self.assertFalse(report['mongoParityVerified'])

    def test_zero_stake_and_positive_stored_bet_mismatch_are_rejected(self):
        report = self.run_review([self.frame(98810)], bet=1)
        self.assertEqual(report['anomalies'][0]['balanceDerivedStakeRaw'], 0)
        report = self.run_review([self.frame(99900)], start=1000, bet=2)
        self.assertEqual(report['anomalies'][0]['code'], 'STORED_BET_MISMATCH')

    def test_duplicate_traffic_matches_are_ambiguous(self):
        frame = self.frame(99900)
        report = self.run_review([frame], traffic=[frame, frame])
        self.assertEqual(report['anomalies'][0]['trafficMatchStatus'], 'ambiguous')

    def test_changed_session_does_not_prove_continuity(self):
        frame = self.frame(99900)
        report = self.run_review([frame], traffic=[self.frame(98810, session='other-private'), frame])
        match = report['anomalies'][0]['trafficMatches'][0]
        self.assertFalse(match['sameSessionAsPreviousSuccessfulFrame'])
        self.assertFalse(match['previousBalanceMatchesRecordedStart'])

    def test_missing_traffic_remains_unproven(self):
        report = self.run_review([self.frame(99900)])
        self.assertFalse(report['trafficPresent'])
        self.assertEqual(report['anomalies'][0]['trafficMatchStatus'], 'missing')

    def test_fractional_minor_units_and_rejected_xml_are_not_accepted(self):
        report = self.run_review([self.frame(99900)], start=1000.001)
        self.assertEqual(report['counts']['unreviewableRecords'], 1)
        frame = self.frame(99900)
        frame['responseXml'] = frame['responseXml'].replace('true', 'false')
        report = self.run_review([frame], start=1000, bet=1)
        self.assertEqual(report['counts']['unreviewableRecords'], 1)


if __name__ == '__main__':
    unittest.main()
