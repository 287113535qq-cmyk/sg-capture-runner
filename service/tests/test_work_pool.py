import concurrent.futures
import heapq
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from work_pool import WorkPool
from store import Rejected


def proof(batch):
    return {'status': 'complete', 'pending': None, 'journaled': batch['end'], 'durable': batch['end'],
        'checkpoint': batch['end'], 'confirmedCount': batch['end'] - batch['start'] + 1}


class WorkPoolTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='sg-work-pool-test-')
        self.now = [1000.0]
        self.pool = WorkPool(self.temp.name, 'fixture_next_trial', 30000, lambda: self.now[0])
        self.leases = [self.pool.register(i, f'{i+1:064x}', f'worker-{i}') for i in range(20)]
        self.pool.enable_by_operator()

    def tearDown(self):
        self.pool.close()
        self.temp.cleanup()

    def test_concurrent_claims_have_disjoint_ranges(self):
        def take(i):
            pool = WorkPool(self.temp.name, 'fixture_next_trial', 30000, lambda: self.now[0])
            try:
                return pool.take(self.leases[i])
            finally:
                pool.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
            batches = sorted(executor.map(take, range(20)), key=lambda b: b['start'])
        self.assertEqual(len({b['worker'] for b in batches}), 20)
        self.assertEqual(batches[0]['start'], 1)
        self.assertTrue(all(a['end'] + 1 == b['start'] for a, b in zip(batches, batches[1:])))
        self.assertEqual(self.pool.status()['unfinishedBatches'], 20)

    def test_fast_workers_keep_taking_work_and_exact_target_is_respected(self):
        queue, counts = [], [0] * 20
        for i, lease in enumerate(self.leases):
            batch = self.pool.take(lease)
            speed = 30 if i < 10 else 6
            heapq.heappush(queue, (self.now[0] + (batch['end'] - batch['start'] + 1) / speed, i, batch))
        while queue:
            self.now[0], i, batch = heapq.heappop(queue)
            self.pool.heartbeat(self.leases[i])
            self.pool.complete(self.leases[i], batch['id'], proof)
            counts[i] += batch['end'] - batch['start'] + 1
            following = self.pool.take(self.leases[i])
            if following:
                speed = 30 if i < 10 else 6
                heapq.heappush(queue, (self.now[0] + (following['end'] - following['start'] + 1) / speed, i, following))
        self.assertEqual(sum(counts), 30000)
        self.assertGreater(min(counts[:10]), max(counts[10:]) * 3)
        self.assertTrue(self.pool.status()['complete'])
        self.assertLess(self.now[0] - 1000, 110)  # Static equal quotas need 250 simulated seconds.
        batches = self.pool.db.execute('SELECT start,end FROM batches ORDER BY start').fetchall()
        self.assertEqual(batches[-1]['end'], 30000)
        self.assertTrue(all(a['end'] + 1 == b['start'] for a, b in zip(batches, batches[1:])))

    def test_retry_and_expired_lease_keep_same_batch_and_session(self):
        first = self.pool.take(self.leases[0])
        self.assertEqual(self.pool.take(self.leases[0])['id'], first['id'])
        self.now[0] += 601
        lease = self.pool.register(0, f'{1:064x}', 'recovered-worker')
        resumed = self.pool.take(lease)
        self.assertEqual(resumed['id'], first['id'])
        self.assertTrue(resumed['resumeRequired'])
        with self.assertRaisesRegex(Rejected, 'LEASE_LOST'):
            self.pool.complete(self.leases[0], first['id'], proof)
        with self.assertRaisesRegex(Rejected, 'SESSION_CHANGED'):
            self.pool.register(0, 'e' * 64, 'new-session')

    def test_pending_or_unconfirmed_batch_cannot_free_worker(self):
        batch = self.pool.take(self.leases[0])
        for field, value in [('pending', {'awaiting': True}), ('checkpoint', batch['end'] - 1), ('confirmedCount', 0)]:
            with self.assertRaisesRegex(Rejected, 'BATCH_NOT_DURABLE'):
                self.pool.complete(self.leases[0], batch['id'], lambda b: {**proof(b), field: value})
        self.assertEqual(self.pool.take(self.leases[0])['id'], batch['id'])

    def test_expired_owner_cannot_ack_after_storage_check(self):
        batch = self.pool.take(self.leases[0])
        def slow_verify(b):
            self.now[0] += 601
            return proof(b)
        with self.assertRaisesRegex(Rejected, 'LEASE_LOST'):
            self.pool.complete(self.leases[0], batch['id'], slow_verify)
        self.assertEqual(self.pool.status()['completedBatchRounds'], 0)

    def test_stopping_preserves_inflight_batch_and_known_completion(self):
        batch = self.pool.take(self.leases[0])
        self.pool.halt('SOURCE_OUTCOME_UNKNOWN')
        with self.assertRaisesRegex(Rejected, 'POOL_STOPPED'):
            self.pool.take(self.leases[1])
        self.pool.complete(self.leases[0], batch['id'], proof)
        self.assertEqual(self.pool.status()['completedBatchRounds'], batch['end'])
        with self.assertRaisesRegex(Rejected, 'POOL_HALTED'):
            self.pool.enable_by_operator()

    def test_duplicate_completion_is_idempotent(self):
        batch = self.pool.take(self.leases[0])
        self.pool.complete(self.leases[0], batch['id'], proof)
        self.pool.complete(self.leases[0], batch['id'], lambda b: self.fail('Already durable'))
        self.assertEqual(self.pool.status()['completedBatchRounds'], batch['end'])

    def test_duplicate_session_and_live_worker_are_rejected(self):
        with self.assertRaisesRegex(Rejected, 'WORKER_BUSY'):
            self.pool.register(0, f'{1:064x}', 'other-owner')
        with tempfile.TemporaryDirectory(prefix='sg-work-pool-session-test-') as directory:
            fresh = WorkPool(directory, 'fixture_sessions', 20)
            try:
                fresh.register(0, f'{1:064x}', 'first-owner')
                with self.assertRaisesRegex(Rejected, 'SHARED_SESSION'):
                    fresh.register(1, f'{1:064x}', 'other-owner')
            finally:
                fresh.close()

    def test_changed_plan_cannot_reopen_same_pool(self):
        with self.assertRaisesRegex(Rejected, 'POOL_PLAN_CHANGED'):
            WorkPool(self.temp.name, 'fixture_next_trial', 300000)


if __name__ == '__main__':
    unittest.main()
