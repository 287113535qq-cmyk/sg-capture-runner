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


def number(value):
    return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value) and value >= 0


def summarize(records, start_ms, end_ms):
    if not number(start_ms) or not number(end_ms) or end_ms <= start_ms:
        raise ValueError('TIMING_WINDOW')
    hist, shards = {}, collections.Counter()
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
            for k in ('headersMs', 'bodyMs', 'totalMs'):
                h = hist.setdefault(name + '.' + k, {'count': 0, 'totalMs': 0, 'maxMs': 0,
                    'buckets': [0] * (len(BOUNDS) + 1)})
                h['count'] += 1
                h['totalMs'] += t[k]
                h['maxMs'] = max(h['maxMs'], t[k])
                h['buckets'][next((i for i, b in enumerate(BOUNDS) if t[k] <= b), len(BOUNDS))] += 1
    return dict(schema='sg-persisted-source-window-v1', startMs=start_ms, endMs=end_ms,
        responseFrames=frames, missingTimingFrames=missing, invalidFrames=invalid,
        framesByShard=dict(sorted(shards.items())), histograms=hist, bucketUpperBoundsMs=[*BOUNDS, None],
        longFrames=long_frames, longSourceTimeFraction=long_total / total if total else None,
        wholeWorkerTimeCovered=False, captureAuthorization=False,
        limitations='Completed exported records only; excludes in-flight/abandoned frames and local/RPC time. '
                     'Headers include connection/network/server wait, not an attribution to any one cause.')


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
