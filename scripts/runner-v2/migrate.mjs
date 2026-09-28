// One-time, fail-closed import. All decoding, normalization, comparisons and
// ownership allocation run on GitHub. No SG config or source calls are used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {stable} from './mongo-writer.mjs';
import {receiptKey} from './durable-queue.mjs';
import {repositories} from '../trial/runner-group.mjs';

const cfg=JSON.parse(fs.readFileSync('config/github-migration-v2.json','utf8'));
const group=repositories[process.env.GITHUB_REPOSITORY]?.name;assert(group);
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+40*60_000});
const directory=fs.mkdtempSync(path.join(process.env.RUNNER_TEMP||os.tmpdir(),'sg-private-migration-'));
fs.chmodSync(directory,0o700);
let child,childDone,result,phase='connect';

async function download(relative,expectedHash,expectedBytes) {
  assert(relative==='queue-before.sqlite3'||/^sg_r1_20260928_\d{5}\/(?:work-pool\.sqlite3|batches\/\d+\/state\.sqlite3)$/.test(relative));
  const filename=path.join(directory,relative);fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});
  const fd=fs.openSync(filename,'wx',0o600),digest=createHash('sha256');let offset=0;
  try {
    do {
      const response=await transport.request('legacy_bytes',{path:relative,offset});
      assert.equal(response.offset,offset);assert.equal(response.size,expectedBytes);
      const bytes=Buffer.from(response.data,'base64');assert(bytes.length>0 && offset+bytes.length<=expectedBytes);
      fs.writeSync(fd,bytes);digest.update(bytes);offset+=bytes.length;
    } while(offset<expectedBytes);
    fs.fsyncSync(fd);
  } finally {fs.closeSync(fd);}
  assert.equal(offset,expectedBytes);assert.equal(digest.digest('hex'),expectedHash);
}

try {
  const hello=await transport.request('hello');assert.equal(hello.group,group);
  const previous=await store.get('state','migration-complete');
  assert(!previous,'MIGRATION_ALREADY_COMPLETE_REVIEW_RECEIPT');
  const manifest=await transport.request('legacy_manifest');
  phase='private-snapshot-transfer';
  assert.equal(manifest.receipt.manifestHash,cfg.manifestHash);
  const files=manifest.files.filter(x=>x.path.endsWith('/state.sqlite3')||x.path.endsWith('/work-pool.sqlite3'));
  await download('queue-before.sqlite3',cfg.queueSha256,cfg.queueBytes);
  let downloaded=0;
  for(const file of files) {
    await download(file.path,file.sha256,file.bytes);downloaded++;
    if(downloaded%100===0)console.log(JSON.stringify({phase:'private-snapshot-transfer',group,files:downloaded,totalFiles:files.length}));
  }
  await store.writable();
  await store.create('state','write-permits',{limit:1,slots:{}},{immutable:true});
  child=spawn('python3',['-B','scripts/runner-v2/prepare_migration.py',directory,group],{stdio:['ignore','pipe','pipe']});
  phase='historical-validation';
  child.stderr.on('data',()=>{});
  childDone=new Promise((resolve,reject)=>{child.on('error',()=>reject(Error('MIGRATION_ANALYZER_FAILED')));child.on('close',code=>resolve(code));});
  const lines=createInterface({input:child.stdout});let verified=0,pendingWrites=0,uncommittedAlreadyPresent=0,importedStates=0;
  for await (const line of lines) {
    const item=JSON.parse(line);
    if(item.kind==='state') {
      await store.create('state',item.key,item.value,{immutable:true});importedStates++;
    } else if(item.kind==='records') {
      const records=item.rows.map(x=>x.record),trialId=records[0].trialId;
      const existing=await transport.request('rounds_read',{trialId,ids:records.map(x=>x._id)});
      const map=new Map(existing.map(x=>[x._id,x]));
      assert.equal(map.size,existing.length);
      for(const {record,committed} of item.rows) {
        const found=map.get(record._id);
        if(found){assert.equal(stable(record),stable(found),'MONGO_LEGACY_CONTENT_MISMATCH');verified++;}
        else assert(!committed,'LEGACY_COMMITTED_RECORD_MISSING');
        if(!committed) {
          await store.create('journal',receiptKey(trialId,record.sequence),record,{immutable:true});
          if(found)uncommittedAlreadyPresent++;else pendingWrites++;
        }
      }
    } else if(item.kind==='summary') {
      result={...item,group,manifestHash:cfg.manifestHash,queueSha256:cfg.queueSha256,
        mongoFullReadback:verified,awaitingMongoInsert:pendingWrites,uncommittedAlreadyPresent,
        importedStates,sourceEnabled:false,officialRoundWrites:0};
    } else throw Error('MIGRATION_EVENT_INVALID');
  }
  assert.equal(await childDone,0,'MIGRATION_VALIDATION_FAILED');assert(result);
  await store.create('state','migration-complete',result,{immutable:true});
  console.log(JSON.stringify(result));
} catch(error) {
  console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(error.code||'')?error.code:'MIGRATION_REVIEW_FAILED',group,phase,
    sourceRequests:0,officialRoundWrites:0,migrationComplete:false}));process.exitCode=2;
} finally {if(child)child.kill();transport.close();}
