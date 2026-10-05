import importlib.util
import io
import json
from pathlib import Path
import unittest
import zipfile

path=Path(__file__).resolve().parents[2]/'scripts/runner-v2/business_linux_logs.py'
spec=importlib.util.spec_from_file_location('business_linux_logs',path)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class BusinessLinuxLogTests(unittest.TestCase):
    def setUp(self):
        self.value={'schema':'sg-offline-preflight-v1','complete':True,'passed':True,'sourceRequests':0,'mongoWrites':0,'runs':[{'workers':3}]}
        self.line='2026-10-05T16:00:00Z '+json.dumps(self.value)+'\n'
        self.step='preflight/6_Fixed offline checks with joined results and bounded concurrency.txt'

    def archive(self,entries):
        buf=io.BytesIO()
        with zipfile.ZipFile(buf,'w') as z:
            for name,body in entries:z.writestr(name,body)
        return buf.getvalue()

    def test_step_layout(self):
        self.assertEqual(module.parse_archive(self.archive([(self.step,self.line)])),self.value)

    def test_later_aggregate_only_layout(self):
        self.assertEqual(module.parse_archive(self.archive([('1_preflight.txt',self.line),('preflight/system.txt','system')])),self.value)

    def test_zero_numbered_aggregate_only_layout(self):
        self.assertEqual(module.parse_archive(self.archive([('0_preflight.txt',self.line),('preflight/system.txt','system')])),self.value)

    def test_zero_numbered_aggregate_and_step_must_agree(self):
        self.assertEqual(module.parse_archive(self.archive([('0_preflight.txt',self.line),(self.step,self.line)])),self.value)

    def test_zero_numbered_conflicting_result_rejected(self):
        bad={**self.value,'passed':False}
        with self.assertRaises(AssertionError):module.parse_archive(self.archive([('0_preflight.txt',self.line),(self.step,json.dumps(bad))]))

    def test_noncanonical_or_other_zero_numbered_job_rejected(self):
        for name in ['00_preflight.txt','0_other.txt']:
            with self.subTest(name=name),self.assertRaises(AssertionError):module.parse_archive(self.archive([(name,self.line)]))

    def test_aggregate_and_step_must_agree(self):
        self.assertEqual(module.parse_archive(self.archive([('1_preflight.txt',self.line),(self.step,self.line)])),self.value)

    def test_conflicting_aggregate_and_step_rejected(self):
        bad={**self.value,'complete':False}
        with self.assertRaises(AssertionError):module.parse_archive(self.archive([('1_preflight.txt',self.line),(self.step,json.dumps(bad))]))

    def test_multiple_results_in_one_job_rejected(self):
        with self.assertRaises(AssertionError):module.parse_archive(self.archive([('1_preflight.txt',self.line*2)]))

    def test_missing_joined_result_rejected(self):
        with self.assertRaises(AssertionError):module.parse_archive(self.archive([('1_preflight.txt','all tests passed')]))

    def test_result_in_unrelated_file_does_not_grant_evidence(self):
        with self.assertRaises(AssertionError):module.parse_archive(self.archive([('preflight/system.txt',self.line)]))

    def test_malformed_json_and_utf8_rejected(self):
        with self.assertRaises(ValueError):module.parse_archive(self.archive([('1_preflight.txt','{"schema": "sg-offline-preflight-v1",')]))
        with self.assertRaises(UnicodeDecodeError):module.parse_archive(self.archive([('1_preflight.txt',b'\xff')]))

if __name__=='__main__':unittest.main()
