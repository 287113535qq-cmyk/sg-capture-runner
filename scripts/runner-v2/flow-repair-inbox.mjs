import fs from 'node:fs';
import path from 'node:path';
import {nextRequest} from '../trial/squid-protocol.mjs';
import {veryFruityActionNext, VERYFRUITY_SOURCE} from '../trial/veryfruity-action-protocol.mjs';
import {analyzer} from './analyzer.mjs';
import {offlineAnalysisEnvironment} from './offline-analysis-environment.mjs';
import {reviewFlowRepairTask} from './flow-repair-task.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {publishImmutableInbox} from './work-line-mailbox.mjs';
import {preparationRevision} from './preparation-revision.mjs';
import {preparationReplayEvidence} from './preparation-replay-evidence.mjs';
import {createRequire} from 'node:module';
import {automaticFlowReplay} from './confirmed-flow-evidence.mjs';
let prepareFields, veryFields;
function independentFields(root, raw, plan, fields) {
  if (!prepareFields) {
    const require=createRequire(import.meta.url);
    require(path.join(root,'collector/node_modules/ts-node')).register({project:path.join(root,'collector/tsconfig.json'),transpileOnly:true});
    prepareFields=require(path.join(root,'collector/sg.ingest.ts')).prepareNextgenRound;
    veryFields=require(path.join(root,'collector/sg.veryfruity-action.ts')).veryFruityActionFields;
  }
  return raw.sourceKey===VERYFRUITY_SOURCE ? veryFields(raw,plan) : prepareFields(raw,
    {buy:fields.buy,bonus:fields.bonus,typeMappingHash:fields.typeMappingHash});
}

// Fixed local adapters; mailbox values never choose code, commands or profiles.
// One bounded review per tick leaves normal preparation and admission running.
export async function reviewFlowRepairInbox(root, index, python) {
  const base = path.join(root, '.local/preparation-worker/repair');
  const inbox = path.join(base, 'evidence-inbox'), results = path.join(base, 'flow-results');
  fs.mkdirSync(inbox, {recursive: true}); fs.mkdirSync(results, {recursive: true});
  for (const name of fs.readdirSync(inbox).filter(n => /^[a-f0-9]{64}\.json$/.test(n))) {
    let task, revisionHash, preparationHash;
    try {
      task = JSON.parse(fs.readFileSync(path.join(inbox, name), 'utf8'));
      if (hash(task) + '.json' !== name) throw Error('FLOW_REPAIR_INBOX_CHANGED');
      const revision = preparationRevision(root, task.gameId, index.games.find(g => g.gameId === task.gameId));
      if (!revision.handler) continue;
      preparationHash=revision.revisionHash;
      const inventory=JSON.parse(fs.readFileSync(path.join(base,'inventory.json'),'utf8'));
      const replay=automaticFlowReplay(root,task,inventory.tasks.find(t=>t.gameId===task.gameId),preparationHash);
      if(replay)task=replay;
      // Immutable historical input is re-evaluated under changed code, rather
      // than requiring another server export of the same original bytes.
      // Gates bind the evaluated revision; retain the original task identity.
      if(task.schema==='sg-preparation-replay-task-v1'&&task.revisionHash!==preparationHash){
        if(!/^[a-f0-9]{64}$/.test(task.revisionHash))throw Error('PREPARATION_REPLAY_REVISION');
        task={...task,retainedTaskHash:hash(task),retainedEvidenceRevision:task.revisionHash,revisionHash:preparationHash};
      }
      revisionHash = hash([revision.revisionHash, fs.readFileSync(new URL('./flow-repair-task.mjs', import.meta.url), 'utf8'),
        fs.readFileSync(new URL('./flow-repair-inbox.mjs', import.meta.url), 'utf8'),
        fs.readFileSync(new URL('./preparation-replay-evidence.mjs', import.meta.url), 'utf8'),
        fs.readFileSync(new URL('./offline-analysis-environment.mjs', import.meta.url), 'utf8'),
        fs.readFileSync(new URL('./confirmed-flow-evidence.mjs', import.meta.url), 'utf8'),hash(task)]);
    } catch {continue;}
    const id = hash([name, revisionHash]), file = path.join(results, id + '.json');
    if (fs.existsSync(file) || fs.existsSync(file + '.claim')) continue;
    const claim = fs.openSync(file + '.claim', 'wx');
    try {fs.writeFileSync(claim, JSON.stringify({pid: process.pid, evidence: name, revisionHash})); fs.fsyncSync(claim);}
    finally {fs.closeSync(claim);}
    let parser, result;
    try {
      const replay=task.schema==='sg-preparation-replay-task-v1';
      if(replay){
        const inventory=JSON.parse(fs.readFileSync(path.join(base,'inventory.json'),'utf8'));
        const current=inventory.tasks.find(t=>t.gameId===task.gameId);
        if(current?.lane==='repair'&&!(task.faults?.length>0))throw Error('PREPARATION_REPLAY_FAILURE_REQUIRED');
        if(current?.failureEvidenceHash!==task.failureEvidenceHash)throw Error('PREPARATION_REPLAY_FAILURE_CHANGED');
      }
      parser = analyzer({python, env: offlineAnalysisEnvironment(root, replay?task.plan:task.evidence.plan)});
      const runnerNext=(raw,plan)=>raw.sourceKey===VERYFRUITY_SOURCE ? veryFruityActionNext(plan,raw) : nextRequest(raw);
      result = replay ? await preparationReplayEvidence({task,revisionHash:preparationHash,parser,runnerNext,
        independentFields:(raw,plan,fields)=>independentFields(root,raw,plan,fields)})
        : await reviewFlowRepairTask({task, parser, runnerNext});
      if(replay) {
        const inventory=JSON.parse(fs.readFileSync(path.join(base,'inventory.json'),'utf8'));
        const current=inventory.tasks.find(t=>t.gameId===task.gameId);
        if(current?.lane==='repair'&&!current.failureEvidenceHash){
          result={...result,receipts:[],status:'replay-reviewed-requires-current-fault-receipt'};
        }else{
          for(const receipt of result.receipts)publishImmutableInbox(path.join(root,'.local/preparation-worker/evidence',String(task.gameId)),receipt);
          result={...result,status:'flow-settlement-persistence-replay-verified'};
        }
      }
    } catch (error) {
      result = {schema: 'sg-flow-repair-review-v1', gameId: task.gameId, evidenceHash: task.evidenceHash??hash(task),
        status: 'flow-repair-requires-adapter', reason: /^[A-Z_]{1,80}$/.test(error.message) ? error.message : 'FLOW_REPAIR_VALIDATION_FAILED',
        prepared: false, sourceAllowance: 0, sourceRequests: 0, replayAllowed: false};
    } finally {parser?.close();}
    const out = {...result, revisionHash};
    const saved = publishImmutableInbox(results, out);
    const fd = fs.openSync(file, 'wx');
    try {fs.writeFileSync(fd, JSON.stringify({schema: 'sg-flow-repair-consumption-v1', taskHash: name.slice(0,-5),
      resultHash: saved, revisionHash, sourceRequests: 0})); fs.fsyncSync(fd);}
    finally {fs.closeSync(fd);}
    return {gameId: task.gameId, status: out.status, reason: out.reason ?? null, sourceRequests: 0};
  }
  return null;
}
