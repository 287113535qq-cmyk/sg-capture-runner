// Fixed mongosh program: credentials and documents arrive only over stdin.
(async () => {
  const fs = require('fs');
  // mongosh configures fd 0 as nonblocking. Open a separate blocking handle
  // so an idle period between batches is not mistaken for an input failure.
  const inputFd = fs.openSync('/dev/stdin', 'r');
  let buffered = Buffer.alloc(0);
  function line() {
    while (true) {
      const end = buffered.indexOf(10);
      if (end >= 0) {
        const value = buffered.subarray(0, end).toString('utf8');
        buffered = buffered.subarray(end + 1);
        return value;
      }
      const chunk = Buffer.alloc(65536), count = fs.readSync(inputFd, chunk, 0, chunk.length);
      if (!count) { if (buffered.length) throw Error('PARTIAL_INPUT'); return null; }
      buffered = Buffer.concat([buffered, chunk.subarray(0, count)]);
      if (buffered.length > 33554432) throw Error('INPUT_TOO_LARGE');
    }
  }
  const cfg = JSON.parse(line());
  if (cfg.database !== 'sg_capture_staging_v1') throw Error('WRONG_DATABASE');
  const scope = cfg.trialScope || {trialId:'bookofsevens_300k_20260927',target:300000};
  if (!/^(bookofsevens_[a-z0-9_]{1,70}|sg_r1_20260928_[0-9]{5})$/.test(scope.trialId) || !Number.isSafeInteger(scope.target)
      || scope.target < 20 || scope.target > 300000) throw Error('WRONG_TRIAL_SCOPE');
  const target = db.getSiblingDB('sg_capture_staging_v1');
  await target.auth(cfg.user, cfg.password);
  const c = target.getCollection('official_rounds'), concern = {w:'majority',j:true,wtimeout:30000};
  function stable(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    return '{' + Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',') + '}';
  }
  let value;
  while ((value = line()) !== null) {
    try {
      const input = JSON.parse(value);
      if (cfg.readOnly === true && !['verify','summary'].includes(input.op)) throw Error('AUDIT_READ_ONLY');
      if (input.trial !== scope.trialId) throw Error('WRONG_TRIAL');
      const range=input.sequenceRange || [1,scope.target];
      if (!Array.isArray(range) || range.length!==2 || !range.every(Number.isSafeInteger) || range[0]<1 || range[1]>scope.target || range[0]>range[1]) throw Error('BAD_RANGE');
      let result;
      if (input.op === 'ensure') {
        await c.createIndex({trialId:1,sequence:1},{unique:true,name:'unique_trial_sequence'});
        result = {ready:true};
      } else if (input.op === 'put' || input.op === 'verify') {
        if (!Array.isArray(input.data) || !input.data.length || input.data.length > 100) throw Error('BAD_BATCH');
        for (const r of input.data) if (r.trialId!==input.trial || r.gameId!==(scope.gameId??32471) || r.runtimeGameId!==(scope.runtimeGameId??33026) || r.fixtureOnly!==false || r.buy!==0 || r.bet!==(scope.betRaw??25)/100 || !Number.isSafeInteger(r.sequence) || r.sequence<range[0] || r.sequence>range[1]) throw Error('TRIAL_REQUIRED');
        let inserted = 0;
        if (input.op === 'put') {
          const operations = input.data.map(r=>({updateOne:{filter:{_id:r._id,contentHash:r.contentHash},update:{$setOnInsert:r},upsert:true}}));
          inserted = (await c.bulkWrite(operations,{ordered:true,writeConcern:concern})).upsertedCount;
        }
        const read = await target.runCommand({find:'official_rounds',filter:{_id:{$in:input.data.map(r=>r._id)}},limit:100,batchSize:100,singleBatch:true,maxTimeMS:10000});
        if (!read.ok || read.cursor.firstBatch.length!==input.data.length) throw Error('ACK_PARITY');
        const expected = new Map(input.data.map(r=>[r._id,stable(r)]));
        for (const r of read.cursor.firstBatch) if (stable(r)!==expected.get(r._id)) throw Error('CONTENT_PARITY');
        result = {inserted,verified:input.data.length};
      } else if (input.op === 'summary') {
        const response = await target.runCommand({aggregate:'official_rounds',pipeline:[{$match:{trialId:input.trial,sequence:{$gte:range[0],$lte:range[1]}}},{$group:{_id:null,count:{$sum:1},stakeRaw:{$sum:'$normalized.money.betRaw'},winRaw:{$sum:'$normalized.money.totalWinRaw'},sourceFrames:{$sum:{$size:'$raw.steps'}},freeRounds:{$sum:{$cond:[{$gt:['$bonus',0]},1,0]}},zeroWinRounds:{$sum:{$cond:[{$eq:['$normalized.money.totalWinRaw',0]},1,0]}},minSequence:{$min:'$sequence'},maxSequence:{$max:'$sequence'}}}],cursor:{batchSize:1},maxTimeMS:120000});
        if (!response.ok) throw Error('SUMMARY_FAILED');
        result = response.cursor.firstBatch[0] || {count:0,stakeRaw:0,winRaw:0,sourceFrames:0,freeRounds:0,zeroWinRounds:0,minSequence:0,maxSequence:0};
        delete result._id;
        if (result.count && (result.minSequence!==range[0] || result.maxSequence!==range[0]+result.count-1)) throw Error('SEQUENCE_PARITY');
      } else throw Error('OP_NOT_ALLOWED');
      print('SG_TRIAL_RESULT='+JSON.stringify({ok:true,result}));
    } catch {
      print('SG_TRIAL_RESULT='+JSON.stringify({ok:false,error:'TRIAL_MONGO_FAILED'}));
    }
  }
})().catch(()=>{print('SG_TRIAL_RESULT='+JSON.stringify({ok:false,error:'TRIAL_MONGO_FAILED'}));});
