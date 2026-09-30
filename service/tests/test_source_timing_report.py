import importlib.util
import unittest
from pathlib import Path

s = importlib.util.spec_from_file_location('source_timing_report', Path(__file__).resolve().parents[2] / 'scripts/source_timing_report.py')
m = importlib.util.module_from_spec(s)
s.loader.exec_module(m)


class TimingReportTests(unittest.TestCase):
    def test_connection_phases_stay_separate_and_unknown_or_invalid_is_not_zero(self):
        connection = dict(schema='sg-connection-observation-v1', requestsObserved=1, correlated=True,
            socketObserved=True, reusedSocket=False, beforeRequestMs=1, beforeHeadersWriteMs=25,
            afterHeadersWriteMs=1000, lookupWaitMs=2, tcpConnectMs=5, tlsHandshakeMs=4)
        step = dict(ts='2026-01-01T00:00:00Z', msgId='BET', sourceTiming=dict(
            schema='sg-source-timing-v1', headersMs=1100, bodyMs=2, totalMs=1103, connection=connection))
        rows = [{'shardId': 20, 'raw': {'steps': [step]}}]
        v = m.summarize(rows, 1767225600000, 1767226200000)
        self.assertEqual(v['connectionFrames'], 1)
        self.assertEqual(v['histogramsByShard'][20]['BET.connection.tcpConnectMs']['meanMs'], 5)
        self.assertEqual(v['histograms']['BET.totalMs']['p95UpperMs'], 2000)
        connection['reusedSocket'] = True  # Cannot charge the old handshake again.
        v = m.summarize(rows, 1767225600000, 1767226200000)
        self.assertEqual(v['invalidConnectionFrames'], 1)
        self.assertEqual(v['invalidFrames'], 0)
        self.assertNotIn('BET.connection.tcpConnectMs', v['histograms'])
        for key in ('lookupWaitMs', 'tcpConnectMs', 'tlsHandshakeMs'):
            connection[key] = None
        v = m.summarize(rows, 1767225600000, 1767226200000)
        self.assertEqual(v['reusedConnectionFrames'], 1)
        self.assertNotIn('BET.connection.tcpConnectMs', v['histograms'])

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
