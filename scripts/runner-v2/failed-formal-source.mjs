import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

// This failed, fully ended source is immutable evidence, never permission to replay it.
export function checkFailedFormalSource({ended,jobs,profile}){
 const major=profile.sourceRun==='36860241790:1';
 const source=major?{id:36860241790,commit:'d2d38028883eef3a609ba3209e19785857a54e56'}:profile.sourceRun==='36842835455:1'
  ?{id:36842835455,commit:'819b429562e3c011305b2366e8ceac7354999dec'}
  :{id:36791455132,commit:'876797180569bb1134fd7cc6c6934dc347cd0cb1'};
 assert(profile.schema==='sg-formal-stopped-retire-pyramids-v2'&&profile.group==='secondary'
  &&profile.gameId===32721&&profile.trialId==='sg_r1_20260928_32721'
  &&profile.sourceRun===source.id+':1'&&profile.sourceCommit===source.commit
  &&profile.sourceFailure?.schema==='sg-ended-protocol-failure-v1'
  &&profile.sourceFailure.reason==='PROTOCOL_VALIDATION_FAILED','FAILED_FORMAL_SCOPE');
 assert(ended?.repository?.full_name==='287113535qq-cmyk/sg-capture-runner'
  &&ended.id===source.id&&ended.run_attempt===1&&ended.status==='completed'&&ended.conclusion==='failure'
  &&ended.event==='workflow_dispatch'&&ended.path==='.github/workflows/trial-300k.yml'
  &&ended.head_sha===profile.sourceCommit,'FAILED_FORMAL_SOURCE');
 assert(Array.isArray(jobs?.jobs)&&Number.isInteger(jobs.total_count)&&jobs.total_count===jobs.jobs.length
  &&jobs.total_count<100&&hash(jobs)===profile.sourceFailure.jobsHash
  &&jobs.jobs.every(j=>j.status==='completed'),'FAILED_FORMAL_JOBS');
 const captures=jobs.jobs.filter(j=>/^capture-\d+$/.test(j.name));
 if(major)assert(hash(profile.sourceFailure.verifyFailure)===hash({schema:'sg-known-relay-choice-failure-v1',
  logSha256:'7ecc23b75814e9ca3b3d377eb147aa0ca5bd011febd6b3a19c60da07c0bec729',code:'ENOENT',runtimeChoice:'none'}),
  'FAILED_FORMAL_VERIFY_PROOF');
 const endedControl=j=>j.name==='verify'&&major?'failure':'success';
 assert(captures.length===20&&new Set(captures.map(j=>j.name)).size===20
  &&Array.from({length:20},(_,i)=>'capture-'+i).every(n=>captures.some(j=>j.name===n))
  &&captures.every(j=>['success','failure'].includes(j.conclusion))&&captures.some(j=>j.conclusion==='failure')
  &&['pyramids-formal-admit','verify'].every(n=>jobs.jobs.filter(j=>j.name===n&&j.conclusion===endedControl(j)).length===1)
  &&jobs.jobs.filter(j=>!captures.includes(j)).every(j=>['success','skipped'].includes(j.conclusion)||major&&j.name==='verify'&&j.conclusion==='failure'), 'FAILED_FORMAL_JOBS');
}
