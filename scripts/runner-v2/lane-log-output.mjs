import {StringDecoder} from 'node:string_decoder';

// One parent writes complete lines from every child. Log failure invalidates
// verification after children drain; it never restarts or interrupts a session.
export function laneLogOutput({write=(line,done)=>process.stdout.write(line,done),maxLineBytes=2*1024**2,maxQueuedBytes=16*1024**2}={}){
 let failed=false,queued=0,tail=Promise.resolve();
 const emit=line=>{
  const bytes=Buffer.byteLength(line);
  if(failed)return;
  if(bytes>maxLineBytes||queued+bytes>maxQueuedBytes){failed=true;return;}
  queued+=bytes;
  tail=tail.then(()=>new Promise(resolve=>{
   try{write(line,error=>{if(error)failed=true;queued-=bytes;resolve();});}
   catch{failed=true;queued-=bytes;resolve();}
  }));
 };
 const attach=stream=>new Promise(resolve=>{
  const decoder=new StringDecoder('utf8');let pending='',discard=false,ended=false;
  const consume=text=>{
   if(discard)return;
   pending+=text;
   for(let end;(end=pending.indexOf('\n'))>=0;){emit(pending.slice(0,end+1));pending=pending.slice(end+1);}
   if(Buffer.byteLength(pending)>maxLineBytes){failed=true;pending='';discard=true;}
  };
  stream.on('data',chunk=>consume(decoder.write(chunk)));
  stream.once('error',()=>{failed=true;});
  const finish=()=>{if(ended)return;ended=true;consume(decoder.end());if(pending)emit(pending+'\n');resolve();};
  stream.once('end',finish);stream.once('close',finish);
 });
 return {attach,async finish(){await tail;return !failed;}};
}
