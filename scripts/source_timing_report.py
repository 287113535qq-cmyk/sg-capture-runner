"""Offline bounded summaries from already persisted records; no network or writes to capture."""
import argparse
import collections
import datetime
import hashlib
import json
import math
from pathlib import Path

MESSAGES = {'INIT', 'REELSTRIP', 'BET', 'FREE_GAME', 'FEATURE_START', 'FEATURE_PICK',
            'FEATURE_END', 'Init', 'Logic', 'EndGame'}
BOUNDS = (1, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 30000, 60000)
CONNECTION_PHASES = ('beforeRequestMs', 'beforeHeadersWriteMs', 'afterHeadersWriteMs',
                     'lookupWaitMs', 'tcpConnectMs', 'tlsHandshakeMs')


def number(value):
    return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value) and value >= 0


def summarize(records, start_ms, end_ms):
    if not number(start_ms) or not number(end_ms) or end_ms <= start_ms:
        raise ValueError('TIMING_WINDOW')
    hist, shards, by_shard = {}, collections.Counter(), {}
    connection_frames = missing_connection = invalid_connection = reused_frames = 0
    frames = missing = invalid = long_frames = 0
    total = long_total = 0.0
    for record in records:
        for step in record.get('raw', {}).get('steps', []):
            try:
                at = datetime.datetime.fromisoformat(step['ts'].replace('Z', '+00:00'))
                if at.tzinfo is None:
                    raise ValueError()
                at = at.timestamp() * 1000
            except (ValueError, KeyError, TypeError, AttributeError):
                invalid += 1
                continue
            if not start_ms <= at < end_ms:
                continue
            frames += 1
            t = step.get('sourceTiming')
            if t is None:
                missing += 1
                continue
            if (not isinstance(t, dict) or t.get('schema') != 'sg-source-timing-v1'
                    or not all(number(t.get(k)) for k in ('headersMs', 'bodyMs', 'totalMs'))
                    or t['headersMs'] + t['bodyMs'] > t['totalMs'] + .01):
                invalid += 1
                continue
            shard = record.get('shardId')
            if not isinstance(shard, int) or isinstance(shard, bool) or not 0 <= shard < 160:
                invalid += 1
                continue
            shards[shard] += 1
            name = step.get('msgId') if step.get('msgId') in MESSAGES else 'other'
            total += t['totalMs']
            if t['totalMs'] >= 1000:
                long_frames += 1
                long_total += t['totalMs']
            measurements = {k: t[k] for k in ('headersMs', 'bodyMs', 'totalMs')}
            c = t.get('connection')
            if c is None:
                missing_connection += 1
            elif (not isinstance(c, dict) or c.get('schema') != 'sg-connection-observation-v1'
                  or c.get('correlated') is not True or type(c.get('requestsObserved')) is not int or c['requestsObserved'] != 1
                  or not isinstance(c.get('socketObserved'), bool)
                  or c.get('reusedSocket') is not None and not isinstance(c['reusedSocket'], bool)
                  or any(k not in c or c[k] is not None and not number(c[k]) for k in CONNECTION_PHASES)
                  or c.get('reusedSocket') is True and any(c.get(k) is not None for k in ('lookupWaitMs', 'tcpConnectMs', 'tlsHandshakeMs'))):
                invalid_connection += 1
            else:
                connection_frames += 1
                reused_frames += c.get('reusedSocket') is True
                measurements.update({'connection.' + k: c[k] for k in CONNECTION_PHASES if c[k] is not None})
            for k, value in measurements.items():
                for output in (hist, by_shard.setdefault(shard, {})):
                    h = output.setdefault(name + '.' + k, {'count': 0, 'totalMs': 0, 'maxMs': 0,
                        'buckets': [0] * (len(BOUNDS) + 1)})
                    h['count'] += 1
                    h['totalMs'] += value
                    h['maxMs'] = max(h['maxMs'], value)
                    h['buckets'][next((i for i, b in enumerate(BOUNDS) if value <= b), len(BOUNDS))] += 1
    for output in (hist, *by_shard.values()):
        for h in output.values():
            h['meanMs'] = h['totalMs'] / h['count']
            for label, fraction in (('p50UpperMs', .5), ('p95UpperMs', .95), ('p99UpperMs', .99)):
                cutoff = math.ceil(h['count'] * fraction)
                cumulative = 0
                for i, count in enumerate(h['buckets']):
                    cumulative += count
                    if cumulative >= cutoff:
                        h[label] = BOUNDS[i] if i < len(BOUNDS) else None
                        break
    return dict(schema='sg-persisted-source-window-v1', startMs=start_ms, endMs=end_ms,
        responseFrames=frames, missingTimingFrames=missing, invalidFrames=invalid,
        framesByShard=dict(sorted(shards.items())), histograms=hist, bucketUpperBoundsMs=[*BOUNDS, None],
        histogramsByShard=by_shard, connectionFrames=connection_frames,
        missingConnectionFrames=missing_connection, invalidConnectionFrames=invalid_connection,
        reusedConnectionFrames=reused_frames, connectionPhasesNestedWithinHeaders=True,
        longFrames=long_frames, longSourceTimeFraction=long_total / total if total else None,
        wholeWorkerTimeCovered=False, captureAuthorization=False,
        limitations='Completed exported records only; excludes in-flight/abandoned frames and local/RPC time. '
                     'Headers include connection/network/server wait; connection phases overlap and must not be summed. '
                     'lookupWait includes client setup through lookup completion; afterHeadersWrite includes upload/network/server wait. '
                     'Quantiles are histogram upper bounds, not exact percentiles.')


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('input', type=Path)
    p.add_argument('--start-ms', type=int, required=True)
    p.add_argument('--end-ms', type=int, required=True)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    data = a.input.read_bytes()
    result = summarize(json.loads(data), a.start_ms, a.end_ms)
    result['inputSha256'] = hashlib.sha256(data).hexdigest()
    a.output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'responseFrames': result['responseFrames'], 'missingTimingFrames': result['missingTimingFrames'],
                      'invalidFrames': result['invalidFrames'], 'sourceRequests': 0}))
