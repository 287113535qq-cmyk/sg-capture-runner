import fs from 'node:fs';
import assert from 'node:assert/strict';
import {linuxPreparationTasks} from './runner-v2/preparation-linux-evidence.mjs';
import {sealWorkLineEvidence} from './runner-v2/work-line-sealed-evidence.mjs';
assert(process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_WORKFLOW === 'SG offline preflight'
  && process.env.RUNNER_OS === 'Linux', 'PREPARATION_LINUX_WORKFLOW');
const read = name => JSON.parse(fs.readFileSync(name, 'utf8'));
const origin = {repository: process.env.GITHUB_REPOSITORY, runId: process.env.GITHUB_RUN_ID,
  attempt: process.env.GITHUB_RUN_ATTEMPT, commit: process.env.GITHUB_SHA, workflow: '.github/workflows/preflight.yml'};
const tasks = linuxPreparationTasks({root: process.cwd(), index: read('.local/preparation-feature-index.json'),
  result: read('.local/offline-preflight-result.json'), origin});
const sealed = sealWorkLineEvidence({schema: 'sg-work-line-delivery-v1', origin, tasks, sourceAllowance: 0},
  read('config/work-line-evidence-recipient.json'));
fs.mkdirSync('preparation-sealed', {recursive: true});
fs.writeFileSync('preparation-sealed/evidence.json', JSON.stringify(sealed), {flag: 'wx'});
console.log(JSON.stringify({linuxGates: tasks.length, encrypted: true, sourceRequests: 0, mongoWrites: 0}));
