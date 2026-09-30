import hashlib, io, sys, tarfile, unittest, json, sqlite3, tempfile
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/runner-v2'))
from parked_legacy import decode_archive, convert_directory
from store import digest


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


class ParkedWorkerRangeTests(unittest.TestCase):
    def fixture(self, base, worker, registered=None):
        plan={'trialId':'fixture-range','target':299900,'phase':1,'buy':0}
        batch={'id':1,'worker':worker,'start':1,'end':100}
        with sqlite3.connect(base/'work-pool.sqlite3') as c:
            c.execute('create table control(plan_hash text,next_sequence integer)')
            c.execute('insert into control values (?,101)',(hashlib.sha256(json.dumps({'trialId':plan['trialId'],'target':299900,'workers':20,'version':1},sort_keys=True).encode()).hexdigest(),))
            c.execute('create table workers(id integer,lease_until integer,session_hash text,epoch integer,active_batch integer)')
            c.execute('insert into workers values (?,0,"fixture",1,1)',(worker if registered is None else registered,))
            c.execute('create table batches(id integer,worker integer,start integer,end integer)')
            c.execute('insert into batches values (1,?,1,100)',(worker,))
        c.close()
        folder=base/'batches/1';folder.mkdir(parents=True)
        with sqlite3.connect(folder/'state.sqlite3') as c:
            c.execute('create table trial(plan_hash text,lease_until integer,session_hash text,epoch integer,checkpoint integer,durable integer,failure text)')
            c.execute('insert into trial values (?,0,"fixture",1,0,0,NULL)',(digest({'plan':plan,'batch':batch}),))
            c.execute('create table receipts(sequence integer,payload text,committed integer)')
            c.execute('create table pending(sequence integer,raw text)')
        c.close()
        return plan

    def test_explicit_second_group_preserves_ids_and_default_remains_first(self):
        for worker,offset in [(0,0),(19,0),(20,20),(39,20)]:
            with self.subTest(worker=worker),tempfile.TemporaryDirectory() as d:
                base=Path(d);plan=self.fixture(base,worker)
                result=convert_directory(base,plan,[],'fixture',100,offset)
                self.assertEqual(result['states'][1]['value']['worker'],worker)
                self.assertIn(str(worker),result['states'][0]['value']['workers'])
                self.assertEqual(result['records'],[])
                if offset:
                    with self.assertRaises(AssertionError):convert_directory(base,plan,[],'fixture',100)

    def test_cross_group_workers_and_batches_rejected(self):
        for worker,registered,offset in [(20,0,20),(0,20,20),(40,40,20),(19,19,20),(20,20,0)]:
            with self.subTest(worker=worker,registered=registered,offset=offset),tempfile.TemporaryDirectory() as d:
                base=Path(d);plan=self.fixture(base,worker,registered)
                with self.assertRaises(AssertionError):convert_directory(base,plan,[],'fixture',100,offset)

    def test_offset_is_not_inferred_or_arbitrary(self):
        for offset in [-20,1,19,21,40,True,'20',20.0]:
            with self.subTest(offset=offset),patch('parked_legacy.convert_directory') as convert:
                with self.assertRaises(AssertionError):decode_archive(b'',{},[],'',100,offset)
                convert.assert_not_called()
