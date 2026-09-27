import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
export function connect(plan) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.equal(process.env.RUNNER_OS, 'Linux');
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted');
  const key = process.env.SG_SSH_KEY_FILE, hosts = process.env.SG_SSH_HOSTS_FILE;
  assert(key && hosts && process.env.SG_SSH_HOST);
  const child = spawn('ssh', ['-T','-i',key,'-o','IdentityAgent=none','-o','IdentitiesOnly=yes','-o','BatchMode=yes',
    '-o','StrictHostKeyChecking=yes','-o',`UserKnownHostsFile=${hosts}`,'-o','ConnectTimeout=20',
    '-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3',`sgcapture@${process.env.SG_SSH_HOST}`],
    { stdio:['pipe','pipe','pipe'] });
  let current = null, closed = false;
  function reject(code) {
    if (current) { clearTimeout(current.timer); current.reject(Object.assign(new Error(code), {code})); current = null; }
  }
  child.stderr.on('data', () => {});
  child.stdin.on('error', () => { closed = true; reject('TRIAL_SSH_FAILED'); });
  child.on('error', () => { closed = true; reject('TRIAL_SSH_FAILED'); });
  child.on('close', () => { closed = true; reject('TRIAL_SSH_CLOSED'); });
  const lines = createInterface({input:child.stdout});
  lines.on('line', line => {
    if (!current) return;
    let response;
    try { if (line.length > 1048576) throw Error(); response = JSON.parse(line); }
    catch { reject('TRIAL_RPC_INVALID'); return; }
    if (!response.ok) { reject(/^[A-Z_]{1,80}$/.test(response.error || '') ? response.error : 'TRIAL_RPC_REJECTED'); return; }
    const pending = current; current = null; clearTimeout(pending.timer); pending.resolve(response);
  });
  return {
    rpc(op, data = {}) {
      assert(!current, 'Concurrent trial RPC forbidden');
      if (closed) return Promise.reject(Object.assign(new Error('TRIAL_SSH_CLOSED'), {code:'TRIAL_SSH_CLOSED'}));
      return new Promise((resolve, rejectPromise) => {
        current = {resolve, reject:rejectPromise, timer:setTimeout(() => { reject('TRIAL_RPC_TIMEOUT'); child.kill(); }, op === 'audit' ? 600000 : 180000)};
        child.stdin.write(JSON.stringify({schema:plan.schema,trialId:plan.trialId,op,...data})+'\n');
      });
    },
    close() { child.stdin.end(); lines.close(); child.kill(); },
  };
}
