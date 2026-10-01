import unittest
from analyze_performance_logs import aggregate


def report(worker=0):
    return dict(schema='sg-capture-performance-v1', reason='final', gameId=32799,
                shardId=worker, completedThisRun=5, sourceRequests=10,
                sourceErrors=0, elapsedMs=1000,
                totals={'source.Logic.total': {'count': 5, 'totalMs': 500},
                        'privateRaw': {'session': 'must-not-export'}})


class PerformanceTests(unittest.TestCase):
    def test_duplicate_archive_entries_are_counted_once(self):
        result = aggregate([report(), report(), report(1)])
        self.assertEqual(result['complete'], 10)
        self.assertEqual(result['distinctWorkers'], 2)
        self.assertNotIn('privateRaw', result['totals'])

    def test_conflicting_worker_report_is_not_silently_overwritten(self):
        changed = report(); changed['completedThisRun'] = 6
        with self.assertRaisesRegex(ValueError, 'CONFLICTING'):
            aggregate([report(), changed])

    def test_mixed_games_and_nonfinite_metrics_are_rejected(self):
        changed = report(1); changed['gameId'] = 32795
        with self.assertRaises(ValueError):
            aggregate([report(), changed])
        changed = report(); changed['totals']['source.Logic.total']['totalMs'] = float('nan')
        with self.assertRaises(ValueError):
            aggregate([changed])
