"""Bounded parallel replay of completed batches; no game-source requests."""
from concurrent.futures import ProcessPoolExecutor, as_completed
import multiprocessing
from pathlib import Path
import time

from store import require
from trial_mongo import TrialMongo
from trial_store import TrialStore

AUDIT_PROCESSES = 4


def audit_lane(root, plan, batches, request, mongo_type=TrialMongo):
    # Each process owns its SQLite handles and one persistent, read-only Mongo
    # connection. Never share a capture connection between audit processes.
    mongo = mongo_type(plan=plan, read_only=True)
    reports = []
    try:
        for batch in batches:
            spec = {key: batch[key] for key in ('id', 'worker', 'start', 'end')}
            directory = Path(root) / 'trials' / plan['trialId'] / 'batches' / str(spec['id'])
            require(all((directory / name).is_file() for name in
                ('state.sqlite3', 'raw.jsonl', 'rounds.jsonl')), 'AUDIT_BATCH_FILES_MISSING')
            store = TrialStore(root, mongo.scoped((spec['start'], spec['end'])), plan=plan, batch=spec)
            try:
                reports.append(store.dispatch(request))
            finally:
                store.close()
    finally:
        mongo.close()
    return reports


def parallel_audit(root, plan, batches, request):
    require(all(batch['completed'] is not None for batch in batches), 'POOL_NOT_QUIESCENT')
    if not batches:
        return [], {'processes': 0, 'seconds': 0}
    workers = min(AUDIT_PROCESSES, len(batches))
    lanes, sizes = [[] for _ in range(workers)], [0] * workers
    # Balance by complete-round count, rather than batch count, because batch
    # sizes vary with the capture node's observed speed.
    for batch in sorted(batches, key=lambda b: b['end'] - b['start'], reverse=True):
        lane = min(range(workers), key=lambda i: sizes[i])
        lanes[lane].append(dict(batch))
        sizes[lane] += batch['end'] - batch['start'] + 1
    started, reports = time.monotonic(), []
    with ProcessPoolExecutor(max_workers=workers, mp_context=multiprocessing.get_context('spawn')) as executor:
        futures = [executor.submit(audit_lane, str(root), plan, lane, request) for lane in lanes]
        for future in as_completed(futures):
            reports.extend(future.result())
    return reports, {'processes': workers, 'seconds': round(time.monotonic() - started, 3)}
