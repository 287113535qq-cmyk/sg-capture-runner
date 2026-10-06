import assert from 'node:assert/strict';
// One foreground SSH connection and one outstanding native request. It uses
// the original protocol; unknown output/ACK permanently closes this channel.
export function connectOrdinaryMemoryGateway(identity,{timeoutMs=60000}={}){
 const child=identity.open('');let pending=null,closed=false,buffer=Buffer.alloc(0);
 const stop=()=>{closed=true;if(pending){clearTimeout(pending.timer);pending.reject(Object.assign(Error('SG_AG_ORDINARY_NATIVE_UNKNOWN_NO_RETRY'),{outcomeUnknown:true}));pending=null;}};
 const poison=()=>{stop();child.kill();};
 child.on('error',poison);child.on('close',stop);child.stdin.on('error',poison);child.stderr.on('data',()=>{});
 child.stdout.on('data',part=>{
  buffer=Buffer.concat([buffer,part]);if(buffer.length>16*1024*1024){poison();return;}const end=buffer.indexOf(10);if(end<0)return;
  const line=buffer.subarray(0,end);buffer=buffer.subarray(end+1);if(!pending||buffer.length){poison();return;}
  try{const response=JSON.parse(line);assert(response.ok===true&&Object.hasOwn(response,'result'));const p=pending;pending=null;clearTimeout(p.timer);p.resolve(response.result);}catch{poison();}
 });
 return {request(op,fields={}){
  assert(!closed&&!pending&&typeof op==='string'&&!Object.hasOwn(fields,'op')&&!Object.hasOwn(fields,'schema'),'SG_AG_ORDINARY_NATIVE_CONSUMED');
  const bytes=Buffer.from(JSON.stringify({schema:'sg-mongo-only-v2',op,...fields})+'\n');assert(bytes.length<=8*1024*1024);
  return new Promise((resolve,reject)=>{pending={resolve,reject,timer:setTimeout(poison,timeoutMs)};child.stdin.write(bytes,()=>bytes.fill(0));});
 },close(){stop();child.stdin.end();child.kill();}};
}
