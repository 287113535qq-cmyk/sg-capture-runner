import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {verifyAnalyzerPage} from './analyzer-page.mjs';
import {verifyParallelEnvelope} from './analyzer-page-parallel.mjs';

export function analyzer({python='python3',env=process.env,auditWorkers=1}={}) {
  assert([1,2].includes(auditWorkers),'ANALYZER_AUDIT_WORKERS');
  let auditParser;
  const child=spawn(python,['-B','scripts/runner-v2/record_fields.py'],{stdio:['pipe','pipe','pipe'],env});
  let pending=null,buffer=Buffer.alloc(0),closed=false;
  let didClose=false,confirmClose,closing;
  const actualClose=new Promise(resolve=>{confirmClose=resolve;});
  const reject=code=>{if(pending){clearTimeout(pending.timer);pending.reject(Object.assign(new Error(code),{code}));pending=null;}};
  child.stderr.on('data',()=>{});
  child.on('error',()=>{closed=true;reject('ANALYZER_UNAVAILABLE');});
  child.on('close',()=>{closed=true;didClose=true;confirmClose();reject('ANALYZER_CLOSED');});
  child.stdin.on('error',()=>{closed=true;reject('ANALYZER_CLOSED');});
  child.stdout.on('data',chunk=>{
    buffer=Buffer.concat([buffer,chunk]);
    if(buffer.length>16*1024*1024){reject('ANALYZER_RESPONSE_TOO_LARGE');child.kill();return;}
    const end=buffer.indexOf(10);if(end<0)return;
    const line=buffer.subarray(0,end);buffer=buffer.subarray(end+1);
    if(!pending)return;
    let v;try{v=JSON.parse(line);}catch{reject('ANALYZER_BAD_RESPONSE');return;}
    if(!v.ok){reject(v.error);return;}
    const p=pending;pending=null;clearTimeout(p.timer);p.resolve(v.result);
  });
  const api={call(fields){
    assert(!pending && !closed);
    return new Promise((resolve,rejectPromise)=>{
      pending={resolve,reject:rejectPromise,timer:setTimeout(()=>{reject('ANALYZER_TIMEOUT');child.kill();},60_000)};
      child.stdin.write(JSON.stringify(fields)+'\n');
    });
  },verifyPage(plan,records){
    if(auditWorkers===1)return verifyAnalyzerPage(api,plan,records);
    // Capture starts only one process; the second exists solely for full audit.
    auditParser??=analyzer({python,env,auditWorkers:1});
    return verifyAnalyzerPage({call:request=>verifyParallelEnvelope(api,auditParser,request)},plan,records);
  },
  close(){closed=true;reject('ANALYZER_CLOSED');auditParser?.close();child.stdin.end();child.kill();},
  closeAndWait({graceMs=5000,forceMs=5000}={}){
    assert(Number.isSafeInteger(graceMs)&&graceMs>0&&graceMs<=5000
      &&Number.isSafeInteger(forceMs)&&forceMs>0&&forceMs<=5000,'ANALYZER_CLOSE_BUDGET');
    if(closing)return closing;
    closing=(async()=>{
      api.close();
      const wait=async ms=>{let timer;try{return await Promise.race([
        actualClose.then(()=>true),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),ms);})
      ]);}finally{clearTimeout(timer);}};
      const own=(async()=>{if(!didClose&&!await wait(graceMs)){child.kill('SIGKILL');
        assert(await wait(forceMs),'ANALYZER_EXIT_UNCONFIRMED');}
        assert(didClose,'ANALYZER_EXIT_UNCONFIRMED');})();
      const results=await Promise.allSettled([own,auditParser?.closeAndWait({graceMs,forceMs})]);
      const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
      return {childClosed:true,auditChildClosed:true};
    })();return closing;
  }};
  return api;
}
