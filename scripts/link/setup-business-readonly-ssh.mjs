import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {queueProfile} from '../runner-v2/ag-rolling/sg-queue-profile.mjs';
import {inspectExistingWorkflowPolicy} from '../runner-v2/ag-rolling/sg-ag-existing-workflow.mjs';
import {verifyOwnStrictLinux} from '../runner-v2/ag-rolling/sg-ag-ordinary-linux.mjs';

assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_OS==='Linux'&&process.env.RUNNER_ENVIRONMENT==='github-hosted'
 &&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner'&&process.env.GITHUB_REF==='refs/heads/main'
 &&(process.env.GITHUB_JOB==='ag-rolling-finalize'||process.env.GITHUB_JOB==='ag-rolling-capture'&&process.env.SG_AG_LANE==='20'),'SG_AG_EXISTING_HASH_IDENTITY');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8')),name=process.env.SG_AG_QUEUE_PROFILE;
const profile=queueProfile({name,profile:read('config/'+name),authorization:read('config/ag-rolling-authorizations.json'),plans:read('config/ag-rolling-plans.json'),readBytes:file=>fs.readFileSync(file)});
const policy=inspectExistingWorkflowPolicy(profile),bytes=fs.readFileSync(policy.linuxEvidenceFile);
assert(createHash('sha256').update(bytes).digest('hex')===policy.linuxEvidenceSha256,'SG_AG_EXISTING_HASH_LINUX_BYTES');
verifyOwnStrictLinux(JSON.parse(bytes),profile.codeCommit,process.cwd());
assert(process.env.SG_BUSINESS_SSH_PRIVATE_KEY,'SG_AG_EXISTING_HASH_CONFIGURATION');
// Use the already approved hash-only sgdelivery key and the same temporary
// file route as the existing ordinary writer. No account or SSH scope changes.
const dir=fs.mkdtempSync(path.join(process.env.RUNNER_TEMP||os.tmpdir(),'sg-business-readonly-'));fs.chmodSync(dir,0o700);
const file=path.join(dir,'identity');fs.writeFileSync(file,process.env.SG_BUSINESS_SSH_PRIVATE_KEY.replace(/\r/g,'').trimEnd()+'\n',{flag:'wx',mode:0o600});
fs.appendFileSync(process.env.GITHUB_ENV,'SG_BUSINESS_SSH_KEY_FILE='+file+'\n');
console.log('Fixed configuration hash reader configured');
