import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from trial_mongo import TrialMongo
from store import Rejected
from round_fields import derive, type_profile


class AuditReadOnlyTests(unittest.TestCase):
    def test_audit_bridge_rejects_writes_before_spawning_database_process(self):
        with tempfile.TemporaryDirectory() as directory:
            auth=Path(directory)/'fixture-auth.json'
            auth.write_text(json.dumps({'database':'sg_capture_staging_v1'}))
            mongo=TrialMongo(auth_file=auth,read_only=True)
            with patch('trial_mongo.subprocess.Popen') as spawn:
                for operation in ('ensure','put','unknown'):
                    with self.assertRaisesRegex(Rejected,'AUDIT_MONGO_READ_ONLY'):mongo.call(operation,[])
                spawn.assert_not_called()
            mongo.close()

    def test_cached_mapping_preserves_exact_fields_and_mapping_hash(self):
        samples=json.loads((Path(__file__).resolve().parents[2]/'fixtures/round-fields.json').read_text())['samples']
        type_profile.cache_clear()
        first=[derive(sample['raw']) for sample in samples]
        with patch('round_fields.Path.read_text',side_effect=AssertionError('mapping reread')):
            second=[derive(sample['raw']) for sample in samples]
        self.assertEqual(first,second)


if __name__=='__main__':unittest.main()
