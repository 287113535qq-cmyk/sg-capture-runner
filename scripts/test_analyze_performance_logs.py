import unittest
from analyze_performance_logs import aggregate


def report(worker=0):
    return dict(schema='sg-capture-performance-v1', reason='final', gameId=32799,
                shardId=worker, completedThisRun=5, sourceRequests=10,
                sourceErrors=0, elapsedMs=1000,
                totals={'source.Logic.total': {'count': 5, 'totalMs': 500},
                        'privateRaw': {'session': 'must-not-export'}})


class PerformanceTests(unittest.TestCase):
    def test_storage_waits_remain_nested_numeric_observations_without_exporting_raw_fields(self):
        row = report()
        row['rpcMetrics'] = {'storageStages': {'byStage': {
            'wait.capacity': {'calls': 2, 'totalMs': 2000},
            'writer.deliver': {'calls': 3, 'totalMs': 300},
            'privateRaw': {'session': 'must-not-export'}}}}
        result = aggregate([row])
        self.assertEqual(result['nestedDiagnostics']['storageStages']['totals']['wait.capacity']['meanMs'], 1000)
        self.assertNotIn('must-not-export', str(result))

    def test_nested_costs_are_separate_and_do_not_export_unknown_fields(self):
        row = report()
        row['rpcMetrics'] = {'localStages': {'byStage': {
            'analyzer.record': {'calls': 5, 'totalMs': 20},
            'private-session': {'value': 'must-not-export'}}},
            'gateway': {'byOperation': {'read': {'requests': 10, 'elapsedMs': 40}},
                        'byDocumentKind': {'statePool': {'requests': 4, 'elapsedMs': 30}}}}
        result = aggregate([row, row, report(1)])
        self.assertEqual(result['workerElapsedMs'], 2000)
        nested = result['nestedDiagnostics']
        self.assertTrue(nested['nestedWithinRpc'])
        self.assertTrue(nested['sectionsOverlap'])
        self.assertEqual(nested['localStages']['reportCoverage'], 1)
        self.assertEqual(nested['localStages']['totals']['analyzer.record']['count'], 5)
        self.assertNotIn('private-session', nested['localStages']['totals'])
        self.assertEqual(nested['gatewayDocuments']['totals']['statePool']['totalMs'], 30)

    def test_missing_nested_evidence_is_not_filled_with_zero_reports(self):
        result = aggregate([report()])
        self.assertEqual(result['nestedDiagnostics']['localStages']['reportCoverage'], 0)
        self.assertEqual(result['nestedDiagnostics']['localStages']['totals'], {})

    def test_invalid_nested_numeric_cost_rejected(self):
        for value in (float('nan'), -1, True, '40'):
            row = report()
            row['rpcMetrics'] = {'gateway': {'byOperation': {'read': {'requests': 1, 'elapsedMs': value}}}}
            with self.assertRaisesRegex(ValueError, 'INVALID_NESTED_METRIC'):
                aggregate([row])

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
