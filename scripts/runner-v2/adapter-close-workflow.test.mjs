import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('adapter mode is passed to the actual close process and never the SSH setup',()=>{
 const text=fs.readFileSync('.github/workflows/demo-maintenance.yml','utf8').replace(/\r\n/g,'\n');
 const job=text.split('\n  pyramids-counter-close:\n')[1]?.split('\n  count-shared-close:\n')[0];
 assert(job&&job.includes("inputs.operation == 'close-pyramids-adapter'"));
 const steps=job.split('\n      - name: ');
 const setup=steps.find(s=>s.startsWith('Configure restricted database transport'));
 const close=steps.find(s=>s.startsWith('Settle reviewed shared stop without source requests'));
 assert(setup&&!setup.includes('SG_ADAPTER_CLOSE_MODE'));
 assert(close?.includes('run: node scripts/runner-v2/pyramids-counter-close-control.mjs\n        env:\n          SG_ADAPTER_CLOSE_MODE:'));
 assert(close.includes("inputs.operation == 'close-pyramids-adapter' && 'super-hold-prefix' || ''"));
 assert.equal(text.match(/SG_ADAPTER_CLOSE_MODE:/g)?.length,1);
});
