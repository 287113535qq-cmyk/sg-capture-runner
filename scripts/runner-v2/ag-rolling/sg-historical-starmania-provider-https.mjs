import https from 'node:https';
import {checkServerIdentity} from 'node:tls';
import {X509Certificate,createHash} from 'node:crypto';
import {assertHistoricalProviderConfiguration} from './sg-historical-starmania-provider-channel.mjs';

// An approved fixed private-I/O endpoint only sees a public challenge and encrypted packets.
// There is no authentication environment, redirect, reconnect, retry or disk spool.
export function historicalProviderHttps(config,{request=https.request}={}){
 config=structuredClone(config);
 assertHistoricalProviderConfiguration(config);const used=new Set();let stopped=false;
 const fail=()=>Error('HISTORICAL_PROVIDER_HTTPS_STOP_NO_RETRY');
 return {close(){stopped=true;},exchange(phase,value){
  if(stopped||used.has(phase)||phase!==(used.size===0?'credentials':used.size===1?'evidence':null)){stopped=true;return Promise.reject(fail());}
  used.add(phase);
  return new Promise((resolve,reject)=>{
   let settled=false,req,res,timer,chunks=[],size=0;
   const stop=()=>{if(settled)return;settled=true;stopped=true;clearTimeout(timer);req?.destroy();res?.destroy();chunks.forEach(b=>b.fill(0));chunks=[];reject(fail());};
   try{
    if(phase==='credentials'&&value?.schema!=='sg-historical-private-challenge-v1')throw fail();
    if(phase==='evidence'&&value?.phase!=='evidence')throw fail();
    const body=Buffer.from(JSON.stringify(value));if(body.length>6*1024*1024)throw fail();
    const url=new URL(config.endpoint+'/'+phase);
    req=request(url,{method:'POST',agent:false,rejectUnauthorized:true,headers:{'Content-Type':'application/json','Content-Length':body.length},
     checkServerIdentity(host,cert){const error=checkServerIdentity(host,cert);if(error)return error;
      try{const key=new X509Certificate(cert.raw).publicKey.export({type:'spki',format:'der'});
       if(createHash('sha256').update(key).digest('hex')!==config.tlsSpkiSha256)return fail();
      }catch{return fail();}}
    },response=>{
     res=response;if(res.statusCode!==200||res.headers['content-type']?.split(';')[0]!=='application/json'){stop();return;}
     res.on('data',chunk=>{if(settled)return;size+=chunk.length;if(size>6*1024*1024){stop();return;}chunks.push(Buffer.from(chunk));});
     res.once('aborted',stop);res.once('error',stop);res.once('end',()=>{
      if(settled)return;let all;
      try{all=Buffer.concat(chunks);const result=JSON.parse(all.toString('utf8'));settled=true;clearTimeout(timer);resolve(result);}
      catch{stop();}finally{all?.fill(0);chunks.forEach(b=>b.fill(0));chunks=[];}
     });
    });
    req.once('error',stop);timer=setTimeout(stop,60000);req.end(body,()=>body.fill(0));
   }catch{stop();}
  });
 }};
}
