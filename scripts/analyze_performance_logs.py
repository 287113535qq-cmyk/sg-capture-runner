"""Offline aggregate of final worker telemetry; no source or database access."""
import argparse
import json
import math
import zipfile
from pathlib import Path


def aggregate(rows):
    workers = {}
    for row in rows:
        if row.get('schema') != 'sg-capture-performance-v1' or row.get('reason') != 'final':
            continue
        key = (row['gameId'], row['shardId'])
        if key in workers and workers[key] != row:
            raise ValueError('CONFLICTING_FINAL_REPORT')
        workers[key] = row
    if not workers or len({key[0] for key in workers}) != 1:
        raise ValueError('SINGLE_GAME_FINAL_REPORTS_REQUIRED')
    totals = {}
    complete = requests = errors = elapsed = 0
    for row in workers.values():
        for name in ('completedThisRun', 'sourceRequests', 'sourceErrors', 'elapsedMs'):
            value = row[name]
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                raise ValueError('INVALID_PERFORMANCE_VALUE')
        complete += row['completedThisRun']
        requests += row['sourceRequests']
        errors += row['sourceErrors']
        elapsed += row['elapsedMs']
        for name, item in row['totals'].items():
            # Only fixed numeric telemetry names are exported, never raw fields.
            if not (name == 'normalize' or name.startswith(('source.', 'rpc.', 'connection.'))):
                continue
            if not all(c.isalnum() or c in '._' for c in name) or len(name) > 100:
                raise ValueError('INVALID_METRIC_NAME')
            count, total = item['count'], item['totalMs']
            if type(count) is not int or count < 0 or isinstance(total, bool) or not isinstance(total, (int, float)) or not math.isfinite(total) or total < 0:
                raise ValueError('INVALID_METRIC_VALUE')
            out = totals.setdefault(name, {'count': 0, 'totalMs': 0})
            out['count'] += count
            out['totalMs'] += total
    for item in totals.values():
        item['meanMs'] = item['totalMs'] / item['count'] if item['count'] else None
    return dict(schema='sg-worker-performance-aggregate-v1', gameId=next(iter(workers))[0],
                distinctWorkers=len(workers), complete=complete, sourceRequests=requests,
                sourceErrors=errors, workerElapsedMs=elapsed, totals=totals,
                limitation='Worker sums are not wall time; RPC and connection phases overlap. '
                           'Final reports alone do not prove stable windows or full database readback.')


def read_logs(path):
    rows = []
    with zipfile.ZipFile(path) as archive:
        if sum(info.file_size for info in archive.infolist()) > 256 * 1024 * 1024:
            raise ValueError('LOG_ARCHIVE_TOO_LARGE')
        for info in archive.infolist():
            if not info.filename.endswith('.txt'):
                continue
            for line in archive.read(info).decode('utf-8', 'replace').splitlines():
                if 'sg-capture-performance-v1' not in line:
                    continue
                start = line.find('{')
                if start < 0:
                    continue
                try:
                    value = json.loads(line[start:])
                except ValueError:
                    continue
                if isinstance(value, dict):
                    rows.append(value)
    return rows


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = aggregate(read_logs(args.input))
    with args.output.open('x', encoding='utf-8') as output:
        json.dump(result, output, indent=2, allow_nan=False)
    print(json.dumps({key: result[key] for key in ('gameId', 'distinctWorkers', 'complete', 'sourceRequests', 'sourceErrors')}))
