import assert from 'node:assert/strict';
import {stable} from '../mongo-writer.mjs';
import {assertOwnHistoricalGrant} from './sg-historical-starmania-actor.mjs';
import {assertHistoricalProviderConfiguration,assertHistoricalProviderChallenge,historicalChallengeHash} from './sg-historical-starmania-provider-channel.mjs';
const capabilities=new WeakSet();
export function consumeHistoricalProviderAttestation(value){
 if(!value||!capabilities.has(value))return false;capabilities.delete(value);return true;
}

// All adapters here are read-only; no credential is released by the attestation itself.
// A missing live annotation, unknown read or absent protected approval ends this attempt.
export async function attestHistoricalHostedChallenge({challenge,context,execution,readGithub,readProtectedAdmission,verifyOriginalCanonical,verifyOwnLinux,verifyNativeEnding,now=()=>Date.now()}){
 try{
  challenge=structuredClone(challenge);context=structuredClone(context);execution=structuredClone(execution);
  const started=now(),config=assertHistoricalProviderConfiguration(execution.privateProvider);
  assertHistoricalProviderChallenge(challenge,context,started);
  const base=`repos/${context.repository}`,id=context.run.split(':')[0];
  const run=await readGithub(`${base}/actions/runs/${id}`),jobs=await readGithub(`${base}/actions/runs/${id}/jobs?filter=all&per_page=100`);
  assert(run.id===Number(id)&&run.run_attempt===1&&run.repository?.full_name===context.repository&&run.head_sha===context.commit
   &&run.head_branch===context.branch&&run.path===context.workflow&&run.event==='workflow_dispatch'&&run.status==='in_progress');
  assert(jobs.total_count===1&&jobs.jobs?.length===1);const job=jobs.jobs[0];
  assert(job.run_id===run.id&&job.name===context.job&&job.status==='in_progress'&&Number.isSafeInteger(job.id)&&job.id>0
   &&Number.isSafeInteger(job.runner_id)&&job.runner_id>0&&job.labels?.includes('ubuntu-latest'));
  const checkUrl=new URL(job.check_run_url);
  assert(checkUrl.origin==='https://api.github.com'&&new RegExp('^/'+base+'/check-runs/[1-9][0-9]*$').test(checkUrl.pathname)&&!checkUrl.search&&!checkUrl.hash);
  const check=await readGithub(checkUrl.pathname.slice(1)),annotations=await readGithub(checkUrl.pathname.slice(1)+'/annotations?per_page=100');
  assert(check.id===Number(checkUrl.pathname.split('/').at(-1))&&check.app?.slug==='github-actions'&&check.head_sha===context.commit
   &&check.name===context.job&&check.status==='in_progress'&&check.output?.annotations_count===annotations.length&&annotations.length<100);
  const notices=annotations.filter(a=>a.title==='SG_HISTORICAL_PRIVATE_CHALLENGE_V1');
  assert(notices.length===1&&notices[0].annotation_level==='notice'&&notices[0].message===stable(challenge));
  const protectedRead=await readProtectedAdmission();
  assert(now()>=protectedRead.observedAt&&now()-protectedRead.observedAt<10000);
  const grant=assertOwnHistoricalGrant(protectedRead.grant,execution,{GITHUB_RUN_ID:id,GITHUB_SHA:context.commit,SG_BUSINESS_LINUX_RUN:context.linuxRun});
  assert(stable(grant.privateProvider)===stable({schema:config.schema,endpoint:config.endpoint,tlsSpkiSha256:config.tlsSpkiSha256,signingPublicKeySha256:config.signingPublicKeySha256,
   privateCredentials:true,privateEvidence:true,gameId:32737,run:context.run,commit:context.commit,attempt:1}));
  // These invoke the original production boundaries and the own exact14+sealed9 verifier.
  assert(await verifyOriginalCanonical({run,job,protectedRead})===true);
  assert(await verifyOwnLinux({context,protectedRead})===true);
  assert(await verifyNativeEnding({context,protectedRead})===true);
  assert(now()-started<30000&&now()-protectedRead.observedAt<10000);assertHistoricalProviderChallenge(challenge,context,now());
  const receipt=Object.freeze({schema:'sg-historical-hosted-private-attestation-v1',context:Object.freeze(structuredClone(context)),challengeHash:historicalChallengeHash(challenge),observedAt:now(),jobId:job.id,checkId:check.id,
   originalCanonicalVerified:true,ownLinux14Sealed9Verified:true,minimumGrantVerified:true,nativeIdleAndEndedFederationVerified:true,protectedProviderBindingVerified:true});
  capabilities.add(receipt);return receipt;
 }catch{throw Error('HISTORICAL_HOSTED_ATTESTATION_STOP_NO_RETRY');}
}
