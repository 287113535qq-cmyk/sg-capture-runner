import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_OS==='Linux'&&process.env.RUNNER_ENVIRONMENT==='github-hosted'
 &&process.env.GITHUB_REF==='refs/heads/sg-business-delivery-20261005'&&process.env.SG_BUSINESS_SSH_PRIVATE_KEY);
const dir=fs.mkdtempSync(path.join(process.env.RUNNER_TEMP||os.tmpdir(),'sg-business-readonly-'));fs.chmodSync(dir,0o700);
const file=path.join(dir,'identity');fs.writeFileSync(file,process.env.SG_BUSINESS_SSH_PRIVATE_KEY.replace(/\r/g,'').trimEnd()+'\n',{flag:'wx',mode:0o600});
fs.appendFileSync(process.env.GITHUB_ENV,'SG_BUSINESS_SSH_KEY_FILE='+file+'\n');console.log('Fixed configuration hash reader configured');
