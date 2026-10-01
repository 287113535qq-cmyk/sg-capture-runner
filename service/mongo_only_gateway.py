"""Restricted database I/O only. No capture, SQLite, scheduler, or game imports.

Trusted group/manifest/auth paths come from the root-owned SSH wrapper. This
candidate is not selected by the existing capture entry point.
"""
import json
import base64
import hashlib
import os
from pathlib import Path
import re
import sys
import time

LIMIT = 8 * 1024 * 1024
DATABASE = 'sg_capture_staging_v1'
COLLECTIONS = {'state': 'capture_state_v2', 'journal': 'capture_journal_v2'}
BACKUP_ROOT = Path('/var/lib/sg-capture-runner/reviews')


class Refused(Exception):
    pass


def need(value, code):
    if not value:
        raise Refused(code)


def resources():
    memory = {x.split(':')[0]: int(x.split()[1]) for x in Path('/proc/meminfo').read_text().splitlines()}
    disk = os.statvfs('/var/lib/sg-capture-runner')
    return {'sampledAtMs': int(time.time() * 1000),
            'bootId': Path('/proc/sys/kernel/random/boot_id').read_text().strip(),
            'cpuTicks': [int(x) for x in Path('/proc/stat').read_text().splitlines()[0].split()[1:9]],
            'memTotalKiB': memory['MemTotal'], 'memAvailableKiB': memory['MemAvailable'],
            'diskFreeBytes': disk.f_bavail * disk.f_frsize}


