"""Batched durable writes, restricted to one isolated database/collection/trial."""
import json
import subprocess
from pathlib import Path
from store import require, Rejected
from trial_store import TRIAL

class TrialMongo:
    def __init__(self, auth_file='/etc/sg-capture-runner/mongo-auth.json'):
        self.auth = json.loads(Path(auth_file).read_text())
        require(self.auth.get('database') == 'sg_capture_staging_v1', 'WRONG_STAGING_DATABASE')

    def call(self, op, data=None):
        prefix = '(async()=>{const cfg=' + json.dumps(self.auth) + ';const input=' + json.dumps({'op':op,'data':data,'trial':TRIAL}) + ';'
        script = prefix + r'''
const target=db.getSiblingDB('sg_capture_staging_v1');
await target.auth(cfg.user,cfg.password);
const c=target.getCollection('official_rounds'), concern={w:'majority',j:true,wtimeout:30000};
let result;
if(input.op==='ensure'){
  await c.createIndex({trialId:1,sequence:1},{unique:true,name:'unique_trial_sequence'});
  result={ready:true};
}else if(input.op==='put'){
  if(!Array.isArray(input.data)||!input.data.length||input.data.length>100)throw Error('BAD_BATCH');
  for(const r of input.data)if(r.trialId!==input.trial||r.gameId!==32471||r.runtimeGameId!==33026||r.fixtureOnly!==false||r.buy!==0||r.bet!==0.25)throw Error('TRIAL_REQUIRED');
  const operations=input.data.map(r=>({updateOne:{filter:{_id:r._id,contentHash:r.contentHash},update:{$setOnInsert:r},upsert:true}}));
  const write=await c.bulkWrite(operations,{ordered:true,writeConcern:concern});
  const read=await target.runCommand({find:'official_rounds',filter:{_id:{$in:input.data.map(r=>r._id)}},limit:100,batchSize:100,singleBatch:true,maxTimeMS:10000});
  if(!read.ok||read.cursor.firstBatch.length!==input.data.length)throw Error('ACK_PARITY');
  function stable(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(stable).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';}
  const expected=new Map(input.data.map(r=>[r._id,stable(r)]));
  for(const r of read.cursor.firstBatch)if(stable(r)!==expected.get(r._id))throw Error('CONTENT_PARITY');
  result={inserted:write.upsertedCount};
}else if(input.op==='summary'){
  const response=await target.runCommand({aggregate:'official_rounds',pipeline:[{$match:{trialId:input.trial}},{$group:{_id:null,count:{$sum:1},stakeRaw:{$sum:'$normalized.money.betRaw'},winRaw:{$sum:'$normalized.money.totalWinRaw'},sourceFrames:{$sum:{$size:'$raw.steps'}},freeRounds:{$sum:{$cond:[{$gt:['$bonus',0]},1,0]}},zeroWinRounds:{$sum:{$cond:[{$eq:['$normalized.money.totalWinRaw',0]},1,0]}},minSequence:{$min:'$sequence'},maxSequence:{$max:'$sequence'}}}],cursor:{batchSize:1},maxTimeMS:120000});
  if(!response.ok)throw Error('SUMMARY_FAILED');
  result=response.cursor.firstBatch[0]||{count:0,stakeRaw:0,winRaw:0,sourceFrames:0,freeRounds:0,zeroWinRounds:0,minSequence:0,maxSequence:0};
  delete result._id;
  if(result.count && (result.minSequence!==1||result.maxSequence!==result.count))throw Error('SEQUENCE_PARITY');
}else throw Error('OP_NOT_ALLOWED');
print('SG_TRIAL_RESULT='+JSON.stringify(result));
})()
'''
        proc = subprocess.run(['docker','exec','-i','mongodb','mongosh','--quiet','--norc','--eval',
            "(async()=>{await eval(require('fs').readFileSync('/dev/stdin','utf8'))})()"], input=script,text=True,capture_output=True,timeout=150)
        lines=[l for l in proc.stdout.splitlines() if l.startswith('SG_TRIAL_RESULT=')]
        require(proc.returncode == 0 and len(lines) == 1, 'TRIAL_MONGO_FAILED')
        return json.loads(lines[0].split('=',1)[1])

    def ensure(self):
        return self.call('ensure')
    def put(self, records):
        return self.call('put',records)['inserted']
    def summary(self):
        return self.call('summary')
