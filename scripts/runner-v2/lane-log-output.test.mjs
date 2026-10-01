import test from 'node:test';import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {PassThrough} from 'node:stream';
import {laneLogOutput} from './lane-log-output.mjs';

for(const lanes of [2,4])test(`${lanes} real children retain large fragmented final lines and stderr`,async()=>{
 const lines=[];const logs=laneLogOutput({write:(line,done)=>setImmediate(()=>{lines.push(line);done();})});
 const script=`const row=JSON.stringify({lane:process.argv[1],text:'轮'.repeat(50000)});let i=0;
 function send(){if(i>=row.length){process.stdout.write('\\n');process.stderr.write(JSON.stringify({diagnostic:process.argv[1]})+'\\n');return;}
 process.stdout.write(row.slice(i,i+997));i+=997;setImmediate(send);}send();`;
 await Promise.all(Array.from({length:lanes},(_,lane)=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['-e',script,String(lane)],{stdio:['ignore','pipe','pipe']});
  const drained=Promise.all([logs.attach(child.stdout),logs.attach(child.stderr)]);
  child.on('error',reject);child.on('close',code=>{if(code!==0)reject(new Error('child'));else drained.then(resolve);});
 })));
 assert.equal(await logs.finish(),true);assert.equal(lines.length,lanes*2);
 const rows=lines.map(line=>JSON.parse(line));assert.equal(new Set(rows.filter(r=>r.text).map(r=>r.lane)).size,lanes);
 assert(rows.filter(r=>r.text).every(r=>r.text==='轮'.repeat(50000)));
});
test('oversized output invalidates proof while input continues draining',async()=>{
 const stream=new PassThrough(),logs=laneLogOutput({maxLineBytes:16,write:(_line,done)=>done()});
 const drain=logs.attach(stream);stream.write('x'.repeat(32));stream.end('still drains\n');await drain;
 assert.equal(await logs.finish(),false);
});
test('output error invalidates proof and all child streams still drain',async()=>{
 const stream=new PassThrough(),logs=laneLogOutput({write:(_line,done)=>done(new Error('fixture'))});
 const drain=logs.attach(stream);stream.end('one\ntwo\n');await drain;assert.equal(await logs.finish(),false);
});