class Gateway:
    def __init__(self, database, group, manifest, sample=resources):
        need(group in ('primary', 'secondary'), 'GROUP_REQUIRED')
        need(manifest.get('schema') == 'sg-mongo-only-access-v2', 'MANIFEST_REQUIRED')
        self.db, self.group, self.manifest, self.sample = database, group, manifest, sample

    def scope(self, request):
        trial = request.get('trialId')
        need(isinstance(trial, str) and trial in self.manifest['trials'], 'TRIAL_NOT_ALLOWED')
        scope = self.manifest['trials'][trial]
        need(scope['group'] == self.group, 'GROUP_SCOPE_DENIED')
        if 'maxSequence' in scope:
            approved = {'sg_r1_20260930_32795': (32795,33155,'primary',300000),
                        'sg_r1_20261001_32799': (32799,33159,'primary',300000),
                        'sg_r1_20260928_32721': (32721,33121,'secondary',299850)}
            need(trial in approved
                 and (scope['gameId'],scope['runtimeGameId'],scope['group'],scope['target']) == approved[trial]
                 and type(scope['maxSequence']) is int
                 and scope['maxSequence'] == 600000, 'SEQUENCE_SCOPE_DENIED')
        return trial, scope

    def dispatch(self, r):
        need(isinstance(r, dict) and r.get('schema') == 'sg-mongo-only-v2', 'SCHEMA_REQUIRED')
        need('group' not in r and 'runnerGroup' not in r, 'GROUP_IS_NOT_CLIENT_INPUT')
        op = r.get('op')
        if op == 'resources':
            return self.sample()
        if op == 'hello':
            return {'group': self.group, 'database': DATABASE, 'schema': 'sg-mongo-only-v2',
                    'captureLogicOnServer': False, 'legacyRuntimeEnabled': False}
        if op == 'global_holds':
            # Fixed, read-only cross-group safety records. Their contents and
            # all decisions are calculated by GitHub, not by this transport.
            collection = self.db[COLLECTIONS['state']]
            return [collection.find_one({'_id': group + '/global-hold'}, max_time_ms=10000)
                    for group in ('primary', 'secondary')]
        if op == 'parallel_rhino_jobless_fence':
            # Two immutable identity proofs only. GitHub decides whether to fence.
            need(self.group == 'secondary' and set(r) == {'schema', 'op'}, 'BOUNDARY_SCOPE_DENIED')
            scope = self.manifest['trials'].get('sg_r1_20261001_32799', {})
            need(tuple(scope.get(k) for k in ('gameId','runtimeGameId','group','target','maxSequence'))
                 == (32799,33159,'primary',300000,600000), 'BOUNDARY_TRIAL_SCOPE')
            keys = ['primary/count-run:sg_r1_20261001_32799:36854881370:1',
                    'primary/count-jobless-revocation:sg_r1_20261001_32799:36854881370:1:complete']
            return list(self.db[COLLECTIONS['journal']].find({'_id': {'$in': keys}}, max_time_ms=10000).limit(2))
        if op in ('parallel_rhino_count_boundary', 'parallel_pyramids_count_boundary'):
            # Two fixed trial scopes; only an attempt-one run identity is variable.
            # This is database I/O. GitHub verifies ownership, permission and jobs.
            need(set(r) == {'schema', 'op', 'run', 'activation'}, 'BOUNDARY_SCOPE_DENIED')
            run = r['run']
            need(isinstance(run, str) and re.fullmatch(r'[1-9][0-9]{0,14}:1', run), 'BOUNDARY_RUN_SCOPE')
            activation = r['activation']
            need(isinstance(activation, str) and re.fullmatch(r'[a-f0-9]{64}', activation), 'BOUNDARY_ACTIVATION_SCOPE')
            rhino = op == 'parallel_rhino_count_boundary'
            group, trial, identity = (('primary', 'sg_r1_20261001_32799', (32799,33159,'primary',300000,600000))
                                      if rhino else ('secondary', 'sg_r1_20260928_32721', (32721,33121,'secondary',299850,600000)))
            need(self.group != group, 'GROUP_SCOPE_DENIED')
            scope = self.manifest['trials'].get(trial, {})
            need(tuple(scope.get(k) for k in ('gameId','runtimeGameId','group','target','maxSequence')) == identity,
                 'BOUNDARY_TRIAL_SCOPE')
            ids = [group + '/campaign', group + '/pool:' + trial, group + '/capture-run:' + run]
            spec = group + '/complete-count:' + trial + ':' + activation
            keys = [group + '/count-run:' + trial + ':' + run, spec, spec + ':complete']
            return {'state': list(self.db[COLLECTIONS['state']].find({'_id': {'$in': ids}}, max_time_ms=10000).limit(3)),
                    'journal': list(self.db[COLLECTIONS['journal']].find({'_id': {'$in': keys}}, max_time_ms=10000).limit(3))}
        if op == 'parallel_primary_rhino_two_boundary':
            # Fixed native reads only; GitHub verifies run, profile and leases.
            need(self.group == 'secondary', 'GROUP_SCOPE_DENIED')
            need(set(r) == {'schema', 'op'}, 'BOUNDARY_SCOPE_DENIED')
            scope = self.manifest['trials'].get('sg_r1_20261001_32799', {})
            need((scope.get('gameId'), scope.get('runtimeGameId'), scope.get('group'), scope.get('target'), scope.get('maxSequence'))
                 == (32799,33159,'primary',300000,600000), 'BOUNDARY_TRIAL_SCOPE')
            ids = ['primary/campaign', 'primary/pool:sg_r1_20261001_32799',
                   'primary/capture-run:36835017232:1']
            keys = ['primary/count-run:sg_r1_20261001_32799:36835017232:1']
            return {'state': list(self.db[COLLECTIONS['state']].find({'_id': {'$in': ids}}, max_time_ms=10000).limit(3)),
                    'journal': list(self.db[COLLECTIONS['journal']].find({'_id': {'$in': keys}}, max_time_ms=10000).limit(1))}
        if op == 'parallel_primary_observation_boundary':
            need(self.group == 'secondary', 'GROUP_SCOPE_DENIED')
            need(set(r) == {'schema','op'}, 'BOUNDARY_SCOPE_DENIED')
            ids = ['primary/campaign', 'primary/pool:sg_r1_20260930_32795',
                   'primary/capture-run:36782298458:1']
            return {'state': list(self.db[COLLECTIONS['state']].find({'_id': {'$in': ids}}, max_time_ms=10000).limit(3)),
                    'journal': []}
        if op == 'parallel_primary_boundary':
            # Fixed read-only documents for the reviewed two-account boundary.
            # The GitHub runner performs identity/lease/permission decisions.
            need(self.group == 'secondary', 'GROUP_SCOPE_DENIED')
            need(set(r) == {'schema','op'}, 'BOUNDARY_SCOPE_DENIED')
            state_ids = ['primary/campaign', 'primary/pool:sg_r1_20260930_32795',
                         'primary/capture-run:36753473985:1']
            prefix = 'primary/demo-generation:sg_r1_20260928_32820:53448c2a8f711899004d05c065f947cd8fb737f9da8152f69ccd7f4da7d53ed2'
            journal_ids = [prefix, prefix+':before', prefix+':complete', prefix+':parked-source']
            return {'state': list(self.db[COLLECTIONS['state']].find({'_id': {'$in': state_ids}}, max_time_ms=10000).limit(3)),
                    'journal': list(self.db[COLLECTIONS['journal']].find({'_id': {'$in': journal_ids}}, max_time_ms=10000).limit(4))}
        if op == 'control_read':
            # Fixed document reads only; all source/lease decisions remain on GitHub.
            ids = ['primary/global-hold', 'secondary/global-hold', self.group + '/campaign']
            if r.get('trialId') is not None:
                trial, _ = self.scope(r)
                ids.append(self.group + '/pool:' + trial)
            projection = None
            if 'workerId' in r:
                worker = r['workerId']
                need(type(worker) is int and 0 <= worker < 160 and r.get('trialId') is not None, 'CONTROL_WORKER_SCOPE')
                # Fixed field projection only: no leases, quota or source decisions
                # execute here. GitHub checks this worker against its own fence.
                projection = {'_id': 1, 'version': 1, 'value.active': 1,
                              'value.enabled': 1, 'value.activeGame': 1,
                              'value.failure': 1, 'value.drainingProtocol': 1,
                              'value.workers.'+str(worker): 1}
            rows = list(self.db[COLLECTIONS['state']].find({'_id': {'$in': ids}}, projection=projection, max_time_ms=10000).limit(4))
            return rows
        if op == 'read_many':
            alias, keys = r.get('collection'), r.get('keys')
            need(alias in COLLECTIONS, 'COLLECTION_NOT_ALLOWED')
            need(isinstance(keys, list) and 1 <= len(keys) <= 100
                 and all(isinstance(k, str) and re.fullmatch(r'[a-zA-Z0-9:_-]{1,180}', k) for k in keys)
                 and len(set(keys)) == len(keys), 'BAD_KEYS')
            ids = [self.group + '/' + k for k in keys]
            return list(self.db[COLLECTIONS[alias]].find({'_id': {'$in': ids}}, max_time_ms=10000).limit(100))
        if op == 'frozen_trial_bytes':
            # Fixed, root-configured private backup bytes only. The Runner
            # decodes SQLite/WAL and performs every game/record comparison.
            trial, _ = self.scope(r)
            entry = self.manifest.get('frozenTrialArchives', {}).get(trial)
            need(isinstance(entry, dict), 'FROZEN_ARCHIVE_NOT_ALLOWED')
            relative = entry.get('path')
            need(isinstance(relative, str) and re.fullmatch(r'[a-z0-9-]{1,100}/full\.tar\.gz', relative), 'FROZEN_ARCHIVE_PATH')
            need('path' not in r and 'sha256' not in r, 'FROZEN_ARCHIVE_NOT_CLIENT_INPUT')
            path = BACKUP_ROOT / relative
            need(path.is_file() and not path.is_symlink() and not path.parent.is_symlink()
                 and path.resolve().is_relative_to(BACKUP_ROOT.resolve()), 'FROZEN_ARCHIVE_PATH')
            size, digest = entry.get('bytes'), entry.get('sha256')
            need(type(size) is int and 0 < size <= 40 * 1024 * 1024
                 and isinstance(digest, str) and re.fullmatch(r'[a-f0-9]{64}', digest), 'FROZEN_ARCHIVE_MANIFEST')
            need(path.stat().st_size == size, 'FROZEN_ARCHIVE_CHANGED')
            offset = r.get('offset', 0)
            need(type(offset) is int and 0 <= offset < size, 'BAD_OFFSET')
            # Bound the read and bind it to one open descriptor. The whole
            # downloaded file must additionally match this hash on the Runner.
            with path.open('rb') as stream:
                need(hashlib.file_digest(stream, 'sha256').hexdigest() == digest, 'FROZEN_ARCHIVE_CHANGED')
                stream.seek(offset)
                chunk = stream.read(min(256 * 1024, size - offset))
            return {'offset': offset, 'size': size, 'sha256': digest,
                    'data': base64.b64encode(chunk).decode()}
        if op in ('legacy_manifest', 'legacy_bytes'):
            # Temporary, read-only transfer of the already frozen archive.
            # SQLite decoding/validation/migration happens on GitHub, never here.
            need(self.manifest.get('legacyExportEnabled') is True, 'LEGACY_EXPORT_DISABLED')
            directory = Path('/var/lib/sg-capture-runner/reviews/github-processing-freeze-20260928')
            allowed = self.manifest['legacyTrialDirectories'][self.group]
            if op == 'legacy_manifest':
                files = json.loads((directory / 'manifest.json').read_text())
                return {'files': [x for x in files if any(x['path'].startswith(t + '/') for t in allowed)],
                        'receipt': json.loads((directory / 'backup-receipt.json').read_text())}
            relative = r.get('path')
            need(isinstance(relative, str) and '\\' not in relative
                 and (relative == 'queue-before.sqlite3' or any(relative.startswith(t + '/') for t in allowed)),
                 'LEGACY_PATH_DENIED')
            path = directory / relative
            need(path.resolve().is_relative_to(directory) and path.is_file() and not path.is_symlink(), 'LEGACY_PATH_DENIED')
            offset = r.get('offset', 0)
            need(type(offset) is int and 0 <= offset <= path.stat().st_size, 'BAD_OFFSET')
            with path.open('rb') as stream:
                stream.seek(offset); chunk = stream.read(256 * 1024)
            return {'offset': offset, 'size': path.stat().st_size, 'data': base64.b64encode(chunk).decode()}
        if op in ('read', 'create', 'cas', 'scan'):
            alias = r.get('collection')
            need(alias in COLLECTIONS, 'COLLECTION_NOT_ALLOWED')
            collection = self.db[COLLECTIONS[alias]]
            key = r.get('key')
            need(isinstance(key, str) and re.fullmatch(r'[a-zA-Z0-9:_-]{1,180}', key), 'BAD_KEY')
            identity = self.group + '/' + key
            if op == 'scan':
                need(alias == 'journal', 'SCAN_NOT_ALLOWED')
                prefix = self.group + '/' + key
                cursor = r.get('after', prefix)
                need(isinstance(cursor, str) and cursor.startswith(prefix), 'BAD_CURSOR')
                # Bounded indexed prefix range; never caller-provided Mongo queries.
                return list(collection.find({'_id': {'$gt': cursor, '$lt': prefix + '\uffff'}},
                                            max_time_ms=10000).sort('_id', 1).limit(100))
            if op == 'read':
                return collection.find_one({'_id': identity}, max_time_ms=10000)
            need(self.manifest.get('metadataWritesEnabled') is True, 'METADATA_WRITES_DISABLED')
            value = r.get('value')
            need(isinstance(value, dict), 'DOCUMENT_REQUIRED')
            if op == 'create':
                document = {'_id': identity, 'version': 0, 'value': value}
                try:
                    collection.insert_one(document)
                    return {'created': True}
                except Exception as exc:
                    if getattr(exc, 'code', None) == 11000:
                        return {'created': False}
                    raise
            expected = r.get('version')
            need(type(expected) is int and 0 <= expected < 9007199254740991, 'BAD_VERSION')
            result = collection.replace_one({'_id': identity, 'version': expected},
                                            {'_id': identity, 'version': expected + 1, 'value': value})
            return {'replaced': result.matched_count == 1, 'version': expected + 1}
        if op in ('rounds_read', 'rounds_scan', 'rounds_insert'):
            trial, scope = self.scope(r)
            collection = self.db['official_rounds']
            if op == 'rounds_scan':
                after=r.get('after',0)
                need(type(after) is int and 0<=after<=scope.get('maxSequence',scope['target']),'BAD_CURSOR')
                return list(collection.find({'trialId':trial,'sequence':{'$gt':after}},max_time_ms=10000)
                            .sort('sequence',1).limit(100))
            if op == 'rounds_read':
                ids = r.get('ids')
                need(isinstance(ids, list) and 1 <= len(ids) <= 100
                     and all(isinstance(x, str) and re.fullmatch('[a-f0-9]{64}', x) for x in ids), 'BAD_IDS')
                return list(collection.find({'trialId': trial, '_id': {'$in': ids}}, max_time_ms=10000).limit(100))
            need(self.manifest.get('roundWritesEnabled') is True, 'ROUND_WRITES_DISABLED')
            rows = r.get('records')
            need(isinstance(rows, list) and 1 <= len(rows) <= 100, 'BAD_BATCH')
            for row in rows:
                need(isinstance(row, dict) and row.get('trialId') == trial
                     and row.get('gameId') == scope['gameId'] and row.get('runtimeGameId') == scope['runtimeGameId']
                     and row.get('fixtureOnly') is False and row.get('buy') == 0
                     and type(row.get('sequence')) is int and 1 <= row['sequence'] <= scope.get('maxSequence',scope['target'])
                     and isinstance(row.get('_id'), str) and re.fullmatch('[a-f0-9]{64}', row['_id'])
                     and isinstance(row.get('contentHash'), str) and re.fullmatch('[a-f0-9]{64}', row['contentHash']),
                     'ROUND_SCOPE_DENIED')
            # Insert-only idempotent upserts: never mutate an existing round.
            # Full content equality is checked by the GitHub client.
            from pymongo import UpdateOne
            result = collection.bulk_write([UpdateOne({'_id': row['_id'], 'contentHash': row['contentHash']},
                                                      {'$setOnInsert': row}, upsert=True) for row in rows], ordered=True)
            return {'inserted': result.upserted_count}
        raise Refused('OPERATION_NOT_ALLOWED')


