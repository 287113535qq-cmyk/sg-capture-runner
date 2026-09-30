import importlib.util
import unittest
from pathlib import Path

s = importlib.util.spec_from_file_location('source_timing_report', Path(__file__).resolve().parents[2] / 'scripts/source_timing_report.py')
m = importlib.util.module_from_spec(s)
s.loader.exec_module(m)


class TimingReportTests(unittest.TestCase):
    def test_boundaries_old_frames_and_no_sensitive_output(self):
        rows = [{'shardId': 0, 'raw': {'steps': [dict(ts='2026-01-01T00:00:00Z', msgId='PRIVATE',
            requestPayload='SECRET', sourceTiming=dict(schema='sg-source-timing-v1', headersMs=1100, bodyMs=2, totalMs=1103))]}}]
        at = 1767225600000
        v = m.summarize(rows, at, at + 600000)
        self.assertEqual(v['framesByShard'], {0: 1})
        self.assertEqual(v['longSourceTimeFraction'], 1)
        self.assertNotIn('SECRET', str(v))
        self.assertNotIn('PRIVATE', str(v))
        self.assertFalse(v['wholeWorkerTimeCovered'])
        self.assertEqual(m.summarize(rows, at - 1, at)['responseFrames'], 0)
        del rows[0]['raw']['steps'][0]['sourceTiming']
        self.assertEqual(m.summarize(rows, at, at + 1)['missingTimingFrames'], 1)

    def test_inconsistent_negative_nan_and_boolean_timings_rejected(self):
        for value in (-1, float('nan'), True, 2000):
            rows = [{'shardId': 0, 'raw': {'steps': [dict(ts='2026-01-01T00:00:00Z',
                sourceTiming=dict(schema='sg-source-timing-v1', headersMs=value, bodyMs=2, totalMs=10))]}}]
            self.assertEqual(m.summarize(rows, 1767225600000, 176722560000000)['invalidFrames'], 1)
