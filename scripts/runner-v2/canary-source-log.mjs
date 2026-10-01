import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';import fs from 'node:fs';

// Read exactly one authenticated, completed source archive. No retry, arbitrary
// URL, shell interpolation, or extraction into the checkout is permitted.
export function loadCanarySourceLog(ended,jobs){
 assert(ended.repository?.full_name==='zyzuoyang/sg-capture-runner'&&ended.status==='completed'&&ended.conclusion==='success'
  &&Number.isSafeInteger(ended.id)&&ended.run_attempt===1&&ended.path==='.github/workflows/trial-300k.yml'
  &&jobs.total_count===jobs.jobs.length&&jobs.jobs.every(j=>j.status==='completed'&&['success','skipped'].includes(j.conclusion))
  &&Array.from({length:20},(_,i)=>'capture-'+i).every(name=>jobs.jobs.filter(j=>j.name===name&&j.conclusion==='success').length===1),
 'CANARY_SOURCE_LOG_IDENTITY');
 const bytes=execFileSync('gh',['api',`repos/zyzuoyang/sg-capture-runner/actions/runs/${ended.id}/attempts/1/logs`],
  {maxBuffer:64*1024**2,timeout:60000,stdio:['ignore','pipe','pipe']});
 assert(bytes.length>0&&bytes.length<=64*1024**2,'CANARY_LOG_ARCHIVE_SIZE');
 fs.mkdirSync('.local',{recursive:true});const path='.local/canary-source-log-private.zip';fs.writeFileSync(path,bytes);
 const script=`import json,sys,zipfile
rows=[]
with zipfile.ZipFile(sys.argv[1]) as z:
 infos=z.infolist()
 assert len(infos)<=2000 and sum(i.file_size for i in infos)<=128*1024*1024
 for info in infos:
  if info.is_dir(): continue
  assert info.file_size<=32*1024*1024
  # Download archives may contain both job aggregates and step files. Read
  # only root job aggregates so one final row cannot be duplicated by layout.
  if '/' in info.filename or not info.filename.endswith('.txt'): continue
  for line in z.read(info).decode('utf-8',errors='strict').splitlines():
   if '"schema":"sg-capture-performance-v1"' not in line and '"schema": "sg-capture-performance-v1"' not in line: continue
   start=line.find('{')
   if start<0: continue
   try: row=json.loads(line[start:])
   except (ValueError,TypeError): continue
   if row.get('schema')=='sg-capture-performance-v1' and row.get('reason')=='final': rows.append(row)
assert len(rows)==40
print(json.dumps(rows))`;
 const rows=JSON.parse(execFileSync('python3',['-c',script,path],{maxBuffer:32*1024**2,timeout:30000,stdio:['ignore','pipe','pipe']}));
 return {rows,logSha256:createHash('sha256').update(bytes).digest('hex')};
}
