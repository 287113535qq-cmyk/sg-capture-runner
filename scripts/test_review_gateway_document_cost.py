import copy
import unittest
from review_gateway_document_cost import review


class DocumentCostTests(unittest.TestCase):
    def sample(self):
        metric = dict(requests=2, elapsedMs=30, responseBytes=400, requestBytes=50)
        return dict(run=1, head='a'*40, conclusion='success', rows=[dict(
            schema='sg-capture-performance-v1', reason='final', gameId=32799,
            shardId=0, sourceErrors=0, rpcMetrics={'gateway': {
                'documentKindsNestedWithinOperations': True,
                'byOperation': {'read': metric, 'metrics': dict(requests=1, elapsedMs=5, responseBytes=100, requestBytes=10)},
                'byDocumentKind': {'statePool': copy.deepcopy(metric)}}})])

    def check(self, x):
        return review(x, run=1, head='a'*40, workers=1)

    def test_nested_not_double_counted(self):
        result = self.check(self.sample())
        self.assertEqual(result['gatewayOperations']['responseBytes'], 500)
        self.assertEqual(result['documentKinds']['statePool']['responseByteSharePercent'], 80)
        self.assertEqual(result['documentKinds']['statePool']['meanMs'], 15)

    def test_missing_duplicate_foreign_or_failed_observation(self):
        base = self.sample()
        for field, value in [('run', 2), ('head', 'b'*40), ('conclusion', 'failure'), ('rows', [])]:
            x = copy.deepcopy(base); x[field] = value
            with self.assertRaises(AssertionError): self.check(x)
        x = copy.deepcopy(base); x['rows'] *= 2
        with self.assertRaises(AssertionError): review(x, run=1, head='a'*40, workers=2)

    def test_incomplete_or_private_labels_and_nonfinite_rejected(self):
        for change in ('missing', 'unknown', 'nan', 'negative', 'errors', 'notFinal'):
            x = self.sample(); row = x['rows'][0]; gateway = row['rpcMetrics']['gateway']
            if change == 'missing': gateway['byDocumentKind'] = {}
            if change == 'unknown': gateway['byDocumentKind']['pool:private-session'] = gateway['byDocumentKind'].pop('statePool')
            if change == 'nan': gateway['byDocumentKind']['statePool']['elapsedMs'] = float('nan')
            if change == 'negative': gateway['byOperation']['read']['requestBytes'] = -1
            if change == 'errors': row['sourceErrors'] = 1
            if change == 'notFinal': row['reason'] = 'interval'
            with self.assertRaises(AssertionError): self.check(x)


if __name__ == '__main__': unittest.main()
