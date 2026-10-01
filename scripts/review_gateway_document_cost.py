"""Offline diagnosis of fixed, completed capture telemetry; no network or writes."""
import math

KINDS = frozenset(('statePool', 'stateBatch', 'stateOther', 'journal', 'other'))
FIELDS = ('requests', 'elapsedMs', 'responseBytes', 'requestBytes')


def review(observation, *, run, head, workers=80):
    assert observation['run'] == run and observation['head'] == head
    assert observation['conclusion'] == 'success', 'ENDED_SUCCESS_REQUIRED'
    rows = observation['rows']
    assert len(rows) == workers and len({r['shardId'] for r in rows}) == workers
    totals = {k: {f: 0 for f in FIELDS} for k in KINDS}
    gateway_total = {f: 0 for f in FIELDS}
    for row in rows:
        assert row['schema'] == 'sg-capture-performance-v1'
        assert row['reason'] == 'final' and row['gameId'] == 32799
        assert row['sourceErrors'] == 0, 'SOURCE_ERRORS'
        gateway = row['rpcMetrics']['gateway']
        assert gateway['documentKindsNestedWithinOperations'] is True
        assert set(gateway['byDocumentKind']) <= KINDS, 'UNKNOWN_DOCUMENT_KIND'
        labelled = {f: 0 for f in FIELDS}
        operations = {f: 0 for f in FIELDS}
        for name, metric in gateway['byOperation'].items():
            for field in FIELDS:
                value = metric.get(field, 0)
                assert isinstance(value, (int, float)) and not isinstance(value, bool)
                assert math.isfinite(value) and value >= 0
                gateway_total[field] += value
                if name in ('read', 'create', 'cas', 'cas_delta'):
                    operations[field] += value
        for kind, metric in gateway['byDocumentKind'].items():
            for field in FIELDS:
                value = metric[field]
                assert isinstance(value, (int, float)) and not isinstance(value, bool)
                assert math.isfinite(value) and value >= 0
                totals[kind][field] += value
                labelled[field] += value
        for field in FIELDS:
            assert math.isclose(labelled[field], operations[field], rel_tol=1e-9, abs_tol=1e-6), 'NESTED_TOTAL_MISMATCH'
    for metric in totals.values():
        metric['meanMs'] = metric['elapsedMs'] / metric['requests'] if metric['requests'] else None
        metric['responseByteSharePercent'] = metric['responseBytes'] / gateway_total['responseBytes'] * 100 if gateway_total['responseBytes'] else None
    return {'schema': 'sg-ended-document-cost-review-v1', 'run': run, 'head': head,
            'workers': workers, 'gatewayOperations': gateway_total,
            'documentKinds': dict(sorted(totals.items())),
            'sourceRequestsForAnalysis': 0, 'databaseWrites': 0,
            'limitation': 'Document kinds are nested in operations. Never add the two totals. Accumulated independent worker durations are not wall time, CPU time or matched-window throughput. Fixed labels contain no document identity, raw data or sessions.'}
