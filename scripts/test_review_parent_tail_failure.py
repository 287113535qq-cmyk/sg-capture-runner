import hashlib,io,json,unittest,zipfile
from unittest.mock import patch
import review_parent_tail_failure as subject
def archive(mutation=None):
    rows=[{'error':'ERR_ASSERTION'}]
    for worker in list(range(20))+list(range(40,60)):
        count=273 if worker==0 else 259
        rows.extend([dict(gameId=32799,shardId=worker,outcome='success',completedThisRun=count),dict(schema='sg-capture-performance-v1',reason='final',gameId=32799,shardId=worker,completedThisRun=count,sourceErrors=0)])
    if mutation:mutation(rows)
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w') as z:z.writestr('capture.txt','\n'.join(json.dumps(r) for r in rows))
    return out.getvalue()
class ReviewTest(unittest.TestCase):
    def test_complete_exact_worker_and_telemetry_evidence(self):
        data=archive()
        with patch.object(subject,'EXPECTED',hashlib.sha256(data).hexdigest()):self.assertEqual(subject.review(data)['childComplete'],10374)
    def test_foreign_log_refused(self):
        with self.assertRaisesRegex(AssertionError,'TAIL_LOG_IDENTITY'):subject.review(archive())
    def test_missing_worker_source_error_or_conflicting_report_refused(self):
        for mutation in [lambda rows:rows.pop(),lambda rows:rows[-1].update(sourceErrors=1),lambda rows:rows.append(dict(rows[-1],completedThisRun=1))]:
            data=archive(mutation)
            with patch.object(subject,'EXPECTED',hashlib.sha256(data).hexdigest()),self.assertRaises(AssertionError):subject.review(data)
if __name__=='__main__':unittest.main()
