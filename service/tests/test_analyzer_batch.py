"""Synthetic identities and protocol fixtures; no source or database access."""
import copy
import importlib.util
import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('record_fields_batch', ROOT/'scripts/runner-v2/record_fields.py')
fields = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fields)


class AnalyzerBatchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan = json.loads((ROOT/'config/round-one-plans.json').read_text())['32799']
        result = subprocess.run(['node', '--input-type=module', '-e',
            "import {rhinoFixture as f,rhinoGuaranteeFixture as g} from './scripts/trial/rhino-fixture.mjs';console.log(JSON.stringify([f(0),f(8,{4:5}),g()]));"],
            cwd=ROOT, capture_output=True, text=True, check=True)
        raws = json.loads(result.stdout)
        from rhino_fields import RhinoFields
        adapter = RhinoFields(cls.plan)
        cls.records = [fields.execute(dict(op='record', plan=cls.plan, raw=raws[i % 3],
            normalized=adapter.settled(raws[i % 3]), sequence=i+1, attempt='synthetic',
            sessionHash='a'*64, worker=0, batchId=1)) for i in range(100)]

    def verify(self, records):
        return fields.execute(dict(op='verify_batch', plan=self.plan, records=records))

    def test_every_record_uses_the_existing_full_validator(self):
        for record in self.records:
            self.assertEqual(fields.execute(dict(op='verify', plan=self.plan,
                raw=record['raw'], record=record)), {'verified': True})
        from store import digest
        self.assertEqual(self.verify(self.records), dict(verified=True, count=100,
            idsHash=digest([[r['_id'], r['contentHash']] for r in self.records])))

    def test_invalid_last_record_never_returns_a_partial_page(self):
        for kind in ('xml', 'money', 'rawHash', 'normalizedHash', 'contentHash', '_id', 'gameId', 'fixtureOnly'):
            with self.subTest(kind=kind):
                rows = copy.deepcopy(self.records)
                bad = rows[-1]
                if kind == 'xml':
                    bad['raw']['steps'].pop()
                elif kind == 'money':
                    bad['normalized']['money']['endBalanceRaw'] += 1
                elif kind == 'fixtureOnly':
                    bad[kind] = True
                elif kind == 'gameId':
                    bad[kind] += 1
                else:
                    bad[kind] = '0'*64
                with self.assertRaises(Exception):
                    self.verify(rows)

    def test_page_bounds_duplicates_and_order_are_rejected(self):
        for rows in ([], self.records+[self.records[0]], self.records[:2][::-1],
                     [self.records[0], self.records[0]]):
            with self.assertRaises(Exception):
                self.verify(rows)


if __name__ == '__main__':
    unittest.main()
