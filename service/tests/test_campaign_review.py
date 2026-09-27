import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from campaign import Campaign
from campaign_review import hold_unstarted
from store import Rejected


class CampaignReviewTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.c=Campaign(self.tmp.name);self.addCleanup(self.c.close)
        self.evidence={'schema':'sg-feature-review-holds-v1','campaignId':self.c.config['campaignId'],
            'gameIds':[32671,32736],'reason':'UNSUPPORTED_NATURAL_FEATURE',
            'coverageReportSHA256':'c'*64,'officialSourceRequests':0,'databaseWrites':0}
    def rows(self):return [dict(r) for r in self.c.db.execute('SELECT * FROM games ORDER BY game_id')]
    def test_dry_review_leaves_queue_unchanged(self):
        before=self.rows();result=hold_unstarted(self.c,self.evidence)
        self.assertFalse(result['applied']);self.assertEqual(before,self.rows())
        self.assertFalse(self.c.db.execute("SELECT 1 FROM sqlite_master WHERE name='protocol_holds'").fetchone())
    def test_hold_preserves_all_counts_targets_and_baselines_and_is_idempotent(self):
        before=self.rows();control=dict(self.c.db.execute('SELECT * FROM control').fetchone())
        result=hold_unstarted(self.c,self.evidence,apply=True)
        self.assertTrue(result['applied'])
        after=self.rows();self.assertEqual(len(before),178)
        for old,new in zip(before,after):
            expected={**old,'status':'needs-adapter'} if old['game_id'] in [32671,32736] else old
            self.assertEqual(expected,new)
        self.assertEqual(control,dict(self.c.db.execute('SELECT * FROM control').fetchone()))
        repeated=hold_unstarted(self.c,self.evidence,apply=True)
        self.assertTrue(repeated['alreadyApplied']);self.assertEqual(after,self.rows())
        event=json.loads(self.c.db.execute('SELECT payload FROM protocol_holds').fetchone()[0])
        self.assertTrue(all(row['status']=='ready' for row in event['before']))
    def test_active_game_rejected_without_partial_queue_changes(self):
        self.c.db.execute('UPDATE control SET active_game=32736')
        before=self.rows()
        with self.assertRaisesRegex(Rejected,'HOLD_ACTIVE_GAME_FORBIDDEN'):hold_unstarted(self.c,self.evidence,True)
        self.assertEqual(before,self.rows())
    def test_started_game_and_enabled_controller_rejected(self):
        self.c.enable_by_operator()
        with self.assertRaisesRegex(Rejected,'HOLD_CAMPAIGN_NOT_PAUSED'):hold_unstarted(self.c,self.evidence,True)
        self.c.pause('REVIEW')
        directory=self.c.root/'trials'/self.c.plans['32736']['trialId'];directory.mkdir(parents=True)
        before=self.rows()
        with self.assertRaisesRegex(Rejected,'HOLD_STARTED_GAME_FORBIDDEN'):hold_unstarted(self.c,self.evidence,True)
        self.assertEqual(before,self.rows())
    def test_completed_game_and_modified_history_rejected(self):
        self.c.db.execute("UPDATE games SET status='complete' WHERE game_id=32671")
        with self.assertRaises(Rejected):hold_unstarted(self.c,self.evidence,True)
        self.c.db.execute("UPDATE games SET status='ready',confirmed=confirmed+1 WHERE game_id=32671")
        with self.assertRaisesRegex(Rejected,'HOLD_PROGRESS_CHANGED'):hold_unstarted(self.c,self.evidence,True)

if __name__=='__main__':unittest.main()
