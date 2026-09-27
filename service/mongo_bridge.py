"""Private Mongo bridge: a fixed staging DB, fixed collections, no game-pool access."""
import json
import subprocess
from pathlib import Path
from store import Rejected

DATABASE = 'sg_capture_staging_v1'

class MongoBridge:
    def __init__(self, auth_file='/etc/sg-capture-runner/mongo-auth.json'):
        self.auth = json.loads(Path(auth_file).read_text())
        if self.auth.get('database') != DATABASE:
            raise Rejected('WRONG_STAGING_DATABASE')

    def call(self, operation, data=None):
        payload = {'operation': operation, 'data': data}
        script = "(async()=>{const cfg=" + json.dumps(self.auth) + ";const target=db.getSiblingDB(" + json.dumps(DATABASE) + ");"
        script += "await target.auth(cfg.user,cfg.password);const input=" + json.dumps(payload) + ";\n"
        script += r'''
const allowed = new Set(['ensure','upsert','records','accepted','promote']);
if (!allowed.has(input.operation)) throw Error('OP_NOT_ALLOWED');
const rounds = target.getCollection('rounds');
const accepted = target.getCollection('accepted_rounds');
const concern = {w:'majority',j:true,wtimeout:20000};
async function put(collection, record) {
  if (record.fixtureOnly !== true || !/^fixture_/.test(record.caseId) || !/^fixture-/.test(record.gameId)) throw Error('FIXTURE_REQUIRED');
  const existing = await collection.findOne({_id:record._id});
  if (existing) {
    if (existing.contentHash !== record.contentHash) throw Error('IDENTITY_CONFLICT');
    return 0;
  }
  await collection.insertOne(record, {writeConcern:concern});
  return 1;
}
let result;
if (input.operation === 'ensure') {
  for (const collection of [rounds,accepted]) {
    await collection.createIndex({caseId:1,gameId:1,sourceRoundId:1},{unique:true,name:'unique_round_identity'});
    await collection.createIndex({caseId:1,gameId:1,sequence:1},{unique:true,name:'unique_game_sequence'});
  }
  result = {ready:true};
} else if (input.operation === 'upsert') {
  result = {inserted:await put(rounds,input.data)};
} else if (input.operation === 'records' || input.operation === 'accepted') {
  if (!/^fixture_[a-z0-9_]{1,64}$/.test(input.data)) throw Error('FIXTURE_REQUIRED');
  const response = await target.runCommand({find:input.operation === 'records' ? 'rounds' : 'accepted_rounds',
    filter:{caseId:input.data},limit:106,batchSize:106,singleBatch:true,maxTimeMS:5000});
  if (!response.ok || !response.cursor) throw Error('BOUNDED_READ_FAILED');
  result = response.cursor.firstBatch;
} else {
  let inserted = 0;
  for (const record of input.data) inserted += await put(accepted,record);
  result = {inserted};
}
print('SG_RPC_RESULT='+JSON.stringify(result));
})()
'''
        proc = subprocess.run(['docker','exec','-i','mongodb','mongosh','--quiet','--norc','--eval',
                               "(async()=>{await eval(require('fs').readFileSync('/dev/stdin','utf8'))})()"],
                              input=script, text=True, capture_output=True, timeout=45)
        lines = [line for line in proc.stdout.splitlines() if line.startswith('SG_RPC_RESULT=')]
        if proc.returncode or len(lines) != 1:
            raise Rejected('MONGO_OPERATION_FAILED')
        return json.loads(lines[0].split('=',1)[1])

    def ensure(self):
        self.call('ensure')

    def upsert(self, record):
        return self.call('upsert',record)['inserted']

    def records(self, case, accepted=False):
        return self.call('accepted' if accepted else 'records',case)

    def promote(self, records):
        return self.call('promote',records)['inserted']
