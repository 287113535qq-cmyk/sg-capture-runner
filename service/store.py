"""Durable, fixture-only SG transport validation. Never accepts official rounds."""
import contextlib
import hashlib
import json
import os
import re
import sqlite3
import time
from pathlib import Path
from round_fields import validate as validate_round_fields, FieldError

SCHEMA = "sg-link-fixture-v1"
CASE = re.compile(r"fixture_[a-z0-9_]{1,64}\Z")
GAME = re.compile(r"fixture-[a-z0-9-]{1,40}\Z")
OWNER = re.compile(r"[a-zA-Z0-9:_-]{1,100}\Z")

class Rejected(Exception):
    pass

class InjectedCrash(BaseException):
    pass

def require(condition, code):
    if not condition:
        raise Rejected(code)

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()

def sync_dir(path):
    if os.name != "nt":
        fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)

@contextlib.contextmanager
def file_lock(path):
    with open(path, "a+b") as handle:
        if os.name == "nt":
            import msvcrt
            if os.fstat(handle.fileno()).st_size == 0:
                handle.write(b"0")
                handle.flush()
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(handle, fcntl.LOCK_EX)
        try:
            yield
        finally:
            if os.name == "nt":
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle, fcntl.LOCK_UN)

class Store:
    def __init__(self, root, mongo, clock=time.time):
        self.root = Path(root).resolve()
        self.mongo = mongo
        self.clock = clock
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)

    def dispatch(self, request):
        require(isinstance(request, dict), "BAD_REQUEST")
        require(request.get("schema") == SCHEMA, "FIXTURE_SCHEMA_REQUIRED")
        case = request.get("caseId", "")
        require(isinstance(case, str) and bool(CASE.fullmatch(case)), "FIXTURE_CASE_REQUIRED")
        require(len(canonical(request)) <= 16384, "REQUEST_TOO_LARGE")
        op = request.get("op")
        require(op in {"initialize", "claim", "heartbeat", "commit", "release", "status", "verify", "promote", "cooldown"}, "OP_NOT_ALLOWED")
        with file_lock(self.root / "coordinator.lock"):
            db = sqlite3.connect(self.root / "state.sqlite3", isolation_level=None)
            db.row_factory = sqlite3.Row
            try:
                db.execute("PRAGMA journal_mode=WAL")
                db.execute("PRAGMA synchronous=FULL")
                db.executescript("""
                CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY, plan_hash TEXT NOT NULL, cooldown_until REAL NOT NULL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS tasks(case_id TEXT NOT NULL, game TEXT NOT NULL, target INTEGER NOT NULL,
                  status TEXT NOT NULL DEFAULT 'pending', owner TEXT, last_owner TEXT, epoch INTEGER NOT NULL DEFAULT 0,
                  lease_until REAL NOT NULL DEFAULT 0, heartbeat REAL, checkpoint INTEGER NOT NULL DEFAULT 0,
                  failure TEXT, PRIMARY KEY(case_id,game));
                CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY, case_id TEXT NOT NULL, game TEXT NOT NULL,
                  sequence INTEGER NOT NULL, payload TEXT NOT NULL, hash TEXT NOT NULL, raw_offset INTEGER NOT NULL,
                  norm_offset INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'prepared', UNIQUE(case_id,game,sequence));
                """)
                if op != "initialize":
                    require(db.execute("SELECT 1 FROM cases WHERE id=?", (case,)).fetchone(), "UNKNOWN_CASE")
                result = getattr(self, "_" + op)(db, request)
                return {"ok": True, "schema": SCHEMA, "fixtureOnly": True, **result}
            finally:
                db.close()

    def _initialize(self, db, req):
        games = req.get("games")
        require(isinstance(games, list) and 1 <= len(games) <= 21, "BAD_PLAN")
        seen = set()
        for game in games:
            require(isinstance(game, dict) and set(game) == {"gameId", "target"}, "BAD_PLAN")
            require(isinstance(game["gameId"], str) and GAME.fullmatch(game["gameId"]), "FIXTURE_GAME_REQUIRED")
            require(type(game["target"]) is int and 1 <= game["target"] <= 5, "BAD_TARGET")
            require(game["gameId"] not in seen, "DUPLICATE_GAME")
            seen.add(game["gameId"])
        plan_hash = digest(sorted(games, key=lambda g: g["gameId"]))
        old = db.execute("SELECT plan_hash FROM cases WHERE id=?", (req["caseId"],)).fetchone()
        if old:
            require(old["plan_hash"] == plan_hash, "PLAN_CHANGED")
        else:
            self.mongo.ensure()
            db.execute("BEGIN IMMEDIATE")
            try:
                db.execute("INSERT INTO cases(id,plan_hash) VALUES(?,?)", (req["caseId"], plan_hash))
                db.executemany("INSERT INTO tasks(case_id,game,target) VALUES(?,?,?)", [(req["caseId"], g["gameId"], g["target"]) for g in games])
                db.execute("COMMIT")
            except BaseException:
                db.execute("ROLLBACK")
                raise
        return {"games": len(games), "alreadyInitialized": bool(old)}

    def _task(self, db, req):
        game = req.get("gameId", "")
        require(isinstance(game, str) and bool(GAME.fullmatch(game)), "FIXTURE_GAME_REQUIRED")
        task = db.execute("SELECT * FROM tasks WHERE case_id=? AND game=?", (req["caseId"], game)).fetchone()
        require(task is not None, "UNKNOWN_GAME")
        return task

    def _owner(self, req):
        owner = req.get("owner", "")
        require(isinstance(owner, str) and bool(OWNER.fullmatch(owner)), "BAD_OWNER")
        return owner

    def _owned(self, db, req):
        task = self._task(db, req)
        require(task["status"] == "claimed" and task["owner"] == self._owner(req)
                and type(req.get("epoch")) is int and task["epoch"] == req["epoch"]
                and task["lease_until"] > self.clock(), "LEASE_LOST")
        return task

    def _claim(self, db, req):
        task = self._task(db, req)
        now = self.clock()
        cooldown = db.execute("SELECT cooldown_until FROM cases WHERE id=?", (req["caseId"],)).fetchone()[0]
        require(cooldown <= now, "COOLDOWN_ACTIVE")
        require(task["status"] != "complete", "ALREADY_COMPLETE")
        require(task["status"] != "claimed" or task["lease_until"] <= now, "GAME_BUSY")
        seconds = req.get("leaseSeconds", 300)
        require(type(seconds) is int and 2 <= seconds <= 600, "BAD_LEASE")
        owner = self._owner(req)
        epoch = task["epoch"] + 1
        db.execute("UPDATE tasks SET status='claimed',owner=?,last_owner=?,epoch=?,lease_until=?,heartbeat=?,failure=NULL WHERE case_id=? AND game=?",
                   (owner, owner, epoch, now + seconds, now, req["caseId"], task["game"]))
        return {"gameId": task["game"], "owner": owner, "epoch": epoch,
                "leaseUntil": now + seconds, "checkpoint": task["checkpoint"]}

    def _heartbeat(self, db, req):
        task = self._owned(db, req)
        now = self.clock()
        db.execute("UPDATE tasks SET lease_until=?,heartbeat=? WHERE case_id=? AND game=?", (now + 300, now, req["caseId"], task["game"]))
        return {"leaseUntil": now + 300, "checkpoint": task["checkpoint"]}

    def _paths(self, case, game):
        directory = self.root
        for component in ("cases", case, game):
            child = directory / component
            if not child.exists():
                child.mkdir(mode=0o700)
                sync_dir(directory)
            directory = child
        return directory / "raw.jsonl", directory / "rounds.jsonl"

    def _append_exact(self, path, offset, line):
        created = not path.exists()
        fd = os.open(path, os.O_RDWR | os.O_CREAT | getattr(os, "O_BINARY", 0), 0o600)
        try:
            size = os.fstat(fd).st_size
            require(size >= offset, "DURABLE_PREFIX_MISSING")
            os.lseek(fd, offset, os.SEEK_SET)
            present = os.read(fd, len(line))
            require(line.startswith(present), "DURABLE_CONTENT_CONFLICT")
            if len(present) < len(line):
                require(size == offset + len(present), "DURABLE_TAIL_CONFLICT")
                os.lseek(fd, size, os.SEEK_SET)
                remaining = memoryview(line)[len(present):]
                while remaining:
                    written = os.write(fd, remaining)
                    require(written > 0, "DURABLE_WRITE_FAILED")
                    remaining = remaining[written:]
            os.fsync(fd)
        finally:
            os.close(fd)
        if created:
            sync_dir(path.parent)

    def _envelope(self, req, task):
        value = req.get("round")
        require(isinstance(value, dict) and set(value) == {"sequence", "sourceRoundId", "raw", "normalized"}, "BAD_ROUND")
        seq = value["sequence"]
        require(type(seq) is int and 1 <= seq <= task["target"], "BAD_SEQUENCE")
        require(value["sourceRoundId"] == f'{task["game"]}:round:{seq}', "FIXTURE_ROUND_REQUIRED")
        raw, normalized = value["raw"], value["normalized"]
        require(isinstance(raw, dict) and raw.get("fixtureOnly") is True, "FIXTURE_RAW_REQUIRED")
        require(isinstance(normalized, dict) and normalized.get("fixtureOnly") is True, "FIXTURE_NORMALIZED_REQUIRED")
        require(normalized.get("sequence") == seq and normalized.get("gameKey") == task["game"], "ROUND_IDENTITY_MISMATCH")
        require(len(canonical(value)) <= 8192, "ROUND_TOO_LARGE")
        business = self._business_fields(req['caseId'], raw, normalized)
        identity = {"caseId": req["caseId"], "gameId": task["game"], "sourceRoundId": value["sourceRoundId"]}
        return {"_id": digest(identity), **identity, **business, "sequence": seq, "fixtureOnly": True,
                "raw": raw, "normalized": normalized, "rawHash": digest(raw), "normalizedHash": digest(normalized),
                "contentHash": digest({**identity, "raw": raw, "normalized": normalized})}

    def _business_fields(self, case, raw, normalized):
        enabled = case.startswith('fixture_fields_') or 'roundFieldsVersion' in raw or any(
            key in normalized for key in ('bet', 'mul', 'buy', 'bonus', 'roundFieldsVersion'))
        if not enabled:
            return {}  # Existing transport-only receipts remain unchanged.
        try:
            return validate_round_fields(raw, normalized)
        except (FieldError, ValueError, TypeError, KeyError, OverflowError) as exc:
            code = str(exc) if isinstance(exc, FieldError) else 'INVALID_ROUND_FIELD_EVIDENCE'
            raise Rejected(code) from None

    def _persist(self, db, req, receipt, failpoint=None):
        self._owned(db, req)
        record = json.loads(receipt["payload"])
        raw_path, norm_path = self._paths(req["caseId"], receipt["game"])
        raw_line = {"_id": record["_id"], "rawHash": record["rawHash"], "contentHash": record["contentHash"], "fixtureOnly": True, "raw": record["raw"]}
        norm_line = {k: v for k, v in record.items() if k != "raw"}
        self._append_exact(raw_path, receipt["raw_offset"], canonical(raw_line) + b"\n")
        self._append_exact(norm_path, receipt["norm_offset"], canonical(norm_line) + b"\n")
        if failpoint == "after_files":
            raise InjectedCrash()
        inserted = self.mongo.upsert(record)
        if failpoint == "after_mongo":
            raise InjectedCrash()
        task = self._owned(db, req)  # Fence again after durable I/O and network waits.
        require(record["sequence"] == task["checkpoint"] + 1, "CHECKPOINT_ORDER_CONFLICT")
        db.execute("BEGIN IMMEDIATE")
        try:
            db.execute("UPDATE receipts SET status='committed' WHERE id=?", (receipt["id"],))
            db.execute("UPDATE tasks SET checkpoint=? WHERE case_id=? AND game=?", (record["sequence"], req["caseId"], receipt["game"]))
            db.execute("COMMIT")
        except BaseException:
            db.execute("ROLLBACK")
            raise
        if failpoint == "after_checkpoint":
            raise InjectedCrash()
        return int(inserted)

    def _commit(self, db, req):
        task = self._owned(db, req)
        record = self._envelope(req, task)
        fault = req.get("failpoint")
        require(fault in {None, "after_files", "after_mongo", "after_checkpoint"}, "BAD_FAILPOINT")
        old = db.execute("SELECT * FROM receipts WHERE id=?", (record["_id"],)).fetchone()
        if old:
            require(old["hash"] == record["contentHash"], "ROUND_IDENTITY_CONFLICT")
        recovered, inserted = 0, 0
        for pending in db.execute("SELECT * FROM receipts WHERE case_id=? AND game=? AND status='prepared' ORDER BY sequence", (req["caseId"], task["game"])).fetchall():
            inserted += self._persist(db, req, pending)
            recovered += 1
        if old:
            current = self._owned(db, req)
            return {"duplicate": True, "mongoInserted": inserted, "recovered": recovered, "checkpoint": current["checkpoint"]}
        task = self._owned(db, req)
        require(record["sequence"] == task["checkpoint"] + 1, "SEQUENCE_GAP")
        raw_path, norm_path = self._paths(req["caseId"], task["game"])
        raw_offset = raw_path.stat().st_size if raw_path.exists() else 0
        norm_offset = norm_path.stat().st_size if norm_path.exists() else 0
        db.execute("INSERT INTO receipts(id,case_id,game,sequence,payload,hash,raw_offset,norm_offset) VALUES(?,?,?,?,?,?,?,?)",
                   (record["_id"], req["caseId"], task["game"], record["sequence"], canonical(record).decode(), record["contentHash"], raw_offset, norm_offset))
        receipt = db.execute("SELECT * FROM receipts WHERE id=?", (record["_id"],)).fetchone()
        inserted += self._persist(db, req, receipt, fault)
        return {"duplicate": False, "mongoInserted": inserted, "recovered": recovered, "checkpoint": record["sequence"]}

    def _release(self, db, req):
        task = self._owned(db, req)
        status = req.get("status", "pending")
        require(status in {"pending", "complete", "failed"}, "BAD_RELEASE_STATUS")
        reason = req.get("reason")
        require(reason in {None, "fixture_stop", "network", "storage", "source_unavailable"}, "BAD_FAILURE_CATEGORY")
        if status == "complete":
            require(task["checkpoint"] == task["target"], "NOT_COMPLETE")
            require(not db.execute("SELECT 1 FROM receipts WHERE case_id=? AND game=? AND status='prepared'", (req["caseId"], task["game"])).fetchone(), "PENDING_RECEIPT")
        db.execute("UPDATE tasks SET status=?,owner=NULL,lease_until=0,failure=? WHERE case_id=? AND game=?", (status, reason, req["caseId"], task["game"]))
        return {"gameId": task["game"], "status": status, "checkpoint": task["checkpoint"]}

    def _status(self, db, req):
        tasks = db.execute("SELECT game,status,owner,last_owner,epoch,lease_until,checkpoint,target,failure FROM tasks WHERE case_id=? ORDER BY game", (req["caseId"],)).fetchall()
        count = db.execute("SELECT status,COUNT(*) FROM receipts WHERE case_id=? GROUP BY status", (req["caseId"],)).fetchall()
        return {"caseId": req["caseId"], "tasks": [dict(t) for t in tasks], "receipts": {r[0]: r[1] for r in count},
                "cooldownUntil": db.execute("SELECT cooldown_until FROM cases WHERE id=?", (req["caseId"],)).fetchone()[0]}

    def _verified_records(self, db, req):
        game = req.get("gameId") if req["op"] == "verify" else None
        if game is not None:
            self._task(db, req)
        where = "case_id=?" + (" AND game=?" if game is not None else "")
        parameters = (req["caseId"], game) if game is not None else (req["caseId"],)
        require(not db.execute("SELECT 1 FROM receipts WHERE " + where + " AND status!='committed'", parameters).fetchone(), "UNCONFIRMED_RECORDS")
        records = [json.loads(r[0]) for r in db.execute("SELECT payload FROM receipts WHERE " + where + " ORDER BY game,sequence", parameters)]
        for record in records:
            fields = self._business_fields(req['caseId'], record['raw'], record['normalized'])
            require(all(record.get(key) == value for key, value in fields.items()), 'TOP_LEVEL_FIELDS_MISMATCH')
        for task in db.execute("SELECT * FROM tasks WHERE " + where, parameters):
            expected = [r for r in records if r["gameId"] == task["game"]]
            require(task["checkpoint"] == len(expected), "CHECKPOINT_PARITY_FAILED")
            raw_path, norm_path = self._paths(req["caseId"], task["game"])
            def read_lines(path):
                if not path.exists():
                    return []
                with path.open("rb") as handle:
                    data = []
                    for line in handle:
                        require(line.endswith(b"\n") and line.strip(), "PARTIAL_JSONL")
                        data.append(json.loads(line))
                    return data
            raw, norm = read_lines(raw_path), read_lines(norm_path)
            require(len(raw) == len(norm) == len(expected), "FILE_COUNT_PARITY_FAILED")
            for record, raw_row, norm_row in zip(expected, raw, norm):
                require(norm_row == {k: v for k, v in record.items() if k != "raw"}, "NORMALIZED_PARITY_FAILED")
                require(raw_row == {"_id": record["_id"], "rawHash": record["rawHash"], "contentHash": record["contentHash"], "fixtureOnly": True, "raw": record["raw"]}, "RAW_PARITY_FAILED")
                require(digest(record["raw"]) == record["rawHash"] and digest(record["normalized"]) == record["normalizedHash"], "HASH_PARITY_FAILED")
        mongo = self.mongo.records(req["caseId"])
        if game is not None:
            mongo = [record for record in mongo if record["gameId"] == game]
        require(sorted(mongo, key=lambda r: r["_id"]) == sorted(records, key=lambda r: r["_id"]), "MONGO_PARITY_FAILED")
        return records

    def _verify(self, db, req):
        records = self._verified_records(db, req)
        fields = [{key: record[key] for key in ('_id', 'gameId', 'bet', 'mul', 'buy', 'bonus')}
                  for record in records if 'roundFieldsVersion' in record]
        return {"count": len(records), "rawNormalizedMongoParity": True,
                "businessFieldsVerified": len(fields), "businessFields": fields,
                "identitySetHash": digest(sorted((r["_id"], r["contentHash"]) for r in records))}

    def _promote(self, db, req):
        records = self._verified_records(db, req)
        require(not db.execute("SELECT 1 FROM tasks WHERE case_id=? AND status!='complete'", (req["caseId"],)).fetchone(), "CASE_NOT_COMPLETE")
        inserted = self.mongo.promote(records)
        accepted = self.mongo.records(req["caseId"], accepted=True)
        require(sorted(accepted, key=lambda r: r["_id"]) == sorted(records, key=lambda r: r["_id"]), "ACCEPTED_PARITY_FAILED")
        return {"acceptedCount": len(accepted), "inserted": inserted, "duplicates": len(records) - inserted,
                "target": "isolated_fixture_accepted_rounds", "gamePoolsTouched": False}

    def _cooldown(self, db, req):
        seconds = req.get("seconds")
        require(type(seconds) is int and 1 <= seconds <= 120, "BAD_COOLDOWN")
        until = self.clock() + seconds
        db.execute("UPDATE cases SET cooldown_until=MAX(cooldown_until,?) WHERE id=?", (until, req["caseId"]))
        return {"cooldownUntil": db.execute("SELECT cooldown_until FROM cases WHERE id=?", (req["caseId"],)).fetchone()[0]}