def main():
    need(not os.environ.get('SSH_ORIGINAL_COMMAND'), 'SHELL_FORBIDDEN')
    group = os.environ.get('SG_RUNNER_GROUP')
    need(group in ('primary', 'secondary'), 'GROUP_REQUIRED')
    # The v2 dependencies are shipped in the immutable release, not installed
    # into the host Python or into any production application environment.
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'vendor-python'))
    from pymongo import MongoClient
    from pymongo.write_concern import WriteConcern
    from pymongo.read_concern import ReadConcern
    auth = json.loads(Path('/etc/sg-capture-runner/mongo-auth.json').read_text())
    need(auth.get('database') == DATABASE, 'WRONG_DATABASE')
    manifest = json.loads(Path('/etc/sg-capture-runner/mongo-only-access-v2.json').read_text())
    client = MongoClient('mongodb://127.0.0.1:27017', username=auth['user'], password=auth['password'],
                         authSource=DATABASE, maxPoolSize=1, minPoolSize=0,
                         serverSelectionTimeoutMS=10000, connectTimeoutMS=10000, socketTimeoutMS=45000,
                         retryWrites=False, retryReads=False, appname='sg-mongo-only-v2')
    database = client.get_database(DATABASE, write_concern=WriteConcern(w='majority', j=True, wtimeout=30000),
                                   read_concern=ReadConcern('majority'))
    gateway = Gateway(database, group, manifest)
    try:
        while True:
            line = sys.stdin.buffer.readline(LIMIT + 2)
            if not line:
                break
            try:
                need(len(line) <= LIMIT and line.endswith(b'\n'), 'REQUEST_TOO_LARGE')
                result = gateway.dispatch(json.loads(line))
                output = json.dumps({'ok': True, 'result': result}, separators=(',', ':'))
                need(len(output.encode()) <= 16 * 1024 * 1024, 'RESPONSE_TOO_LARGE')
            except Refused as exc:
                output = json.dumps({'ok': False, 'error': str(exc)})
            except Exception:
                output = '{"ok":false,"error":"MONGO_OPERATION_OUTCOME_UNKNOWN"}'
            print(output, flush=True)
            if len(line) > LIMIT:
                break
    finally:
        client.close()


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('{"ok":false,"error":"GATEWAY_UNAVAILABLE"}', flush=True)
        sys.exit(2)
