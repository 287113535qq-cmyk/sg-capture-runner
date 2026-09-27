"""Persistent bounded Mongo bridge; only the isolated trial collection is reachable."""
import json
import os
import select
import subprocess
import time
from pathlib import Path
from store import require, Rejected
from trial_store import TRIAL

class TrialMongo:
    def __init__(self, auth_file='/etc/sg-capture-runner/mongo-auth.json', sequence_range=None):
        self.auth=json.loads(Path(auth_file).read_text())
        require(self.auth.get('database')=='sg_capture_staging_v1','WRONG_STAGING_DATABASE')
        self.process=None
        self.buffer=b''
        self.sequence_range=sequence_range

    def close(self):
        process=self.process
        self.process=None
        self.buffer=b''
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

    def call(self,op,data=None):
        try:
            if self.process is None:
                script=(Path(__file__).parent/'trial_mongo_worker.js').read_text(encoding='utf-8')
                self.process=subprocess.Popen(['docker','exec','-i','mongodb','mongosh','--quiet','--norc','--eval',script],
                    stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
                self.process.stdin.write(json.dumps(self.auth).encode()+b'\n')
            self.process.stdin.write(json.dumps({'op':op,'data':data,'trial':TRIAL,'sequenceRange':self.sequence_range}).encode()+b'\n')
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

    def ensure(self):return self.call('ensure')
    def put(self,records):return self.call('put',records)['inserted']
    def summary(self):return self.call('summary')
