import base64
import hashlib
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mongo_only_gateway import Gateway, Refused


class FrozenBytesTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        (self.root / 'fixture').mkdir()
        self.data = b'x' * (256 * 1024 + 17)
        (self.root / 'fixture/full.tar.gz').write_bytes(self.data)
        self.manifest = {'schema':'sg-mongo-only-access-v2', 'trials':{'trial':{'group':'primary'}},
            'frozenTrialArchives':{'trial':{'path':'fixture/full.tar.gz', 'bytes':len(self.data),
                'sha256':hashlib.sha256(self.data).hexdigest()}}}
        self.gateway = Gateway({}, 'primary', self.manifest)
        self.patch = patch('mongo_only_gateway.BACKUP_ROOT', self.root)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def read(self, **args):
        return self.gateway.dispatch({'schema':'sg-mongo-only-v2', 'op':'frozen_trial_bytes', 'trialId':'trial', **args})

    def test_fixed_backup_is_bounded_and_content_bound(self):
        first, last = self.read(), self.read(offset=256*1024)
        self.assertEqual(len(base64.b64decode(first['data'])), 256*1024)
        self.assertEqual(base64.b64decode(first['data']) + base64.b64decode(last['data']), self.data)
        self.assertEqual(first['sha256'], hashlib.sha256(self.data).hexdigest())
        self.assertNotIn('captureLogic', first)

    def test_no_unapproved_trial_group_path_or_offset(self):
        for args in ({'trialId':'other'}, {'group':'secondary'}, {'path':'../secret'}, {'sha256':'0'*64},
                     {'offset':-1}, {'offset':True}, {'offset':len(self.data)}):
            with self.subTest(args=args), self.assertRaises(Refused):
                self.read(**args)
        self.gateway.group = 'secondary'
        with self.assertRaises(Refused): self.read()

    def test_missing_manifest_changed_bytes_and_path_escape_refuse(self):
        entry = self.manifest['frozenTrialArchives']['trial']
        for key, value in [('path','../fixture/full.tar.gz'), ('bytes',40*1024*1024+1), ('sha256','0'*64)]:
            before = entry[key]
            entry[key] = value
            with self.subTest(key=key), self.assertRaises(Refused): self.read()
            entry[key] = before
        (self.root / 'fixture/full.tar.gz').write_bytes(b'y' * len(self.data))
        with self.assertRaises(Refused): self.read()
        self.manifest['frozenTrialArchives'].clear()
        with self.assertRaises(Refused): self.read()
