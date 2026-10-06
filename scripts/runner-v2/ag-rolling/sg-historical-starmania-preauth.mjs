import fs from 'node:fs';import {createHash} from 'node:crypto';
import {assertOwnHistoricalActor} from './sg-historical-starmania-actor.mjs';
import {assertHistoricalSshConfiguration,rejectHistoricalCredentialEnvironment} from './sg-historical-starmania-private-pipe.mjs';
import {assertOwnHistoricalEvidencePipe} from './sg-historical-starmania-evidence.mjs';
export function historicalPreauth(env=process.env){
 const bytes=fs.readFileSync('config/ag-historical-starmania-manifest.json');
 const execution=JSON.parse(fs.readFileSync('config/ag-historical-starmania-execution.json'));
 assertOwnHistoricalActor(env,execution,createHash('sha256').update(bytes).digest('hex'));
 assertOwnHistoricalEvidencePipe({env});assertHistoricalSshConfiguration(execution.ssh);rejectHistoricalCredentialEnvironment(env);return execution;
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/sg-historical-starmania-preauth.mjs')){
 try{historicalPreauth();console.log('HISTORICAL_STATIC_ADMISSION_VERIFIED_PRIVATE_PROVIDER_REQUIRED');}
 catch{console.error('HISTORICAL_PREAUTH_REJECTED_NO_CREDENTIAL_READ');process.exitCode=2;}
}
