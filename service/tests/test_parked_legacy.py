import hashlib, io, sys, tarfile, unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/runner-v2'))
from parked_legacy import decode_archive


class ParkedArchiveTests(unittest.TestCase):
    def archive(self, names, link=False):
        out = io.BytesIO()
        with tarfile.open(fileobj=out, mode='w:gz') as archive:
            for name in names:
                member = tarfile.TarInfo(name)
                member.size = 2
                if link:
                    member.type = tarfile.SYMTYPE
                    member.linkname = '/etc/passwd'
                archive.addfile(member, io.BytesIO(b'{}'))
        return out.getvalue()

    def decode(self, data, **changes):
        args = dict(data=data, plan={'phase':1,'buy':0}, mongo_records=[],
            expected_hash=hashlib.sha256(data).hexdigest(), checked_at=100)
        args.update(changes)
        return decode_archive(**args)

    def test_bounded_regular_files_reach_decoder(self):
        def convert(base, *_):
            self.assertEqual((base/'batches/1/state.sqlite3').read_bytes(), b'{}')
            self.assertEqual((base/'work-pool.sqlite3-wal').read_bytes(), b'{}')
            return {'fixture': True}
        with patch('parked_legacy.convert_directory', side_effect=convert):
            self.assertEqual(self.decode(self.archive(['batches/1/state.sqlite3','work-pool.sqlite3-wal'])), {'fixture':True})

    def test_paths_links_duplicates_and_unapproved_files_never_reach_sql(self):
        for names, link in [(['../state.sqlite3'],False),(['/work-pool.sqlite3'],False),
                (['batches/1/../../../secret'],False),(['work-pool.sqlite3']*2,False),
                (['work-pool.sqlite3'],True),(['executable.py'],False),(['batches/0/state.sqlite3'],False)]:
            with self.subTest(names=names,link=link), patch('parked_legacy.convert_directory') as convert:
                with self.assertRaises(AssertionError): self.decode(self.archive(names,link))
                convert.assert_not_called()

    def test_hash_phase_budget_and_file_count_refuse_before_sql(self):
        data = self.archive(['work-pool.sqlite3'])
        for args in [{'expected_hash':'0'*64}, {'plan':{'phase':2,'buy':0}},
                     {'plan':{'phase':1,'buy':1}}, {'mongo_records':[{}]*1001}]:
            with self.subTest(args=list(args)), patch('parked_legacy.convert_directory') as convert:
                with self.assertRaises(AssertionError): self.decode(data,**args)
                convert.assert_not_called()
        with self.assertRaises(AssertionError):
            self.decode(self.archive([f'batches/{i}/state.sqlite3' for i in range(1,503)]))
