import hashlib
import unittest
from client_method_reuse import match_bodies, eligible_task


class MethodReuseTests(unittest.TestCase):
    def test_exact_body_candidates_still_require_actual_engine_review(self):
        body = b'function(){return this.createHeader()+"</GameRequest>";}'
        data = b'/* unused library */ ' + body * 6
        ref = {'Close.send': dict(body=body, sha256=hashlib.sha256(body).hexdigest())}
        result = match_bodies(data, expected_sha256=hashlib.sha256(data).hexdigest(), references=ref)
        self.assertEqual(len(result['matches']['Close.send']['offsets']), 4)
        self.assertFalse(result['semanticEquivalenceProved'])
        self.assertFalse(result['ready']); self.assertFalse(result['captureAuthorization'])
        self.assertIn('actual selected engine', result['requiredReview'][0])
        changed = data.replace(b'createHeader', b'createStake')
        self.assertEqual(match_bodies(changed, expected_sha256=hashlib.sha256(changed).hexdigest(), references=ref)['matches'], {})

    def test_changed_inputs_and_unreviewed_reference_labels_refused(self):
        body = b'function(){return this.createHeader()+"</GameRequest>";}'
        digest = hashlib.sha256(body).hexdigest()
        for sha, label, reference in [('0'*64, 'Close.send', digest), (digest, 'Close.send', '0'*64), (digest, 'private-session', digest)]:
            with self.assertRaises(AssertionError):
                match_bodies(body, expected_sha256=sha, references={label: dict(body=body, sha256=reference)})

    def test_completed_active_and_non_candidate_work_skipped(self):
        for status in ('complete', 'active'):
            self.assertFalse(eligible_task(dict(status=status, candidateOnly=True)))
        self.assertFalse(eligible_task(dict(status='needs-adapter', candidateOnly=False)))
        self.assertTrue(eligible_task(dict(status='needs-adapter', candidateOnly=True)))
        self.assertTrue(eligible_task(dict(status='parked-protocol', candidateOnly=True)))


if __name__ == '__main__': unittest.main()
