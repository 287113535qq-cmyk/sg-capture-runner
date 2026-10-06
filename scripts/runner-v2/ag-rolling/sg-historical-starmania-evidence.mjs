import assert from 'node:assert/strict';import fs from 'node:fs';
export function assertOwnHistoricalEvidencePipe({env=process.env,io=fs,platform=process.platform,euid=()=>process.geteuid()}={}){
 assert(platform==='linux'&&env.SG_HISTORICAL_PRIVATE_EVIDENCE_FD==='3','HISTORICAL_PRIVATE_EVIDENCE_PIPE_REQUIRED');
 const uid=euid(),identities=[];
 for(const fd of [0,3]){
  const s=io.fstatSync(fd);assert(s.isFIFO()&&s.uid===uid&&(s.mode&0o777)===0o600,'HISTORICAL_PRIVATE_EVIDENCE_PIPE_REQUIRED');
  assert(io.readlinkSync('/proc/self/fd/'+fd)==='pipe:['+s.ino+']','HISTORICAL_PRIVATE_EVIDENCE_PIPE_REQUIRED');
  const info=io.readFileSync('/proc/self/fdinfo/'+fd,'utf8');
  const ino=info.match(/^ino:\s*(\d+)$/m),flags=info.match(/^flags:\s*([0-7]+)$/m);
  assert(ino&&String(s.ino)===ino[1]&&flags&&(parseInt(flags[1],8)&3)===(fd===0?0:1),'HISTORICAL_PRIVATE_EVIDENCE_PIPE_REQUIRED');
  identities.push(String(s.dev)+':'+s.ino);
 }
 assert(new Set(identities).size===2,'HISTORICAL_PRIVATE_EVIDENCE_PIPE_REQUIRED');
}
function writeEvidence(report,{env=process.env,io=fs,...metadata}={}){
 assertOwnHistoricalEvidencePipe({env,io,...metadata});
 assert(report?.schema==='sg-historical-starmania-run-v1'&&report.owner===env.GITHUB_RUN_ID+':1:historical-32737'
  &&report.commit===env.GITHUB_SHA&&report.sourceRequests===0&&report.nativeWrites===0
  &&typeof report.complete==='boolean'&&report.linuxProof?.commit===env.GITHUB_SHA
  &&(!report.complete||(report.result?.gameId===32737&&report.result.database==='sg_starmania'
   &&report.result.trialId==='sg_r1_20260928_32737')),'HISTORICAL_PRIVATE_EVIDENCE_IDENTITY');
 const bytes=Buffer.from(JSON.stringify(report)+'\n');
 try{assert(bytes.length<=4*1024*1024,'HISTORICAL_PRIVATE_EVIDENCE_SIZE');
  assert(io.writeSync(3,bytes)===bytes.length,'HISTORICAL_PRIVATE_EVIDENCE_WRITE_UNKNOWN_NO_RETRY');
 }finally{bytes.fill(0);}
}
export function createOwnHistoricalPrivateEvidenceWriter(options){
 let consumed=false;return report=>{assert(!consumed,'HISTORICAL_PRIVATE_EVIDENCE_CONSUMED_NO_RETRY');consumed=true;return writeEvidence(report,options);};
}
export const writeOwnHistoricalPrivateEvidence=createOwnHistoricalPrivateEvidenceWriter();
