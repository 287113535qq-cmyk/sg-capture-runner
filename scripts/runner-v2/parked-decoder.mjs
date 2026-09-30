import {spawn} from 'node:child_process';

// The frozen SQLite decoder runs on the GitHub runner (or in offline tests),
// never on the Mongo gateway. Private bytes travel only over child stdio.
export function decodeParkedArchive({archive,plan,rounds,archiveHash,checkedAt,workerOffset=0,fixedLegacyHash}, {python=process.env.PYTHON||'python3'}={}) {
 return new Promise((resolve,reject)=>{
  const child=spawn(python,['-B','scripts/runner-v2/parked_legacy.py'],{stdio:['pipe','pipe','pipe']});
  const parts=[];let size=0,finished=false;
  const finish=(error,result)=>{if(finished)return;finished=true;clearTimeout(timer);error?reject(new Error(error)):resolve(result);};
  const timer=setTimeout(()=>{finish('PARKED_DECODE_TIMEOUT');child.kill();},120000);
  child.on('error',()=>finish('PARKED_DECODE_UNAVAILABLE'));
  child.stdin.on('error',()=>finish('PARKED_DECODE_FAILED'));
  child.stderr.on('data',()=>{});
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>64*1024**2){finish('PARKED_DECODE_TOO_LARGE');child.kill();}else parts.push(chunk);});
  child.on('close',code=>{try{const response=JSON.parse(Buffer.concat(parts).toString('utf8'));if(code!==0||response.ok!==true)finish('PARKED_DECODE_FAILED');else finish(null,response.result);}catch{finish('PARKED_DECODE_FAILED');}});
  child.stdin.end(JSON.stringify({archive:archive.toString('base64'),plan,rounds,archiveHash,checkedAt,workerOffset,...(fixedLegacyHash?{fixedLegacyHash}:{})}));
 });
}
