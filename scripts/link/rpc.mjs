import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

export function createRpc(caseId) {
  assert.match(caseId || '', /^fixture_[a-z0-9_]{1,64}$/);
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.equal(process.env.RUNNER_OS, 'Linux');
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted');
  return function rpc(op, data = {}, expectCrash = false) {
    const key = process.env.SG_SSH_KEY_FILE, hosts = process.env.SG_SSH_HOSTS_FILE;
    assert(key && hosts && process.env.SG_SSH_HOST);
    const args = ['-T', '-i', key, '-o', 'IdentityAgent=none', '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${hosts}`, '-o', 'ConnectTimeout=20',
      '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', `sgcapture@${process.env.SG_SSH_HOST}`];
    return new Promise((resolve, reject) => {
      const child = spawn('ssh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '', exceeded = false;
      const timeout = setTimeout(() => child.kill('SIGTERM'), 240000);
      child.stdout.on('data', value => { output += value.toString(); if (output.length > 65536) { exceeded = true; child.kill('SIGTERM'); } });
      child.stderr.on('data', () => {});
      child.stdin.on('error', () => {});
      child.on('error', () => { clearTimeout(timeout); reject(Object.assign(new Error('SSH_START_FAILED'), { code: 'SSH_START_FAILED' })); });
      child.on('close', code => {
        clearTimeout(timeout);
        if (expectCrash && code === 91 && !output.trim()) return resolve({ injectedCrash: true });
        if (exceeded) return reject(Object.assign(new Error('RPC_OUTPUT_TOO_LARGE'), { code: 'RPC_OUTPUT_TOO_LARGE' }));
        let result;
        try { result = JSON.parse(output); } catch { return reject(Object.assign(new Error('SSH_RPC_FAILED'), { code: 'SSH_RPC_FAILED' })); }
        if (code !== 0 || !result.ok) return reject(Object.assign(new Error(result.error || 'RPC_FAILED'), { code: result.error || 'RPC_FAILED' }));
        if (expectCrash) return reject(Object.assign(new Error('EXPECTED_CRASH_NOT_OBSERVED'), { code: 'EXPECTED_CRASH_NOT_OBSERVED' }));
        resolve(result);
      });
      child.stdin.end(JSON.stringify({ schema: 'sg-link-fixture-v1', caseId, op, ...data }));
    });
  };
}
