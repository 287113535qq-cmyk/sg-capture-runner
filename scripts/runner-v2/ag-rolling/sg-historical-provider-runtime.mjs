import {spawn} from 'node:child_process';
import {historicalPreauth} from './sg-historical-labomba-preauth.mjs';
import {historicalChildEnvironment,parseHistoricalPrivateEnvelope} from './sg-historical-private-pipe.mjs';
import {assertHistoricalProviderConfiguration,historicalProviderContext,createHistoricalRecipient} from './sg-historical-provider-channel.mjs';
import {historicalProviderHttps} from './sg-historical-provider-https.mjs';
import {stable} from '../mongo-writer.mjs';

export function historicalActorEnvironment(env){
 const result=historicalChildEnvironment(env);
 for(const key of ['GITHUB_ACTIONS','RUNNER_OS','RUNNER_ENVIRONMENT','GITHUB_REPOSITORY','GITHUB_REF','GITHUB_JOB','GITHUB_RUN_ATTEMPT','GITHUB_RUN_ID','GITHUB_SHA','SG_BUSINESS_LINUX_RUN','SG_BUSINESS_GAME_IDS','PYTHON'])
  if(typeof env[key]==='string')result[key]=env[key];
 result.SG_HISTORICAL_PRIVATE_EVIDENCE_FD='3';return result;
}
export async function executeHistoricalPrivateActor(auth,{env=process.env,start=spawn}={}){
 let child,body,report=[],size=0;
 try{
  body=Buffer.from(JSON.stringify(auth));parseHistoricalPrivateEnvelope(body,env);
  child=start(process.execPath,['scripts/runner-v2/ag-rolling/sg-historical-labomba-job.mjs'],{env:historicalActorEnvironment(env),stdio:['pipe','ignore','ignore','pipe']});
  for(const key of ['password','ghToken','nativeSshPrivateKey','historicalSshPrivateKey'])delete auth[key];
  return await new Promise((resolve,reject)=>{
   let failed=false;
   const stop=()=>{if(failed)return;failed=true;child.kill();reject(Error('HISTORICAL_PRIVATE_ACTOR_STOP_NO_RETRY'));};
   child.once('error',stop);child.stdin.once('error',stop);child.stdio[3].once('error',stop);
   child.stdio[3].on('data',chunk=>{size+=chunk.length;if(size>4*1024*1024){stop();return;}report.push(Buffer.from(chunk));});
   child.once('close',code=>{
    if(failed)return;
    try{const value=Buffer.concat(report),parsed=JSON.parse(value);
     if(![0,2].includes(code)||parsed.complete!==(code===0))throw Error();resolve({exitCode:code,report:value});
    }catch{stop();}
   });
   child.stdin.end(body,()=>{body.fill(0);body=null;});
  });
 }catch{child?.kill();throw Error('HISTORICAL_PRIVATE_ACTOR_STOP_NO_RETRY');}
 finally{body?.fill(0);report.forEach(b=>b.fill(0));for(const key of ['password','ghToken','nativeSshPrivateKey','historicalSshPrivateKey'])delete auth[key];}
}
export async function runHistoricalPrivateProvider({env=process.env,preauth=historicalPreauth,channelFactory=historicalProviderHttps,execute=executeHistoricalPrivateActor,notice=value=>console.log(value)}={}){
 let recipient,channel,evidence;
 try{
  const execution=preauth(env),config=assertHistoricalProviderConfiguration(execution.privateProvider);
  const context=historicalProviderContext(env,execution.manifestSha256);
  recipient=createHistoricalRecipient({context,config});channel=channelFactory(config);
  // This annotation contains an ephemeral public key, nonce and public own-run identity only.
  notice('::notice title=SG_HISTORICAL_PRIVATE_CHALLENGE_V1::'+stable(recipient.challenge));
  const packet=await channel.exchange('credentials',recipient.challenge),auth=recipient.acceptCredentials(packet);
  const result=await execute(auth,{env});evidence=result.report;
  const encrypted=recipient.evidence(evidence);evidence.fill(0);evidence=null;
  recipient.acceptReceipt(await channel.exchange('evidence',encrypted));return result.exitCode;
 }catch{throw Error('HISTORICAL_HOSTED_PRIVATE_PROVIDER_STOP_NO_RETRY');}
 finally{evidence?.fill(0);recipient?.close();channel?.close();}
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/sg-historical-provider-runtime.mjs')){
 try{if(process.argv.length!==2)throw Error();process.exitCode=await runHistoricalPrivateProvider();}
 catch{console.error('HISTORICAL_HOSTED_PRIVATE_PROVIDER_STOP_NO_RETRY');process.exitCode=2;}
}
