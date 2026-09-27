"""Persistent bounded Mongo bridge; only the isolated trial collection is reachable."""
import json
import os
import select
import subprocess
import time
from pathlib import Path
from store import require, Rejected
from trial_store import PLAN

class TrialMongo:
    def __init__(self, auth_file='/etc/sg-capture-runner/mongo-auth.json', sequence_range=None, plan=None, read_only=False):
        if plan is not None:
            from pool_plan import validate_pool_plan
            plan = validate_pool_plan(plan)
        self.plan = PLAN if plan is None else plan
        self.auth=json.loads(Path(auth_file).read_text())
        require(self.auth.get('database')=='sg_capture_staging_v1','WRONG_STAGING_DATABASE')
        self.process=None
        self.buffer=b''
        self.sequence_range=sequence_range
        self.ensured=False
        self.read_only=bool(read_only)

    def close(self):
        process=self.process
        self.process=None
        self.buffer=b''
        self.ensured=False
        if process:
            try:process.stdin.close()
            except OSError:pass
            try:process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill();process.wait(timeout=3)
            process.stdout.close()

    def _line(self):
        deadline=time.monotonic()+150
        while b'\n' not in self.buffer:
            left=deadline-time.monotonic()
            require(left>0 and select.select([self.process.stdout],[],[],left)[0],'TRIAL_MONGO_TIMEOUT')
            chunk=os.read(self.process.stdout.fileno(),65536)
            require(chunk and len(self.buffer)+len(chunk)<=65536,'TRIAL_MONGO_FAILED')
            self.buffer+=chunk
        line,self.buffer=self.buffer.split(b'\n',1)
        return line.decode('utf-8')

    def call(self,op,data=None,sequence_range=None):
        require(not self.read_only or op in {'verify','summary'}, 'AUDIT_MONGO_READ_ONLY')
        try:
            if self.process is None:
                script=(Path(__file__).parent/'trial_mongo_worker.js').read_text(encoding='utf-8')
                self.process=subprocess.Popen(['docker','exec','-i','mongodb','mongosh','--quiet','--norc','--eval',script],
                    stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
                auth={**self.auth,'readOnly':self.read_only,'trialScope':{key:self.plan[key] for key in
                    ('trialId','target','gameId','runtimeGameId','betRaw')}}
                self.process.stdin.write(json.dumps(auth).encode()+b'\n')
            self.process.stdin.write(json.dumps({'op':op,'data':data,'trial':self.plan['trialId'],
                'sequenceRange':sequence_range if sequence_range is not None else self.sequence_range}).encode()+b'\n')
            self.process.stdin.flush()
            for _ in range(10):
                line=self._line()
                if line.startswith('SG_TRIAL_RESULT='):
                    value=json.loads(line.split('=',1)[1])
                    require(value.get('ok') is True,'TRIAL_MONGO_FAILED')
                    return value['result']
            raise Rejected('TRIAL_MONGO_FAILED')
        except Exception:
            self.close()
            raise Rejected('TRIAL_MONGO_FAILED') from None

    def ensure(self):
        if not self.ensured:
            self.call('ensure');self.ensured=True
    def put(self,records):return self.call('put',records)['inserted']
    def verify(self,records):return self.call('verify',records)['verified']
    def summary(self):return self.call('summary')

    def scoped(self, scope):
        parent=self
        class Scope:
            def ensure(self):return parent.ensure()
            def put(self, records):return parent.call('put',records,scope)['inserted']
            def verify(self, records):return parent.call('verify',records,scope)['verified']
            def summary(self):return parent.call('summary',sequence_range=scope)
            def close(self):pass  # The RPC connection owns the shared bridge.
        return Scope()
