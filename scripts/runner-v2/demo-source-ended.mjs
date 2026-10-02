import assert from 'node:assert/strict';
import {checkVeryFruityNextProfile} from './veryfruity-next-profile.mjs';
export function checkDemoSourceEnded({ended,jobs,profile,closing=false,repository='zyzuoyang/sg-capture-runner'}){
 const veryfruity=!closing&&profile.gameId===32812;
 if(veryfruity)checkVeryFruityNextProfile(profile,profile.basePlan);
 assert(repository==='zyzuoyang/sg-capture-runner'||(repository==='287113535qq-cmyk/sg-capture-runner'&&profile.group==='secondary'&&profile.workerOffset===20&&(veryfruity||closing&&[32719,32721].includes(profile.gameId)||!closing&&profile.gameId===32721&&profile.fromGameId===32719&&profile.sourceClosureHash==='6c4638ed879867f611a3aeffb6e97a40ba2b8cdeaa90d211f669711549c4425c')),'SOURCE_REPOSITORY_SCOPE');
 assert('capture-run:'+ended.id+':'+ended.run_attempt===profile.sourceRunKey&&ended.run_attempt===1
  &&ended.head_sha===profile.sourceCommit&&ended.status==='completed'
  &&ended.path==='.github/workflows/trial-300k.yml'&&ended.repository?.full_name===repository
  &&jobs.total_count===jobs.jobs.length&&jobs.total_count>0&&jobs.total_count<100&&jobs.jobs.every(j=>j.status==='completed'),'NEXT_GAME_SOURCE_NOT_FINISHED');
 if(closing){
  assert(ended.conclusion===profile.sourceConclusion&&['success','failure'].includes(ended.conclusion),'PILOT_CLOSE_SOURCE_CONCLUSION');
  const workers=jobs.jobs.filter(j=>/^fresh-capture-\d+$/.test(j.name));
  assert(workers.length===20&&new Set(workers.map(j=>j.name)).size===20,'PILOT_CLOSE_SOURCE_JOBS');
  for(let w=0;w<20;w++){const job=workers.find(j=>j.name===`fresh-capture-${w}`);
   assert(job&&job.conclusion===((profile.schema==='sg-demo-pilot-close-v2'?profile.completeByWorker?.[w]:profile.usedByWorker[w])===5?'success':'failure'),'PILOT_CLOSE_SOURCE_JOBS');}
 }else if(profile.sourceFormal){
  assert(['success','failure'].includes(ended.conclusion)&&[veryfruity?'pyramids-formal-admit':'formal-admit','verify'].every(name=>jobs.jobs.some(j=>j.name===name&&j.conclusion==='success')),'FORMAL_SOURCE_NOT_AUDITED');
  const workers=jobs.jobs.filter(j=>/^capture-\d+$/.test(j.name));
  assert(workers.length===20&&new Set(workers.map(j=>j.name)).size===20&&Array.from({length:20},(_,i)=>`capture-${i}`).every(name=>workers.some(j=>j.name===name)),'FORMAL_SOURCE_JOBS');
 }else assert(ended.conclusion==='success'||profile.sourceClosureHash&&ended.conclusion==='failure','NEXT_GAME_SOURCE_NOT_FINISHED');
}
