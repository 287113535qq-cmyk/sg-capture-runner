import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';import {extractCanaryLog,loadCanarySourceLog} from './canary-source-log.mjs';
const python=process.env.PYTHON||'python3';
function fixture(mode,lanes=2){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sg-canary-log-')),file=path.join(dir,'fixture.zip');
 const script=`import json,sys,zipfile,warnings
warnings.simplefilter('ignore')
with zipfile.ZipFile(sys.argv[1],'w',compression=zipfile.ZIP_DEFLATED) as z:
 for host in range(20):
  lines=[]
  for lane in range(int(sys.argv[3])):
   row={'schema':'sg-capture-performance-v1','reason':'final','worker':host+40*lane,'fixture':'x'*150000}
   if sys.argv[2]=='missing' and host==19 and lane==int(sys.argv[3])-1: continue
   lines.append('2026-10-01T00:00:00Z '+json.dumps(row))
  content='\\n'.join(lines)+'\\n'
  name=str(host+1)+'_capture-'+str(host)+'.txt'
  z.writestr(name,content);z.writestr('capture-'+str(host)+'/1_Capture.txt',content)
  if sys.argv[2]=='duplicate' and host==0: z.writestr(name,content)
 if sys.argv[2]=='malformed': z.writestr('0_verify.txt','{"schema":"sg-capture-performance-v1",BROKEN')
`;
 execFileSync(python,['-c',script,file,mode,String(lanes)]);return {file,close(){fs.unlinkSync(file);fs.rmdirSync(dir);}};
}
test('real ZIP aggregates retain forty large observations without duplicated step files',()=>{
 const f=fixture('valid');try{const rows=extractCanaryLog(f.file,{python});assert.equal(rows.length,40);
 assert.equal(new Set(rows.map(row=>row.worker)).size,40);assert(rows.every(row=>row.fixture.length===150000));}finally{f.close();}
});
for(const mode of ['missing','duplicate','malformed'])test(`reject ${mode} final archive`,()=>{
 const f=fixture(mode);try{assert.throws(()=>extractCanaryLog(f.file,{python}));}finally{f.close();}
});
test('running or unbound source archives cannot be downloaded',()=>{
 assert.throws(()=>loadCanarySourceLog({status:'in_progress'},{}),/CANARY_SOURCE_LOG_IDENTITY/);
});

test('four-session ZIP preserves eighty unique large final rows and rejects wrong layout size',()=>{
 const f=fixture('valid',4);try{const rows=extractCanaryLog(f.file,{python,expectedCount:80});
 assert.equal(rows.length,80);assert.equal(new Set(rows.map(row=>row.worker)).size,80);
 assert.throws(()=>extractCanaryLog(f.file,{python}));
 assert.throws(()=>extractCanaryLog(f.file,{python,expectedCount:60}),/CANARY_LOG_ROW_COUNT/);
 }finally{f.close();}
});

test('single-lane offline diagnostics require all twenty finals and keep download scope unchanged',()=>{
 for(const mode of ['valid','missing','duplicate','malformed']){
  const f=fixture(mode,1);try{
   if(mode==='valid')assert.equal(extractCanaryLog(f.file,{python,expectedCount:20}).length,20);
   else assert.throws(()=>extractCanaryLog(f.file,{python,expectedCount:20}));
  }finally{f.close();}
 }
 assert.throws(()=>loadCanarySourceLog({}, {}, {expectedCount:20}),/CANARY_LOG_ROW_COUNT/);
});
